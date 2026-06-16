import { ImageResponse } from 'next/og';

// Social-share card (Open Graph + Twitter). Generated at build time into a
// static PNG, so it works under `output: 'export'`. Mirrors the in-app brand:
// the bolt-in-gradient mark, the wordmark, the core read/write safety idea.
// Render once at build time (required for image routes under `output: export`).
export const dynamic = 'force-static';
export const alt = 'EVM Cockpit — read & write any EVM smart contract';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        backgroundColor: '#0a0c10',
        backgroundImage:
          'radial-gradient(1000px circle at 0% 0%, rgba(59,130,246,0.20), transparent 45%), radial-gradient(1000px circle at 100% 100%, rgba(245,158,11,0.16), transparent 45%)',
        color: '#e8edf3',
        fontFamily: 'sans-serif',
      }}
    >
      {/* brand row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 24,
            backgroundImage: 'linear-gradient(140deg, #3b82f6, #f59e0b)',
          }}
        >
          <svg
            width={54}
            height={54}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div style={{ display: 'flex', fontSize: 60, fontWeight: 700 }}>
          EVM Cockpit
        </div>
      </div>

      {/* headline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 960,
          }}
        >
          Read &amp; write any EVM smart contract.
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: '#7d8896' }}>
          On any chain, in your browser. Every write is simulated before you
          sign.
        </div>
      </div>

      {/* footer row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, color: '#7d8896' }}>
          evmcockpit.xyz
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px',
              borderRadius: 999,
              border: '1px solid rgba(96,165,250,0.32)',
              backgroundColor: 'rgba(59,130,246,0.12)',
              color: '#6aa6ff',
              fontSize: 26,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                backgroundColor: '#3b82f6',
              }}
            />
            read
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px',
              borderRadius: 999,
              border: '1px solid rgba(245,158,11,0.36)',
              backgroundColor: 'rgba(245,158,11,0.13)',
              color: '#f7b53d',
              fontSize: 26,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                backgroundColor: '#f59e0b',
              }}
            />
            write
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
