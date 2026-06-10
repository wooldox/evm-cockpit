'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

/**
 * Reads/writes the data-theme attribute on <html> — the single switch that
 * re-themes every token-backed Tailwind utility. Persists to localStorage so
 * theme-init.js can re-apply it before paint on the next load.
 */
export function useTheme(): [Theme, (t: Theme) => void, () => void] {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'light' || current === 'dark')
      startTransition(() => setThemeState(current));
  }, []);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('cc-theme', t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(
      (document.documentElement.getAttribute('data-theme') === 'light'
        ? 'dark'
        : 'light') as Theme,
    );
  }, [setTheme]);

  return [theme, setTheme, toggle];
}
