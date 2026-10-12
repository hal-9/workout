import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { deNum } from './ProgressSummary.jsx';

const formatChartDate = (date) => {
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
};

// Gemeinsame Diagramm-Optik (auch für StatsSection): Achsen/Raster aus Tokens, Tooltip als erhabenes Kärtchen.
export const axisProps = {
  stroke: 'var(--line)',
  tick: { fill: 'var(--muted)', fontSize: 12 },
  tickLine: false,
};

export const tooltipProps = {
  contentStyle: {
    background: 'var(--bg)',
    border: 'none',
    borderRadius: 12,
    boxShadow: 'var(--shadow-raised-sm)',
    color: 'var(--text)',
    fontSize: 13,
  },
  labelStyle: { color: 'var(--muted)' },
  itemStyle: { color: 'var(--text)' },
  cursor: { stroke: 'var(--line)' },
};

// Mulde, in der ein Diagramm liegt.
export const chartWellStyle = {
  background: 'var(--bg)',
  boxShadow: 'var(--shadow-inset-sm)',
  borderRadius: 14,
  padding: '12px 8px 6px 0',
};

export default function ExerciseChart({ points, target, metricLabel }) {
  if (!points?.length) {
    return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Noch keine Einträge.</p>;
  }

  const hasRepTarget = target?.min != null && target?.max != null;
  const hasTimeTarget = target?.duration != null;

  return (
    <div style={chartWellStyle}>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={points} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="date" {...axisProps} tickFormatter={formatChartDate} interval="preserveStartEnd" />
          <YAxis {...axisProps} axisLine={false} width={40} tickFormatter={deNum} />
          <Tooltip
            {...tooltipProps}
            formatter={(v) => [deNum(v), metricLabel]}
            labelFormatter={(label) => formatChartDate(label)}
          />
          {hasRepTarget && (
            <ReferenceArea
              y1={target.min}
              y2={target.max}
              fill="var(--primary)"
              fillOpacity={0.08}
              strokeOpacity={0}
            />
          )}
          {hasTimeTarget && (
            <ReferenceLine
              y={target.duration}
              stroke="var(--primary)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="var(--primary)"
            fillOpacity={0.1}
            dot={{ r: 3, fill: 'var(--primary)', stroke: 'var(--bg)', strokeWidth: 1 }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
