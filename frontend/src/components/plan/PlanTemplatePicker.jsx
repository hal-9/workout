import { getTemplatePlan } from '../../data/templates/index.js';
import { createEmptyPlan } from '../../lib/planDefaults.js';

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: 16,
  marginBottom: 12,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
};

export default function PlanTemplatePicker({ templates, onSelect, onBlank }) {
  const handleSelectTemplate = (templateId) => {
    const plan = getTemplatePlan(templateId);
    if (plan) onSelect(plan);
  };

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
        Wähle eine Vorlage als Startpunkt — du kannst alles danach anpassen.
      </p>

      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => handleSelectTemplate(template.id)}
          style={cardStyle}
          aria-label={`Vorlage ${template.title} auswählen`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <strong style={{ fontSize: 16 }}>{template.title}</strong>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{template.description}</div>
            </div>
            <span
              style={{
                flexShrink: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--primary)',
                background: 'var(--primary-dim)',
                padding: '4px 8px',
                borderRadius: 8,
              }}
            >
              {template.days} Tage
            </span>
          </div>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onSelect(createEmptyPlan())}
        style={{
          ...cardStyle,
          borderStyle: 'dashed',
          color: 'var(--muted)',
        }}
        aria-label="Leeren Plan von Grund auf erstellen"
      >
        <strong style={{ color: 'var(--text)' }}>Leerer Plan</strong>
        <div style={{ fontSize: 13, marginTop: 4 }}>Von Grund auf selbst aufbauen</div>
      </button>

      {onBlank && (
        <button
          type="button"
          onClick={onBlank}
          style={{
            marginTop: 8,
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Abbrechen
        </button>
      )}
    </div>
  );
}
