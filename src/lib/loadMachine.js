// Model load state machine: idle -> downloading -> initializing -> ready, plus error.
// `error` is also used for generate() failures, which leave status at 'ready'.

export const initialLoadState = {
  status: 'idle',
  bytesLoaded: 0,
  bytesTotal: null,
  percent: null,
  phase: null,
  currentFile: null,
  events: [], // byte-count updates, sampled, last MAX_EVENTS
  milestones: [], // everything else (initiate/done/ready/logs/preflight), never evicted
  lastSampleAt: 0,
  info: null,
  error: null,
};

const MAX_EVENTS = 50;
const SAMPLE_MS = 250;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
// Per-chunk byte updates fire thousands of times per download; everything else is rare.
const isByteUpdate = (raw) => raw?.status === 'progress' || raw?.status === 'progress_total';

export function loadReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return initialLoadState;

    case 'start':
      return { ...initialLoadState, status: 'downloading', phase: 'downloading' };

    case 'progress': {
      const p = action.payload ?? {};
      if (state.status !== 'downloading' && state.status !== 'initializing') {
        // Late milestones (e.g. preflight finishing after a fast cached load) are still logged.
        if (state.status === 'ready' && !isByteUpdate(p.raw)) {
          return { ...state, milestones: [{ at: Date.now(), ...p }, ...state.milestones] };
        }
        return state;
      }
      const bytesLoaded = isNum(p.loadedBytes) ? p.loadedBytes : state.bytesLoaded;
      const bytesTotal = isNum(p.totalBytes) && p.totalBytes > 0 ? p.totalBytes : state.bytesTotal;
      const phase = p.phase ?? state.phase;
      const now = Date.now();
      const entry = { at: now, ...p };
      let { events, milestones, lastSampleAt } = state;
      if (!isByteUpdate(p.raw)) milestones = [entry, ...milestones];
      else if (now - lastSampleAt >= SAMPLE_MS) {
        events = [entry, ...events].slice(0, MAX_EVENTS);
        lastSampleAt = now;
      }
      return {
        ...state,
        // One-way: once initializing, stay there until ready.
        status: phase === 'initializing' ? 'initializing' : state.status,
        bytesLoaded,
        bytesTotal,
        percent: bytesTotal ? Math.min(100, (bytesLoaded / bytesTotal) * 100) : isNum(p.percent) ? p.percent : state.percent,
        phase,
        currentFile: p.file ?? state.currentFile,
        info: p.info ?? state.info,
        events,
        milestones,
        lastSampleAt,
      };
    }

    case 'ready':
      return { ...state, status: 'ready', phase: 'ready', currentFile: null };

    case 'fail':
      return { ...state, status: 'error', error: { message: action.message, code: action.code, phase: action.phase ?? state.phase ?? state.status } };

    case 'generateError':
      return { ...state, error: { message: action.message, phase: 'generating' } };

    case 'clearError':
      return { ...state, error: null };

    default:
      return state;
  }
}
