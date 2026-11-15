const SOUND_STORAGE_KEY = 'lollipop_admin_sound_enabled_v1';

let sharedAudioContext: AudioContext | null = null;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

function getOrCreateAudioContext(): AudioContext | null {
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    return sharedAudioContext;
  }
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  try {
    sharedAudioContext = new Ctor();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function isAdminSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(SOUND_STORAGE_KEY);
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function setAdminSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota or private mode issues
  }
}

export function getAdminAudioState(): AudioContextState | 'unsupported' {
  const ctx = getOrCreateAudioContext();
  return ctx ? ctx.state : 'unsupported';
}

export async function unlockAdminAudio(): Promise<
  AudioContextState | 'unsupported'
> {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return 'unsupported';
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return ctx.state;
    }
  }
  return ctx.state;
}

export interface PlayChimeResult {
  played: boolean;
  reason?: 'muted' | 'suspended' | 'unsupported';
}

/**
 * Synthesizes a pleasant, unmistakable 3-note restaurant bell chime via Web Audio API
 * without requiring external audio file assets.
 */
export async function playNewOrderChime(options?: {
  force?: boolean;
}): Promise<PlayChimeResult> {
  if (!options?.force && !isAdminSoundEnabled()) {
    return { played: false, reason: 'muted' };
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx) {
    return { played: false, reason: 'unsupported' };
  }

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Fall through to suspended check
    }
  }

  if (ctx.state !== 'running') {
    return { played: false, reason: 'suspended' };
  }

  try {
    const now = ctx.currentTime;
    // Crisp 3-note rising kitchen chime (C6 -> E6 -> G6 -> high C6 bell)
    const notes: Array<{ freq: number; delay: number; duration: number; gain: number }> = [
      { freq: 1046.5, delay: 0.0, duration: 0.24, gain: 0.2 },
      { freq: 1318.51, delay: 0.12, duration: 0.26, gain: 0.22 },
      { freq: 1567.98, delay: 0.25, duration: 0.42, gain: 0.25 },
      { freq: 2093.0, delay: 0.36, duration: 0.5, gain: 0.14 },
    ];

    for (const note of notes) {
      const startAt = now + note.delay;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, startAt);

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(note.gain, startAt + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startAt);
      osc.stop(startAt + note.duration + 0.02);
      osc.onended = () => {
        osc.disconnect();
        gainNode.disconnect();
      };
    }

    return { played: true };
  } catch {
    return { played: false, reason: 'suspended' };
  }
}
