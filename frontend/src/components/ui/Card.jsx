export default function Card({ children, style, className = '' }) {
  return (
    <div
      className={`neu-raised ${className}`.trim()}
      style={{
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
