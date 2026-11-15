import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { RestaurantSettings } from '../src/types/menu';
import {
  buildProviderContactLine,
  formatShortDisplayUrl,
} from '../src/utils/menuLogic';
import { UPLOAD_DIR } from './db';

const MM_TO_PT = 72 / 25.4;
const mm = (val: number) => val * MM_TO_PT;

const A5_WIDTH_PT = mm(148);
const A5_HEIGHT_PT = mm(210);

const FONT_REGULAR_PATH = '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf';
const FONT_BOLD_PATH = '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf';
const FONT_MONO_PATH =
  '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-SemiBold.ttf';

function isSupportedPdfImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // PNG signature
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return true;
  }
  // JPEG signature
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return true;
  }
  return false;
}

async function resolveLogoBuffer(rawUrl: string): Promise<Buffer | null> {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('/uploads/')) {
      const filename = path.basename(trimmed);
      const fullPath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(fullPath)) {
        const buf = fs.readFileSync(fullPath);
        return isSupportedPdfImageBuffer(buf) ? buf : null;
      }
      return null;
    }

    if (trimmed.startsWith('/assets/')) {
      const safeRel = trimmed.replace(/^\/+/, '');
      const fullPath = path.resolve(process.cwd(), 'public', safeRel);
      if (fs.existsSync(fullPath)) {
        const buf = fs.readFileSync(fullPath);
        return isSupportedPdfImageBuffer(buf) ? buf : null;
      }
      return null;
    }

    if (trimmed.startsWith('data:image/png;base64,')) {
      const buf = Buffer.from(trimmed.slice('data:image/png;base64,'.length), 'base64');
      return isSupportedPdfImageBuffer(buf) ? buf : null;
    }

    if (trimmed.startsWith('data:image/jpeg;base64,')) {
      const buf = Buffer.from(
        trimmed.slice('data:image/jpeg;base64,'.length),
        'base64'
      );
      return isSupportedPdfImageBuffer(buf) ? buf : null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const res = await fetch(trimmed, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return isSupportedPdfImageBuffer(buf) ? buf : null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function generateMenuQrStandPdf(
  settings: RestaurantSettings,
  targetUrl: string
): Promise<Buffer> {
  const [restaurantLogoBuf, providerLogoBuf] = await Promise.all([
    resolveLogoBuffer(settings.logoUrl),
    resolveLogoBuffer(settings.providerLogoUrl),
  ]);

  const qrMatrix = QRCode.create(targetUrl, {
    errorCorrectionLevel: 'M',
  });

  const doc = new PDFDocument({
    size: [A5_WIDTH_PT, A5_HEIGHT_PT],
    margin: 0,
    info: {
      Title: `${settings.restaurantName || 'Lollipop'} - Menu QR Stand`,
      Author: settings.providerName || 'Shop Grow Media',
      Subject: 'Printable A5 Restaurant Menu QR Stand',
      Creator: 'Lollipop Restaurant Digital Menu',
    },
  });

  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Register & embed fonts when TTF files exist
  const hasNotoRegular = fs.existsSync(FONT_REGULAR_PATH);
  const hasNotoBold = fs.existsSync(FONT_BOLD_PATH);
  const hasMono = fs.existsSync(FONT_MONO_PATH);

  if (hasNotoRegular) doc.registerFont('BrandSans', FONT_REGULAR_PATH);
  if (hasNotoBold) doc.registerFont('BrandBold', FONT_BOLD_PATH);
  if (hasMono) doc.registerFont('BrandMono', FONT_MONO_PATH);

  const fontRegular = hasNotoRegular ? 'BrandSans' : 'Helvetica';
  const fontBold = hasNotoBold ? 'BrandBold' : 'Helvetica-Bold';
  const fontMono = hasMono ? 'BrandMono' : 'Courier-Bold';

  const CREAM_BG = '#FAF7F2';
  const INNER_CARD_BG = '#FFFFFF';
  const CHARCOAL = '#1F1F21';
  const CHARCOAL_BORDER = '#2C2420';
  const MUTED_TEXT = '#44403C';
  const SUBTLE_TEXT = '#57534E';
  const CHERRY_RED = '#B91C1C';
  const DIVIDER_COLOR = '#E2D9CC';

  // Full-bleed warm cream background
  doc.rect(0, 0, A5_WIDTH_PT, A5_HEIGHT_PT).fill(CREAM_BG);

  // Outer subtle card container suitable for acrylic stand trimming/framing
  const frameMargin = mm(7.5);
  const frameW = A5_WIDTH_PT - frameMargin * 2;
  const frameH = A5_HEIGHT_PT - frameMargin * 2;

  doc
    .roundedRect(frameMargin, frameMargin, frameW, frameH, mm(5))
    .fillAndStroke('#FDFBF7', CHARCOAL_BORDER);

  // Top cherry-red decorative header bar clipped inside frame top
  doc.save();
  doc.roundedRect(frameMargin, frameMargin, frameW, frameH, mm(5)).clip();
  doc.rect(frameMargin, frameMargin, frameW, mm(3.5)).fill(CHERRY_RED);
  doc.rect(frameMargin, A5_HEIGHT_PT - frameMargin - mm(2.5), frameW, mm(2.5)).fill(CHERRY_RED);
  doc.restore();

  // Re-stroke border cleanly over clipped accent strips
  doc
    .lineWidth(1.3)
    .roundedRect(frameMargin, frameMargin, frameW, frameH, mm(5))
    .stroke(CHARCOAL_BORDER);

  const contentX = frameMargin + mm(8);
  const contentW = frameW - mm(16);
  let cursorY = frameMargin + mm(10);

  // 1. Restaurant Logo (centred, preserving transparency & proportions)
  if (restaurantLogoBuf) {
    const logoBoxW = mm(84);
    const logoBoxH = mm(26);
    const logoX = (A5_WIDTH_PT - logoBoxW) / 2;
    doc.image(restaurantLogoBuf, logoX, cursorY, {
      fit: [logoBoxW, logoBoxH],
      align: 'center',
      valign: 'center',
    });
    cursorY += logoBoxH + mm(2.5);
  } else {
    cursorY += mm(4);
  }

  // Show restaurant name underneath ONLY if it is not already included in the logo
  if (!settings.logoIncludesName || !restaurantLogoBuf) {
    doc
      .font(fontBold)
      .fontSize(15)
      .fillColor(CHARCOAL)
      .text(settings.restaurantName || 'Lollipop', contentX, cursorY, {
        width: contentW,
        align: 'center',
      });
    cursorY += mm(8);
  } else {
    cursorY += mm(1.5);
  }

  // Subtle decorative cherry accent pill divider
  const pillW = mm(20);
  doc
    .roundedRect((A5_WIDTH_PT - pillW) / 2, cursorY, pillW, mm(1.1), mm(0.55))
    .fill(CHERRY_RED);
  cursorY += mm(6);

  // 2. Invitation text
  doc
    .font(fontBold)
    .fontSize(21)
    .fillColor(CHERRY_RED)
    .text('SCAN OUR MENU', contentX, cursorY, {
      width: contentW,
      align: 'center',
      characterSpacing: 0.9,
    });
  cursorY += mm(9);

  doc
    .font(fontRegular)
    .fontSize(10.5)
    .fillColor(MUTED_TEXT)
    .text('Explore our food & place your order.', contentX, cursorY, {
      width: contentW,
      align: 'center',
    });
  cursorY += mm(8.5);

  // 3. Restaurant Menu QR Code (Vector rendering, >= 50 mm wide, black on white with quiet zone)
  const qrSizeMm = 64; // >= 50 mm requirement
  const quietMm = 6;
  const qrBoxSizeMm = qrSizeMm + quietMm * 2; // 76 mm total white container
  const qrBoxX = (A5_WIDTH_PT - mm(qrBoxSizeMm)) / 2;
  const qrBoxY = cursorY;

  doc
    .lineWidth(1.2)
    .roundedRect(qrBoxX, qrBoxY, mm(qrBoxSizeMm), mm(qrBoxSizeMm), mm(3.5))
    .fillAndStroke(INNER_CARD_BG, CHARCOAL_BORDER);

  const moduleCount = qrMatrix.modules.size;
  const moduleData = qrMatrix.modules.data;
  const qrInnerX = qrBoxX + mm(quietMm);
  const qrInnerY = qrBoxY + mm(quietMm);
  const cellPt = mm(qrSizeMm) / moduleCount;

  // Draw adjacent dark modules merged per row so there are zero anti-aliasing hairlines in print
  doc.fillColor('#000000');
  for (let row = 0; row < moduleCount; row++) {
    let runStart = -1;
    for (let col = 0; col <= moduleCount; col++) {
      const isDark =
        col < moduleCount && Boolean(moduleData[row * moduleCount + col]);
      if (isDark && runStart === -1) {
        runStart = col;
      } else if (!isDark && runStart !== -1) {
        const runCols = col - runStart;
        doc.rect(
          qrInnerX + runStart * cellPt,
          qrInnerY + row * cellPt,
          runCols * cellPt + 0.05,
          cellPt + 0.05
        );
        runStart = -1;
      }
    }
  }
  doc.fill('#000000');

  cursorY = qrBoxY + mm(qrBoxSizeMm) + mm(4.5);

  // Short website address beneath the QR code
  const shortUrl = formatShortDisplayUrl(targetUrl);
  doc
    .font(fontMono)
    .fontSize(8.5)
    .fillColor(CHARCOAL)
    .text(shortUrl, contentX, cursorY, {
      width: contentW,
      align: 'center',
      lineBreak: true,
    });

  const urlTextHeight = doc.heightOfString(shortUrl, {
    width: contentW,
    align: 'center',
  });
  cursorY += Math.max(mm(5), urlTextHeight) + mm(4.5);

  // 4. Simple instructions
  doc
    .font(fontBold)
    .fontSize(9.5)
    .fillColor(CHARCOAL)
    .text(
      'Open your camera  •  Scan the QR  •  View menu & order',
      contentX,
      cursorY,
      {
        width: contentW,
        align: 'center',
      }
    );

  // 5. Service Provider Footer anchored cleanly near bottom inside card frame
  const providerName = (settings.providerName || '').trim() || 'Shop Grow Media';
  const contactLine = buildProviderContactLine({
    providerContact: settings.providerContact,
    providerWebsite: settings.providerWebsite,
  });

  const footerBottomY = A5_HEIGHT_PT - frameMargin - mm(6.5);
  let footerHeight = mm(12); // heading + subline
  if (providerLogoBuf) footerHeight += mm(8.5);
  if (contactLine) footerHeight += mm(4.5);

  const dividerY = footerBottomY - footerHeight - mm(3.5);
  doc
    .lineWidth(0.75)
    .moveTo(contentX + mm(8), dividerY)
    .lineTo(A5_WIDTH_PT - contentX - mm(8), dividerY)
    .stroke(DIVIDER_COLOR);

  let footerCursorY = dividerY + mm(3);

  if (providerLogoBuf) {
    const pLogoW = mm(28);
    const pLogoH = mm(7.5);
    doc.image(providerLogoBuf, (A5_WIDTH_PT - pLogoW) / 2, footerCursorY, {
      fit: [pLogoW, pLogoH],
      align: 'center',
      valign: 'center',
    });
    footerCursorY += pLogoH + mm(1.5);
  }

  doc
    .font(fontBold)
    .fontSize(8.5)
    .fillColor(CHARCOAL)
    .text(`Digital Menu & Ordering by ${providerName}`, contentX, footerCursorY, {
      width: contentW,
      align: 'center',
    });
  footerCursorY += mm(4.2);

  doc
    .font(fontRegular)
    .fontSize(7.5)
    .fillColor(SUBTLE_TEXT)
    .text('QR Menus  •  Websites  •  Digital Solutions', contentX, footerCursorY, {
      width: contentW,
      align: 'center',
    });
  footerCursorY += mm(3.8);

  if (contactLine) {
    doc
      .font(fontBold)
      .fontSize(7.5)
      .fillColor(CHERRY_RED)
      .text(contactLine, contentX, footerCursorY, {
        width: contentW,
        align: 'center',
      });
  }

  doc.end();
  return bufferPromise;
}
