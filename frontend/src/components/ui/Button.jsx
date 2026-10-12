const VARIANTS = {
  primary: {
    background: 'var(--m0)',
    color: 'var(--m-ink)',
    border: 'none',
  },
  secondary: {
    background: 'var(--bg)',
    color: 'var(--text)',
    border: 'none',
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

const CLASS = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
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
      className={CLASS[variant] ?? 'btn'}
      style={{
        ...v,
        width: fullWidth ? '100%' : undefined,
        borderRadius: 999,
        padding: '12px 20px',
        fontWeight: 600,
        fontSize: 15,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        minHeight: 44,
        ...style,
      }}
      {...rest}
    >
      {variant === 'primary' && (
        <span className="mesh" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {children}
    </button>
  );
}
