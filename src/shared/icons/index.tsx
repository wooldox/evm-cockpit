import type { SVGProps, ReactNode } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

/** Shared base — 1.6px stroke, currentColor, rounded joins. */
function Svg({
  size = 16,
  children,
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

type IconComponent = (props: IconProps) => ReactNode;

const make = (children: ReactNode): IconComponent =>
  function Icon(props: IconProps) {
    return <Svg {...props}>{children}</Svg>;
  };

export const Icon = {
  plus: make(
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>,
  ),
  search: make(
    <>
      <circle cx={11} cy={11} r={7} />
      <path d="M21 21l-4.3-4.3" />
    </>,
  ),
  copy: make(
    <>
      <rect x={9} y={9} width={12} height={12} rx={2} />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>,
  ),
  check: make(<path d="M20 6L9 17l-5-5" />),
  external: make(
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </>,
  ),
  chevR: make(<path d="M9 6l6 6-6 6" />),
  chevD: make(<path d="M6 9l6 6 6-6" />),
  refresh: make(
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </>,
  ),
  edit: make(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>,
  ),
  trash: make(
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </>,
  ),
  share: make(
    <>
      <circle cx={18} cy={5} r={3} />
      <circle cx={6} cy={12} r={3} />
      <circle cx={18} cy={19} r={3} />
      <path d="M8.6 13.5l6.8 4" />
      <path d="M15.4 6.5l-6.8 4" />
    </>,
  ),
  settings: make(
    <>
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
  ),
  wallet: make(
    <>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="M21 9h-6a2 2 0 0 0 0 6h6V9z" />
    </>,
  ),
  book: make(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>,
  ),
  layers: make(
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </>,
  ),
  bolt: make(<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />),
  arrowDown: make(
    <>
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </>,
  ),
  download: make(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </>,
  ),
  play: make(<polygon points="6 4 20 12 6 20 6 4" />),
  sign: make(
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>,
  ),
  history: make(
    <>
      <path d="M3 3v5h5" />
      <path d="M3.05 13a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M12 7v5l4 2" />
    </>,
  ),
  rocket: make(
    <>
      <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0z" />
      <path d="M12 15l-3-3a22 22 0 0 1 8-11c2.5 0 4 1.5 4 4a22 22 0 0 1-11 8z" />
      <path d="M9 12H4s.5-2.8 2-4c1.7-1.4 5 0 5 0" />
      <path d="M12 15v5s2.8-.5 4-2c1.4-1.7 0-5 0-5" />
    </>,
  ),
  alert: make(
    <>
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>,
  ),
  alertCircle: make(
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>,
  ),
  checkCircle: make(
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M9 12l2 2 4-4" />
    </>,
  ),
  xCircle: make(
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </>,
  ),
  x: make(
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>,
  ),
  info: make(
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>,
  ),
  eye: make(
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx={12} cy={12} r={3} />
    </>,
  ),
  lock: make(
    <>
      <rect x={3} y={11} width={18} height={11} rx={2} />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>,
  ),
  filter: make(<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" />),
  code: make(
    <>
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </>,
  ),
  sun: make(
    <>
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M5 5l1.5 1.5" />
      <path d="M17.5 17.5L19 19" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M5 19l1.5-1.5" />
      <path d="M17.5 6.5L19 5" />
    </>,
  ),
  moon: make(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />),
  link: make(
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </>,
  ),
  gas: make(
    <>
      <path d="M3 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18" />
      <path d="M2 22h13" />
      <path d="M13 9h3a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2V8.5L18 4" />
    </>,
  ),
  dots: make(
    <>
      <circle cx={12} cy={12} r={1.4} />
      <circle cx={19} cy={12} r={1.4} />
      <circle cx={5} cy={12} r={1.4} />
    </>,
  ),
  file: make(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>,
  ),
  cmd: make(
    <>
      <path d="M9 4H7a3 3 0 0 0 0 6h10a3 3 0 0 0 0-6h-2M9 20H7a3 3 0 0 1 0-6h10a3 3 0 0 1 0 6h-2" />
      <rect x={9} y={9} width={6} height={6} rx={1} />
    </>,
  ),
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof Icon;
