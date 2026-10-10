// All display formatting lives here. Every helper tolerates undefined/null/NaN.
// MB is decimal (1e6 bytes), matching Hugging Face / model-card size listings.

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

export function formatMB(bytes) {
  return isNum(bytes) ? `${(bytes / 1e6).toFixed(1)} MB` : '—';
}

export function formatSize(bytes) {
  if (!isNum(bytes)) return '—';
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : formatMB(bytes);
}

export function formatPercent(p) {
  return isNum(p) ? `${p.toFixed(0)}%` : '—';
}

export function formatSeconds(ms) {
  return isNum(ms) ? `${(ms / 1000).toFixed(1)} s` : '—';
}

// JSON.stringify can throw (circular refs, BigInt) on library payloads.
export function toJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
