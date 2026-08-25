const VARIANTS = {
  primary: {
    background: 'var(--primary-grad)',
    color: 'var(--on-primary)',
    border: 'none',
  },
  secondary: {
    background: 'var(--surface2)',
    color: 'var(--text)',
    border: '1px solid var(--line)',
  },
  ghost: {
    background: 'none',
    color: 'var(--primary)',
    border: 'none',
  },
  danger: {
    background: 'var(--danger)',
    color: 'var(--on-primary)',
    border: 'none',
  },
};

export default function Button({
  children,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  type = 'button',
  onClick,
  ariaLabel,
  ariaPressed,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className="btn"
      style={{
        ...v,
        width: fullWidth ? '100%' : undefined,
        borderRadius: 13,
        padding: '12px 18px',
        fontWeight: 600,
        fontSize: 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        minHeight: 44,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
