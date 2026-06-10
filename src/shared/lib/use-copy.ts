'use client';

import { useCallback, useState } from 'react';

/** Copy-to-clipboard with a transient "copied" flag for button affordances. */
export function useCopy(timeout = 1100): [boolean, (text: unknown) => void] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    (text: unknown) => {
      try {
        void navigator.clipboard?.writeText(String(text));
      } catch {
        /* ignore */
      }
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    },
    [timeout],
  );
  return [copied, copy];
}
