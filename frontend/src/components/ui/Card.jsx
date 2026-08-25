export default function Card({ children, style, className = '' }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
