import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db';

const SESSION_COOKIE_NAME = 'lollipop_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function resolveFallbackSecret(): string {
  const dataDir = path.resolve(process.cwd(), 'data');
  const secretPath = path.join(dataDir, '.session_secret');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const FALLBACK_DEV_SECRET = resolveFallbackSecret();

function getSessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || FALLBACK_DEV_SECRET;
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPasswordHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function hasConfiguredAdmin(): boolean {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0) {
    return true;
  }
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM admin_users').get() as {
    cnt: number;
  };
  return Number(row?.cnt ?? 0) > 0;
}

export function createInitialAdmin(
  usernameInput: string,
  passwordInput: string
): { ok: boolean; username?: string; error?: string } {
  if (hasConfiguredAdmin()) {
    return { ok: false, error: 'An admin account is already configured.' };
  }
  const username = (usernameInput || '').trim();
  const password = passwordInput || '';

  if (username.length < 3 || username.length > 40) {
    return { ok: false, error: 'Username must be between 3 and 40 characters.' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      error: 'Username may contain only letters, numbers, dots, underscores, or hyphens.',
    };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters long.' };
  }

  const passwordHash = hashPassword(password);
  try {
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(
      username,
      passwordHash
    );
    return { ok: true, username };
  } catch {
    return { ok: false, error: 'Unable to save admin account.' };
  }
}

export function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string
): { valid: boolean; username?: string } {
  const username = (usernameInput || '').trim();
  const password = passwordInput || '';
  if (!username || !password) return { valid: false };

  const envUser = process.env.ADMIN_USERNAME?.trim() || 'admin';
  const envPass = process.env.ADMIN_PASSWORD || '';
  if (envPass && safeEquals(username, envUser) && safeEquals(password, envPass)) {
    return { valid: true, username: envUser };
  }

  const userRow = db
    .prepare('SELECT username, password_hash FROM admin_users WHERE username = ?')
    .get(username) as { username: string; password_hash: string } | undefined;

  if (userRow && verifyPasswordHash(password, userRow.password_hash)) {
    return { valid: true, username: userRow.username };
  }

  return { valid: false };
}

interface SessionPayload {
  username: string;
  exp: number;
}

export function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  if (!safeEquals(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.username !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

export function setSessionCookie(
  req: Request,
  res: Response,
  username: string
): string {
  const token = signSessionToken({
    username,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const isHttps = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  return token;
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const verifiedBearer = verifySessionToken(bearerToken);
    if (verifiedBearer) return verifiedBearer;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  return verifySessionToken(cookieToken);
}

export interface AuthenticatedRequest extends Request {
  adminSession?: SessionPayload;
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.adminSession = session;
  next();
}
