import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopy } from './use-copy';

describe('useCopy', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls navigator.clipboard.writeText with the stringified value', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });

    const { result } = renderHook(() => useCopy());
    act(() => {
      result.current[1]('hello');
    });

    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('flips copied to true immediately then back to false after the timeout', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useCopy(500));
    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1]('test');
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current[0]).toBe(false);
  });

  it('coerces non-string values to strings', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });

    const { result } = renderHook(() => useCopy());
    act(() => {
      result.current[1](42);
    });

    expect(writeText).toHaveBeenCalledWith('42');
  });
});
