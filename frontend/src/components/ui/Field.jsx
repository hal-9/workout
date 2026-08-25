export default function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label && (
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 6,
          }}
        >
          {label}
        </span>
      )}
      {children}
    </label>
  );
}

export const fieldInputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 16,
};
