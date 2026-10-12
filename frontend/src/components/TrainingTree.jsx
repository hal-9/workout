import { useMemo, useState } from 'react';
import { buildTree, TREE_WIDTH, TREE_HEIGHT } from '../lib/tree.js';
import Card from './ui/Card.jsx';
import { ToggleButton } from './RecoveryMap.jsx';

// Der Trainingsbaum wächst aus der echten Historie: Ast pro Trainingswoche,
// Blüte pro PR, Frucht pro Max-Test. Farben folgen der aktiven Palette.
const WOOD = 'var(--muted)';
const LEAF_A = 'var(--grad-from)';
const LEAF_B = 'var(--grad-to)';
const BLOSSOM = 'var(--accent)';
const FRUIT = 'var(--primary)';

const legendItemStyle = { display: 'inline-flex', alignItems: 'center', gap: 6 };
const dotStyle = (color) => ({ width: 8, height: 8, borderRadius: 999, background: color });

function LeafCluster({ leaf, tone }) {
  const fill = tone === 'a' ? LEAF_A : LEAF_B;
  return (
    <g fill={fill} opacity={0.82}>
      <circle cx={leaf.x} cy={leaf.y} r={leaf.r} />
      <circle cx={leaf.x - leaf.r * 0.55} cy={leaf.y + leaf.r * 0.3} r={leaf.r * 0.62} />
      <circle cx={leaf.x + leaf.r * 0.5} cy={leaf.y - leaf.r * 0.35} r={leaf.r * 0.58} />
    </g>
  );
}

export default function TrainingTree({ weeks }) {
  const [open, setOpen] = useState(false);
  const tree = useMemo(() => buildTree(weeks ?? []), [weeks]);
  const { totals } = tree;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Dein Trainingsbaum</h3>
        <ToggleButton open={open} onClick={() => setOpen((o) => !o)} />
      </div>

      {!open && (
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>
          {tree.seedling
            ? 'Dein Setzling wartet — jedes Workout lässt ihn wachsen.'
            : `${totals.weeks} Woche${totals.weeks === 1 ? '' : 'n'} · ${totals.workouts} Workouts · ${totals.prs} PR${
                totals.prs === 1 ? '' : 's'
              }`}
        </p>
      )}

      {open && (
        <>

        <svg
          viewBox={`0 0 ${TREE_WIDTH} ${TREE_HEIGHT}`}
          style={{ width: '100%', maxWidth: 340, height: 'auto', display: 'block', margin: '4px auto 0' }}
          role="img"
          aria-label="Trainingsbaum aus deiner Trainingshistorie"
        >
          {/* Boden */}
          <ellipse cx={TREE_WIDTH / 2} cy={320} rx={92} ry={9} fill="var(--line)" />

          {tree.seedling ? (
            <g>
              <path
                d={`M ${TREE_WIDTH / 2} 318 Q ${TREE_WIDTH / 2 - 3} 296 ${TREE_WIDTH / 2} 282`}
                stroke={WOOD}
                strokeWidth={3.5}
                strokeLinecap="round"
                fill="none"
              />
              <ellipse cx={TREE_WIDTH / 2 - 10} cy={284} rx={11} ry={6} fill={LEAF_A} opacity={0.82} transform={`rotate(-28 ${TREE_WIDTH / 2 - 10} 284)`} />
              <ellipse cx={TREE_WIDTH / 2 + 10} cy={278} rx={11} ry={6} fill={LEAF_B} opacity={0.82} transform={`rotate(24 ${TREE_WIDTH / 2 + 10} 278)`} />
            </g>
          ) : (
            <g>
              <polygon points={tree.trunk} fill={WOOD} opacity={0.9} />
              {tree.branches.map((branch) => (
                <g key={branch.week_start}>
                  <path
                    d={branch.path}
                    stroke={WOOD}
                    strokeWidth={branch.width}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.9}
                  />
                  <LeafCluster leaf={branch.leaf} tone={branch.leafTone} />
                  {branch.fruits.map((fruit, i) => (
                    <circle key={`f${i}`} cx={fruit.x} cy={fruit.y} r={3.4} fill={FRUIT} stroke="var(--bg)" strokeWidth={1} />
                  ))}
                  {branch.blossoms.map((blossom, i) => (
                    <circle key={`b${i}`} cx={blossom.x} cy={blossom.y} r={2.6} fill={BLOSSOM} stroke="var(--bg)" strokeWidth={0.8} />
                  ))}
                </g>
              ))}
              <LeafCluster leaf={tree.crown} tone="a" />
            </g>
          )}
        </svg>

        {tree.seedling ? (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Dein Setzling wartet — jedes Workout lässt ihn wachsen.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
            <span>{totals.workouts} Workouts</span>
            {totals.prs > 0 && (
              <span style={legendItemStyle}>
                <span style={dotStyle('var(--accent)')} /> {totals.prs} PRs
              </span>
            )}
            {totals.maxTests > 0 && (
              <span style={legendItemStyle}>
                <span style={dotStyle('var(--primary)')} /> {totals.maxTests} Max-Tests
              </span>
            )}
          </div>
        )}
        </>
      )}
    </Card>
  );
}
