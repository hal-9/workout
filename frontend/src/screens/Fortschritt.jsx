import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import StatsSection from '../components/StatsSection.jsx';
import { addDays, mondayStart, toSqlUtc } from '../lib/dates.js';
import { buildWeekRecap, groupSessionsByWeek } from '../lib/weekRecap.js';
import {
  TREND_LABELS,
  formatProgressDelta,
  formatPlanSince,
  exercisesBeyondHighlights,
} from '../lib/exerciseProgress.js';
import ExerciseChart from '../components/ExerciseChart.jsx';

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
};

const tabButtonStyle = (active) => ({
  flex: '0 0 auto',
  background: active ? 'var(--primary-dim)' : 'var(--surface)',
  border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
  color: active ? 'var(--primary)' : 'var(--muted)',
  borderRadius: 11,
  padding: '9px 13px',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const ExerciseProgressCard = ({ exercise }) => {
  const delta = formatProgressDelta(exercise.first_value, exercise.latest_value, exercise.metric_label);
  const trendMeta = exercise.trend ? TREND_LABELS[exercise.trend] : null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{exercise.name}</h3>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{exercise.muscle}</div>
        </div>
        {trendMeta && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: trendMeta.color,
              whiteSpace: 'nowrap',
            }}
          >
            {trendMeta.text}
          </span>
        )}
      </div>
      {delta && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--primary)', marginBottom: 8 }}>
          {delta}
        </div>
      )}
      <ExerciseChart points={exercise.points} target={exercise.target} metricLabel={exercise.metric_label} />
    </div>
  );
};

export default function Fortschritt() {
  const { data: others } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users') });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const viewPartner = selectedUserId !== null;

  const { data: ownProgress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get('/progress'),
    retry: false,
    enabled: !viewPartner,
  });
  const { data: partnerData } = useQuery({
    queryKey: ['partner-progress', selectedUserId],
    queryFn: () => api.get(`/partner/progress?user_id=${selectedUserId}`),
    enabled: viewPartner,
  });
  const { data: recent } = useQuery({
    queryKey: ['sessions-recent'],
    queryFn: () => api.get('/sessions/recent'),
    enabled: !viewPartner,
  });

  const recapFrom = mondayStart(3);
  const recapTo = addDays(mondayStart(0), 7);
  const { data: recapRange } = useQuery({
    queryKey: ['sessions-recap', recapFrom.toISOString()],
    queryFn: () =>
      api.get(
        `/sessions?from=${encodeURIComponent(toSqlUtc(recapFrom))}&to=${encodeURIComponent(toSqlUtc(recapTo))}`
      ),
    enabled: !viewPartner,
  });
  const { data: plan } = useQuery({
    queryKey: ['plan'],
    queryFn: () => api.get('/plan'),
    retry: false,
    enabled: !viewPartner,
  });
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats'),
    retry: false,
    enabled: !viewPartner,
  });

  const progress = viewPartner ? partnerData : ownProgress;
  const highlights = progress?.highlights ?? [];
  const exercises = progress?.exercises ?? [];
  const moreExercises = exercisesBeyondHighlights(highlights, exercises);
  const planSinceLabel = formatPlanSince(progress?.plan_since);

  const weekRecap =
    plan && recapRange
      ? buildWeekRecap(plan, groupSessionsByWeek(recapRange.sessions, 4))
      : null;

  return (
    <div className="wrap">
      <h2>Fortschritt</h2>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 0 16px' }}>
        <button type="button" onClick={() => setSelectedUserId(null)} style={tabButtonStyle(!viewPartner)}>
          Ich
        </button>
        {(others ?? []).map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setSelectedUserId(u.id)}
            style={tabButtonStyle(selectedUserId === u.id)}
          >
            {u.name}
          </button>
        ))}
      </div>

      {!viewPartner && weekRecap && weekRecap.weeks.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Trainingswochen</h3>
          {weekRecap.weeks.map((w) => (
            <div key={w.weekLabel} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 52, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                {w.weekLabel}
              </div>
              <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                {Array.from({ length: w.total }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      background: i < w.done ? 'var(--primary)' : 'var(--line)',
                    }}
                  />
                ))}
              </div>
              <div style={{ width: 36, fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right' }}>
                {w.done}/{w.total}
              </div>
            </div>
          ))}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            Ø {weekRecap.averageDone}/{weekRecap.total}
            {weekRecap.streak > 0 && ` · Serie: ${weekRecap.streak} Woche${weekRecap.streak === 1 ? '' : 'n'}`}
          </div>
        </div>
      )}

      {!viewPartner && <StatsSection stats={stats} />}

      {progress && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Übungs-Fortschritt</h3>
            {planSinceLabel && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                Seit {planSinceLabel}
              </span>
            )}
          </div>
          {viewPartner && progress.name && (
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
              Plan: {progress.plan_name}
            </p>
          )}

          {highlights.length === 0 && (
            <div style={cardStyle}>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
                Nach dem ersten Workout siehst du hier deinen Fortschritt.
              </p>
            </div>
          )}

          {highlights.map((exercise) => (
            <ExerciseProgressCard key={exercise.exercise_id} exercise={exercise} />
          ))}

          {moreExercises.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowAllExercises((open) => !open)}
                style={{
                  width: '100%',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--primary)',
                  borderRadius: 11,
                  padding: '10px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  cursor: 'pointer',
                  marginBottom: showAllExercises ? 12 : 0,
                }}
              >
                {showAllExercises ? 'Weniger anzeigen' : `Alle Übungen (${moreExercises.length})`}
              </button>
              {showAllExercises &&
                moreExercises.map((exercise) => (
                  <ExerciseProgressCard key={exercise.exercise_id} exercise={exercise} />
                ))}
            </div>
          )}
        </div>
      )}

      {!viewPartner && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Auswertungen</h3>
          {(recent?.sessions ?? []).length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Noch keine abgeschlossenen Workouts.</p>
          )}
          {(recent?.sessions ?? []).map((s) => (
            <Link
              key={s.session_id}
              to={`/session/${s.session_id}/auswertung`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '9px 0',
                borderBottom: '1px solid var(--line)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              <span>{s.day_name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                {new Date(s.finished_at.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                })}{' '}
                {s.evaluation_status === 'ok'
                  ? '✓'
                  : s.evaluation_status === 'pending'
                    ? '…'
                    : s.evaluation_status === 'failed'
                      ? '⚠'
                      : '–'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
