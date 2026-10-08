// Small inline icon set (no icon font or CDN, so the demo works offline).

type IconProps = { className?: string };

function Svg({ className = "h-4 w-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

// Brand mark: a placeholder token, [•]. Keep in sync with app/icon.svg.
export function LogoMark({ className = "h-7 w-7" }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#0C0A09" />
      <path d="M12.5 9.5H9.5V22.5H12.5" stroke="#FAFAF9" strokeWidth={2.25} />
      <path d="M19.5 9.5H22.5V22.5H19.5" stroke="#FAFAF9" strokeWidth={2.25} />
      <circle cx="16" cy="16" r="2.25" fill="#FAFAF9" />
    </svg>
  );
}

export const BracketsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5H6v14h3M15 5h3v14h-3" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Svg>
);

export const ShieldCheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.75 4.75 5.6v5.9c0 4.5 3 8.5 7.25 9.75 4.25-1.25 7.25-5.25 7.25-9.75V5.6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.75" y="10.75" width="14.5" height="9.5" rx="2" />
    <path d="M8.25 10.75V7.5a3.75 3.75 0 0 1 7.5 0v3.25" />
  </Svg>
);

export const CloudIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.7 8a4.25 4.25 0 0 1-.2 8.5H7z" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.9 9l5.6 2-5.6 2L12 18.5 10.1 13l-5.6-2 5.6-2z" />
  </Svg>
);

export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12 20 4.5 15.5 20l-3.5-6.5z" />
    <path d="m12 13.5 8-9" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5M4 4v4.5h4.5M4 12.5a8 8 0 0 0 13.7 5.2L20 15.5M20 20v-4.5h-4.5" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.75v5M12 16.25h.01" />
  </Svg>
);
