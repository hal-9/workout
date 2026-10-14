export default function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label && (
        <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
          {label}
        </span>
      )}
      {children}
    </label>
  );
}

// Eingelassenes Feld (Rolle: Wert). Inline, weil Aufrufer es per Spread erweitern.
export const fieldInputStyle = {
  width: '100%',
  minHeight: 44,
  background: 'var(--bg)',
  boxShadow: 'var(--shadow-raised)',
  border: 'none',
  color: 'var(--text)',
  borderRadius: 14,
  padding: '10px 14px',
  fontSize: 16,
};
