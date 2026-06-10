import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createIdbStorage } from './idb-storage';

describe('idb storage', () => {
  it('round-trips values, lists keys, deletes, and isolates stores', async () => {
    const a = createIdbStorage<{ n: number }>('contracts');
    const b = createIdbStorage<{ s: string }>('settings');
    await a.set('x', { n: 1 });
    await a.set('y', { n: 2 });
    await b.set('k', { s: 'v' });
    expect(await a.get('x')).toEqual({ n: 1 });
    expect((await a.keys()).sort()).toEqual(['x', 'y']);
    expect(await b.get('k')).toEqual({ s: 'v' });
    expect(await b.get('x')).toBeUndefined(); // store isolation
    await a.delete('x');
    expect(await a.get('x')).toBeUndefined();
  });
});
