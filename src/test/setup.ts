// Provide an in-memory IndexedDB for the jsdom env. Persisted zustand stores
// (settings, contracts, history, chain catalog) write to IDB on state change;
// the chain catalog in particular is imported very widely (viem-rpc, explorer,
// chain displays, selectors, top bar), so without a global fake any suite that
// transitively mutates it would raise an unhandled "indexedDB is not defined".
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
