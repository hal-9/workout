export default function Skeleton({ width = '100%', height = 16, style }) {
  return (
    <div
      className="skeleton-pulse"
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: 8,
        background: 'var(--line)',
        ...style,
      }}
    />
  );
}
