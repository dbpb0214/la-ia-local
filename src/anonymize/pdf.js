// PDF in/out for the anonymizer. In: page text + positions via pdf.js. Out: image-only pages
// via pdf-lib — rasterized, so no hidden text, form data or metadata from the original survives.
import { getDocument, GlobalWorkerOptions, Util } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

GlobalWorkerOptions.workerSrc = pdfWorker; // self-hosted, works offline

export async function openPdf(file) {
  return getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
}

// A page's text plus runs mapping character ranges back to rectangles (PDF points, top-left
// origin). Filled form-field values are runs too: render() paints them into the output, so they
// must be detectable; `whole` boxes the entire field when any part of it matches.
export async function extractPage(doc, n) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: 1 });
  const [{ items, styles }, annotations] = await Promise.all([page.getTextContent(), page.getAnnotations()]);
  let text = '';
  const runs = [];
  let prev = null;

  for (const item of items) {
    if (typeof item.str !== 'string') continue; // marked-content markers
    if (item.str) {
      const [, , c, d, x, baseline] = Util.transform(viewport.transform, item.transform);
      const h = Math.hypot(c, d) || 10;
      const run = { x, y: baseline - h, w: item.width, h, str: item.str, font: styles[item.fontName]?.fontFamily ?? 'sans-serif' };
      if (prev && !/\s$/.test(text)) {
        if (Math.abs(run.y - prev.y) > h * 0.5) text += '\n';
        else if (x - (prev.x + prev.w) > h * 0.1) text += ' ';
      }
      run.start = text.length;
      text += item.str;
      run.end = text.length;
      runs.push(run);
      prev = run;
    }
    if (item.hasEOL && text && !text.endsWith('\n')) text += '\n';
  }

  for (const a of annotations) {
    const value = [a.fieldValue].flat().filter((v) => typeof v === 'string' && v.trim()).join(' ');
    if (!value || !a.rect) continue;
    const [x1, y1] = viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
    const [x2, y2] = viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
    if (text && !text.endsWith('\n')) text += '\n';
    const start = text.length;
    text += `${value}\n`;
    runs.push({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), start, end: start + value.length, whole: true });
  }
  return { text, runs, width: viewport.width, height: viewport.height };
}

// Width of `str` relative to the whole run, measured with the browser's closest font.
// ponytail: font approximated by family (pdf.js maps embedded fonts to serif/sans/mono);
// per-glyph widths from the PDF font would be exact if a custom font ever clips.
let measureCtx = null;
function textWidth(str, font) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = `100px ${font}`;
  return measureCtx.measureText(str).width;
}

// Spans (char offsets into page.text) -> rectangles in PDF points.
export function boxesFor(page, spans) {
  return spans.flatMap((s) =>
    page.runs
      .filter((r) => r.start < s.end && r.end > s.start)
      .map((r) => {
        if (r.whole) return { x: r.x, y: r.y, w: r.w, h: r.h, label: s.label };
        const a = Math.max(s.start, r.start) - r.start;
        const b = Math.min(s.end, r.end) - r.start;
        const full = textWidth(r.str, r.font) || 1;
        const x0 = r.x + (r.w * textWidth(r.str.slice(0, a), r.font)) / full;
        const x1 = r.x + (r.w * textWidth(r.str.slice(0, b), r.font)) / full;
        const pad = Math.max(1.5, r.h * 0.15); // leak-safe margin for font-metric mismatch
        return { x: x0 - pad, y: r.y - 1.5, w: x1 - x0 + 2 * pad, h: r.h * 1.25 + 3, label: s.label };
      })
  );
}

function paintBox(ctx, { x, y, w, h, label }, scale) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
  let size = h * scale * 0.7;
  ctx.font = `${size}px sans-serif`;
  const fit = (w * scale - 2) / ctx.measureText(label).width;
  if (fit < 1) size *= fit;
  if (size < 4) return; // too small to read: plain black box
  ctx.font = `${size}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x * scale + 1, (y + h / 2) * scale);
}

export async function renderPage(doc, n, canvas, scale, boxes = []) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  for (const b of boxes) paintBox(ctx, b, scale);
}

export async function exportRedacted(doc, boxesByPage, scale = 2) {
  const out = await PDFDocument.create();
  const canvas = document.createElement('canvas');
  for (let n = 1; n <= doc.numPages; n++) {
    await renderPage(doc, n, canvas, scale, boxesByPage[n - 1]);
    const jpg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    const img = await out.embedJpg(await jpg.arrayBuffer());
    const { width, height } = img.scale(1 / scale);
    out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
  }
  canvas.width = canvas.height = 0;
  return new Blob([await out.save()], { type: 'application/pdf' });
}
