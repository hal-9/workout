import { useMemo } from 'react';
import { buildTree, TREE_WIDTH, TREE_HEIGHT } from '../lib/tree.js';

// Der Trainingsbaum wächst aus der echten Historie: Ast pro Trainingswoche,
// Blüte pro PR, Frucht pro Max-Test. Farben folgen der aktiven Palette.
const WOOD = 'var(--muted)';
const LEAF_A = 'var(--grad-from)';
const LEAF_B = 'var(--grad-to)';
const BLOSSOM = 'var(--accent)';
const FRUIT = 'var(--primary)';

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
  const tree = useMemo(() => buildTree(weeks ?? []), [weeks]);
  const { totals } = tree;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Dein Trainingsbaum</h3>
        {totals.weeks > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            {totals.weeks} Woche{totals.weeks === 1 ? '' : 'n'}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${TREE_WIDTH} ${TREE_HEIGHT}`}
        style={{ width: '100%', maxWidth: 340, height: 'auto', display: 'block', margin: '4px auto 0' }}
        role="img"
        aria-label="Trainingsbaum aus deiner Trainingshistorie"
      >
        {/* Boden */}
        <ellipse cx={TREE_WIDTH / 2} cy={320} rx={92} ry={9} fill="var(--surface2)" />

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
                  <circle key={`f${i}`} cx={fruit.x} cy={fruit.y} r={3.4} fill={FRUIT} stroke="var(--surface)" strokeWidth={1} />
                ))}
                {branch.blossoms.map((blossom, i) => (
                  <circle key={`b${i}`} cx={blossom.x} cy={blossom.y} r={2.6} fill={BLOSSOM} stroke="var(--surface)" strokeWidth={0.8} />
                ))}
              </g>
            ))}
            <LeafCluster leaf={tree.crown} tone="a" />
          </g>
        )}
      </svg>

      {tree.seedling ? (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          Dein Setzling wartet — jedes Workout lässt ihn wachsen.
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
          <span>{totals.workouts} Workouts</span>
          {totals.prs > 0 && (
            <span>
              <span style={{ color: 'var(--accent)' }}>●</span> {totals.prs} PRs
            </span>
          )}
          {totals.maxTests > 0 && (
            <span>
              <span style={{ color: 'var(--primary)' }}>●</span> {totals.maxTests} Max-Tests
            </span>
          )}
        </div>
      )}
    </div>
  );
}
