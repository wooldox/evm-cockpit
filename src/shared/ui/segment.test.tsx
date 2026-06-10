import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segment } from './segment';

describe('Segment', () => {
  it('reports the selected option', async () => {
    const onChange = vi.fn();
    render(
      <Segment
        value="all"
        onChange={onChange}
        options={[
          { value: 'all', label: 'All' },
          { value: 'current', label: 'Current' },
        ]}
      />,
    );
    // Each option renders as role="tab"; click the inactive one
    await userEvent.click(screen.getByRole('tab', { name: 'Current' }));
    expect(onChange).toHaveBeenCalledWith('current');
  });
});
