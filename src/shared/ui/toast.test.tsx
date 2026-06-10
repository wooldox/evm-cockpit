import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './toast';

// Trigger component that pushes a toast on click
function Trigger() {
  const push = useToast();
  return (
    <button
      onClick={() => push({ kind: 'success', title: 'Saved', duration: 1000 })}
    >
      go
    </button>
  );
}

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('shows a pushed toast and auto-dismisses after its duration', async () => {
    // Use fake timers from the start so every setTimeout (mount effect +
    // auto-dismiss) is under our control.
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    // Flush the mount-time useEffect that sets `mounted = true` (via
    // startTransition).  We use a real async act so React can finish all
    // queued work even though timers are fake.
    await act(async () => {
      await Promise.resolve();
    });

    // The portal is now mounted; the trigger button is in the DOM.
    expect(screen.getByText('go')).toBeInTheDocument();

    // Click to push a toast; the toast's dismiss setTimeout is created here.
    act(() => {
      screen.getByText('go').click();
    });

    // The toast text should be visible immediately.
    expect(screen.getByText('Saved')).toBeInTheDocument();

    // Advance past the 1 000 ms duration to trigger the auto-dismiss timer.
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('throws when useToast is used outside the provider', () => {
    function Bad() {
      useToast();
      return null;
    }
    // Suppress React's error-boundary console noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(
      'useToast must be used within <ToastProvider>',
    );
    spy.mockRestore();
  });
});
