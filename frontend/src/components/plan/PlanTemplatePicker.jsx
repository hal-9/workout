import { getTemplatePlan } from '../../data/templates/index.js';
import { createEmptyPlan } from '../../lib/planDefaults.js';
import Icon from '../ui/Icon.jsx';

// Antippbare Karte = erhaben; Druck über .btn.
const cardStyle = {
  display: 'block',
  background: 'var(--bg)',
  border: 'none',
  borderRadius: 20,
  padding: 16,
  marginBottom: 16,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  color: 'var(--text)',
};

const daysBadgeStyle = {
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--muted)',
  background: 'var(--bg)',
  boxShadow: 'var(--shadow-inset-sm)',
  padding: '5px 10px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

export default function PlanTemplatePicker({ templates, onSelect, onBlank }) {
  const handleSelectTemplate = (templateId) => {
    const plan = getTemplatePlan(templateId);
    if (plan) onSelect(plan);
  };

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.45, margin: '0 0 16px' }}>
        Wähle eine Vorlage als Startpunkt — du kannst alles danach anpassen.
      </p>

      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => handleSelectTemplate(template.id)}
          className="neu-raised btn"
          style={cardStyle}
          aria-label={`Vorlage ${template.title} auswählen`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <strong style={{ fontSize: 16 }}>{template.title}</strong>
              <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.45, marginTop: 4 }}>{template.description}</div>
            </div>
            <span style={daysBadgeStyle}>
              {template.days} Tage
            </span>
          </div>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onSelect(createEmptyPlan())}
        className="neu-raised btn"
        style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}
        aria-label="Leeren Plan von Grund auf erstellen"
      >
        <Icon name="plus" size={20} style={{ color: 'var(--muted)' }} />
        <span>
          <strong style={{ fontSize: 16 }}>Leerer Plan</strong>
          <span style={{ display: 'block', fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Von Grund auf selbst aufbauen</span>
        </span>
      </button>

      {onBlank && (
        <button
          type="button"
          onClick={onBlank}
          className="btn"
          style={{
            minHeight: 44,
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          Zurück zum Assistenten
        </button>
      )}
    </div>
  );
}
