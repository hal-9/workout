import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';

const formatChartDate = (date) => {
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
};

export default function ExerciseChart({ points, target, metricLabel }) {
  if (!points?.length) {
    return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Noch keine Einträge.</p>;
  }

  const hasRepTarget = target?.min != null && target?.max != null;
  const hasTimeTarget = target?.seconds != null;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={points} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="date"
          stroke="var(--muted)"
          fontSize={11}
          tickFormatter={formatChartDate}
          interval="preserveStartEnd"
        />
        <YAxis stroke="var(--muted)" fontSize={11} width={36} />
        <Tooltip
          formatter={(v) => [v, metricLabel]}
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
            y={target.seconds}
            stroke="var(--primary)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'var(--primary)' }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
