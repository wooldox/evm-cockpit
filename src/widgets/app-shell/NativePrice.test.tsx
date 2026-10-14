import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NativePrice, formatUsd } from './NativePrice';

const fetchMock = vi.fn();

function respond(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

function renderPrice(chainId: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NativePrice chainId={chainId} />
    </QueryClientProvider>,
  );
}

describe('formatUsd', () => {
  it.each([
    [3421.554, '$3,421.55'],
    [1, '$1.00'],
    [0.51234, '$0.5123'],
    [0.0000123456, '$0.00001235'],
  ])('%s → %s', (n, out) => expect(formatUsd(n)).toBe(out));
});

describe('NativePrice', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(() =>
      respond({ ethereum: { usd: 3421.55, usd_24h_change: -1.234 } }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the chain's native coin price with 24h change", async () => {
    renderPrice(1);
    expect(await screen.findByText('$3,421.55')).toBeInTheDocument();
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('-1.23%')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('ids=ethereum&vs_currencies=usd'),
    );
  });

  it('renders nothing and fetches nothing for a chain without a market (e.g. testnet)', () => {
    const { container } = renderPrice(11155111);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
