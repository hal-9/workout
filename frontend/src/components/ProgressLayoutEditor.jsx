import { useRef, useState } from 'react';

const ROW_GAP = 0;

const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <line x1="3" y1="3" x2="21" y2="21" />}
  </svg>
);

const GripIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M5 8h14M5 12h14M5 16h14" />
  </svg>
);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Anpassen-Modus des Fortschritt-Tabs: Karten als kompakte Zeilen, Drag nur
// über den Griff (touch-action: none, sonst scrollt die Seite mit).
export default function ProgressLayoutEditor({ cards, hidden, onChange }) {
  const [drag, setDrag] = useState(null); // { id, from, startY, dy }
  const rowRef = useRef(null);

  const hiddenSet = new Set(hidden);
  const step = (rowRef.current?.offsetHeight ?? 48) + ROW_GAP;
  const to = drag ? clamp(drag.from + Math.round(drag.dy / step), 0, cards.length - 1) : null;

  const commitDrag = () => {
    if (!drag) return;
    if (to !== drag.from) {
      const order = cards.map((c) => c.id);
      const [moved] = order.splice(drag.from, 1);
      order.splice(to, 0, moved);
      onChange({ order, hidden });
    }
    setDrag(null);
  };

  const toggleHidden = (id) => {
    const nextHidden = hiddenSet.has(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    onChange({ order: cards.map((c) => c.id), hidden: nextHidden });
  };

  return (
    <div
      style={{
        background: 'var(--bg)',
        boxShadow: 'var(--shadow-inset)',
        borderRadius: 24,
        padding: '4px 8px',
        marginBottom: 16,
      }}
    >
      {cards.map((card, i) => {
        const isDragged = drag?.id === card.id;
        let shift = 0;
        if (drag && !isDragged) {
          if (drag.from < to && i > drag.from && i <= to) shift = -step;
          else if (drag.from > to && i >= to && i < drag.from) shift = step;
        }
        const isHidden = hiddenSet.has(card.id);

        return (
          <div
            key={card.id}
            ref={i === 0 ? rowRef : undefined}
            className="px-drag-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg)',
              borderTop: i > 0 && !isDragged ? '1px solid var(--line)' : '1px solid transparent',
              borderRadius: isDragged ? 14 : 0,
              padding: '2px 0',
              marginBottom: ROW_GAP,
              opacity: isHidden && !isDragged ? 0.5 : 1,
              transform: `translateY(${isDragged ? drag.dy : shift}px)`,
              transition: isDragged ? 'none' : 'transform 120ms ease',
              position: 'relative',
              zIndex: isDragged ? 2 : 1,
              // Angehobene Zeile: erhaben über der Mulde.
              boxShadow: isDragged ? 'var(--shadow-raised-sm)' : 'none',
            }}
          >
            <button
              type="button"
              aria-label={`${card.title} verschieben`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                setDrag({ id: card.id, from: i, startY: e.clientY, dy: 0 });
              }}
              onPointerMove={(e) => {
                if (drag?.id === card.id) {
                  const y = e.clientY;
                  setDrag((d) => ({ ...d, dy: y - d.startY }));
                }
              }}
              onPointerUp={commitDrag}
              onPointerCancel={() => setDrag(null)}
              style={{
                touchAction: 'none',
                background: 'none',
                border: 'none',
                cursor: isDragged ? 'grabbing' : 'grab',
                color: 'var(--muted)',
                minWidth: 44,
                minHeight: 44,
                display: 'grid',
                placeItems: 'center',
                padding: 0,
              }}
            >
              <GripIcon />
            </button>
            <span style={{ flex: 1, fontSize: 15, minWidth: 0 }}>{card.title}</span>
            <button
              type="button"
              aria-label={isHidden ? `${card.title} einblenden` : `${card.title} ausblenden`}
              onClick={() => toggleHidden(card.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isHidden ? 'var(--muted)' : 'var(--primary)',
                minWidth: 44,
                minHeight: 44,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <EyeIcon off={isHidden} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
