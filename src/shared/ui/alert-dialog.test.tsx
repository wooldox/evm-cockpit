import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmProvider, useConfirm } from './alert-dialog';

function Harness({ withCheckbox = false }: { withCheckbox?: boolean }) {
  const confirm = useConfirm();
  const [result, setResult] = useState('none');
  return (
    <>
      <button
        type="button"
        onClick={async () =>
          setResult(
            JSON.stringify(
              await confirm({
                title: 'Delete it?',
                description: 'This cannot be undone.',
                confirmLabel: 'Delete',
                tone: 'danger',
                checkbox: withCheckbox
                  ? { label: 'Also delete history' }
                  : undefined,
              }),
            ),
          )
        }
      >
        open
      </button>
      <output>{result}</output>
    </>
  );
}

const setup = (withCheckbox = false) => {
  render(
    <ConfirmProvider>
      <Harness withCheckbox={withCheckbox} />
    </ConfirmProvider>,
  );
  return userEvent.setup();
};

describe('useConfirm / AlertDialog', () => {
  it('resolves true on confirm and closes', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'open' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete it?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('status')).toHaveTextContent('{"checked":false}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('focuses Cancel first, Escape cancels, and focus returns to the trigger', async () => {
    const user = setup();
    const trigger = screen.getByRole('button', { name: 'open' });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('status')).toHaveTextContent('false');
    expect(trigger).toHaveFocus();
  });

  it('traps Tab between the actions', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'open' }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('reports the optional checkbox (unchecked by default)', async () => {
    const user = setup(true);
    await user.click(screen.getByRole('button', { name: 'open' }));
    const box = screen.getByRole('checkbox', { name: 'Also delete history' });
    expect(box).not.toBeChecked();
    await user.click(box);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('status')).toHaveTextContent('{"checked":true}');
  });
});
