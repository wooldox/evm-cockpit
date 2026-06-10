import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './switch';

describe('Switch', () => {
  it('reflects checked and reports the new value when toggled', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="dark" />);
    const cb = screen.getByRole('checkbox', { name: 'dark' });
    expect(cb).not.toBeChecked();
    await userEvent.click(cb);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
