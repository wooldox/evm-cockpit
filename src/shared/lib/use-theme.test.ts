import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './use-theme';

// useTheme reads the current data-theme from <html> in a useEffect on mount.
// We preset it before each test so the hook picks up the expected default.

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  it('toggles from dark to light, updates data-theme on <html>, and persists to localStorage', async () => {
    const { result } = renderHook(() => useTheme());

    // Allow the mount-time useEffect (reads data-theme) to settle
    // result.current[0] should be "dark" after the effect
    await act(async () => {});

    expect(result.current[0]).toBe('dark');

    // toggle() — index 2 in the [theme, setTheme, toggle] tuple
    act(() => {
      result.current[2]();
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('cc-theme')).toBe('light');
    expect(result.current[0]).toBe('light');
  });

  it('setTheme sets a specific theme', () => {
    const { result } = renderHook(() => useTheme());

    // setTheme — index 1 in the tuple
    act(() => {
      result.current[1]('light');
    });

    expect(result.current[0]).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggling twice returns to the original theme', async () => {
    const { result } = renderHook(() => useTheme());
    await act(async () => {});

    act(() => {
      result.current[2](); // dark → light
    });
    act(() => {
      result.current[2](); // light → dark
    });

    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
