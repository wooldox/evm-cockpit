import { describe, it, expect } from 'vitest';
import * as ui from './index';
describe('shared/ui barrel', () => {
  it('exports the expected components', () => {
    for (const name of [
      'Button',
      'Field',
      'Input',
      'Textarea',
      'Select',
      'SearchInput',
      'Badge',
      'MutTag',
      'ChainBadge',
      'Copyable',
      'Address',
      'CopyBtn',
      'Switch',
      'Segment',
      'Card',
      'Panel',
      'Modal',
      'ToastProvider',
      'useToast',
      'Empty',
      'Skeleton',
      'ErrorBanner',
      'Spinner',
      'Mono',
      'SimShell',
      'SimStatus',
      'RevertReason',
      'TxGrid',
      'TxField',
      'Metric',
    ]) {
      expect(ui).toHaveProperty(name);
    }
  });
});
