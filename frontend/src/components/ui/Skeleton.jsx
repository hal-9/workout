// Platzhalter als flache Mulde — dort erscheint gleich ein Wert.
export default function Skeleton({ width = '100%', height = 16, style }) {
  return (
    <div
      className="skeleton-pulse"
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: 10,
        background: 'var(--bg)',
        boxShadow: 'var(--shadow-raised)',
        ...style,
      }}
    />
  );
}
