import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ getText, label = 'Copy' }) {
  const [state, setState] = useState('idle'); // idle | copied | failed

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 1500);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText());
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 btn-outline px-2.5 py-1 text-xs"
    >
      {state === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}</span>
    </button>
  );
}
