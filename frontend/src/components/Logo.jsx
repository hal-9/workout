export default function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="lilief-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--grad-from)" />
          <stop offset="1" stopColor="var(--grad-to)" />
        </linearGradient>
      </defs>
      <g transform="rotate(-35 256 276)">
        <rect x="106" y="236" width="300" height="80" rx="40" fill="url(#lilief-logo-g)" />
        <rect x="86" y="176" width="72" height="200" rx="30" fill="url(#lilief-logo-g)" />
        <rect x="30" y="206" width="48" height="140" rx="24" fill="url(#lilief-logo-g)" />
        <rect x="354" y="176" width="72" height="200" rx="30" fill="url(#lilief-logo-g)" />
        <rect x="434" y="206" width="48" height="140" rx="24" fill="url(#lilief-logo-g)" />
      </g>
      <path
        d="M388 56a34 34 0 0 0-30 18 34 34 0 0 0-30-18 34 34 0 0 0-34 34c0 36 40 58 64 78 24-20 64-42 64-78a34 34 0 0 0-34-34z"
        fill="var(--grad-to)"
        transform="translate(38 -26)"
      />
    </svg>
  );
}
