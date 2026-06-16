import { ImageResponse } from 'next/og';

// iOS home-screen / Apple touch icon (180×180, opaque). Same brand mark.
export const dynamic = 'force-static';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        borderRadius: 40,
        backgroundImage: 'linear-gradient(140deg, #3b82f6, #f59e0b)',
      }}
    >
      <svg
        width={104}
        height={104}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>,
    { ...size },
  );
}
