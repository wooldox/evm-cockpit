import { ImageResponse } from 'next/og';

// Favicon — the bolt-in-gradient brand mark. Generated at build into a static
// PNG (works under `output: 'export'`). Replaces the default Next favicon.
export const dynamic = 'force-static';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        borderRadius: 7,
        backgroundImage: 'linear-gradient(140deg, #3b82f6, #f59e0b)',
      }}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>,
    { ...size },
  );
}
