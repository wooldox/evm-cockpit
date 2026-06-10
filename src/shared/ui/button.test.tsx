import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders children and fires onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="read" onClick={onClick}>
        Simulate
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults type to button', () => {
    render(<Button>X</Button>);
    expect(screen.getByRole('button', { name: 'X' })).toHaveAttribute(
      'type',
      'button',
    );
  });
});
