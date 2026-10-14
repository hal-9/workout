import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { addDays, mondayStart, toSqlUtc } from '../lib/dates.js';
import { buildWeekRecap, groupSessionsByWeek } from '../lib/weekRecap.js';
import {
  TREND_LABELS,
  formatProgressDelta,
  formatPlanSince,
  exercisesBeyondHighlights,
} from '../lib/exerciseProgress.js';
import ExerciseChart from '../components/ExerciseChart.jsx';
import RecoveryMap from '../components/RecoveryMap.jsx';
import TrainingTree from '../components/TrainingTree.jsx';
import ProgressSummary, { deNum } from '../components/ProgressSummary.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Icon from '../components/ui/Icon.jsx';
import '../styles/prog.css';

const sectionHeading = { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' };
const contextLine = { margin: '4px 0 12px', fontSize: 14, color: 'var(--muted)' };

// Kleine Linien-Icons, die Icon.jsx nicht hat (Strich 1.8, runde Enden).
const LineIcon = ({ d, size = 18, style }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ flexShrink: 0, ...style }}
  >
    <path d={d} />
  </svg>
);
const MORE_PATH = 'M5 12h.01M12 12h.01M19 12h.01';
const FLAT_PATH = 'M4 12h16';

// Trend als Icon + Wort; Farbe aus TREND_LABELS, der Pfeil-Glyph im Text fällt weg.
const TrendBadge = ({ trend }) => {
  const meta = TREND_LABELS[trend];
  if (!meta) return null;
  const word = meta.text.replace(/^\S+\s/, '');
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 13,
        fontWeight: 600,
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      {trend === 'same' ? (
        <LineIcon d={FLAT_PATH} size={16} />
      ) : (
        <Icon name="trend" size={16} style={trend === 'down' ? { transform: 'scaleY(-1)' } : undefined} />
      )}
      {word}
    </span>
  );
};

const ExerciseProgressCard = ({ exercise }) => {
  const delta = formatProgressDelta(exercise.first_value, exercise.latest_value, exercise.metric_label);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{exercise.name}</h3>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{exercise.muscle}</div>
        </div>
        {exercise.trend && <TrendBadge trend={exercise.trend} />}
      </div>
      {delta && (
        <div style={{ fontSize: 15, fontWeight: 600, margin: '8px 0 0' }}>{deNum(delta)}</div>
      )}
      <div style={{ marginTop: 12 }}>
        <ExerciseChart points={exercise.points} target={exercise.target} metricLabel={exercise.metric_label} />
      </div>
    </Card>
  );
};

// Kleine erhabene Pille (Freunde).
const pillLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 999,
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

export default function Fortschritt() {
  const queryClient = useQueryClient();
  const { data: others } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users') });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/me'), retry: false });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Entfernte Freunde verschwinden aus der Liste — dann zurueck auf die eigene Ansicht.
  if (selectedUserId !== null && others && !others.some((u) => u.id === selectedUserId)) {
    setSelectedUserId(null);
  }
  const viewPartner = selectedUserId !== null;

  // Trainingsbaum ist optional und standardmäßig aus. Gespeichert im
  // bestehenden progress_layout-Feld als { order: ['tree'], hidden: [] },
  // damit die Wahl geräteübergreifend gilt. Alte Layouts (zehn Karten aus dem
  // früheren Anpassen-Modus) zählen nicht als „an".
  const savedLayout = me?.progress_layout;
  const treeOn = savedLayout?.order?.length === 1 && savedLayout.order[0] === 'tree' && !savedLayout.hidden?.length;
  const saveTree = useMutation({
    mutationFn: (on) => api.put('/me/progress-layout', { order: ['tree'], hidden: on ? [] : ['tree'] }),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  });

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
  // Laufende Woche + vier volle Wochen davor.
  const recapFrom = mondayStart(4);
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
  const { data: progression } = useQuery({
    queryKey: ['progression-proposals'],
    queryFn: () => api.get('/progression/proposals'),
    retry: false,
    enabled: !viewPartner,
  });
  const { data: summary, isError: summaryError } = useQuery({
    queryKey: ['progress-summary'],
    queryFn: () => api.get('/progress/summary'),
    retry: false,
    enabled: !viewPartner,
  });
  const { data: treeData } = useQuery({
    queryKey: ['stats-tree'],
    queryFn: () => api.get('/stats/tree'),
    retry: false,
    enabled: !viewPartner && treeOn,
  });
  // Erholungs-Karte braucht nur die letzten Tage.
  const heatmapFrom = mondayStart(1);
  const { data: heatmapRange } = useQuery({
    queryKey: ['sessions-recovery'],
    queryFn: () =>
      api.get(
        `/sessions?from=${encodeURIComponent(toSqlUtc(heatmapFrom))}&to=${encodeURIComponent(toSqlUtc(addDays(mondayStart(0), 7)))}`
      ),
    enabled: !viewPartner,
  });

  const progress = viewPartner ? partnerData : ownProgress;
  const highlights = progress?.highlights ?? [];
  const exercises = progress?.exercises ?? [];
  const moreExercises = exercisesBeyondHighlights(highlights, exercises);
  const planSinceLabel = formatPlanSince(progress?.plan_since);

  const weekRecap =
    plan && recapRange
      ? buildWeekRecap(plan, groupSessionsByWeek(recapRange.sessions, 5))
      : null;

  const handleExportJson = async () => {
    const data = await api.get('/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lilief-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exerciseSection = progress && (
    <div>
      <h2 style={sectionHeading}>Übungs-Fortschritt</h2>
      {(planSinceLabel || (viewPartner && progress.name)) && (
        <p style={contextLine}>
          {viewPartner && progress.name && `Plan: ${progress.plan_name}`}
          {viewPartner && progress.name && planSinceLabel && ' · '}
          {planSinceLabel && `Seit ${planSinceLabel}`}
        </p>
      )}
      {!planSinceLabel && !(viewPartner && progress.name) && <div style={{ height: 12 }} />}

      {highlights.length === 0 && (
        <Card>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            Nach dem ersten Workout siehst du hier deinen Fortschritt.
          </p>
        </Card>
      )}

      {highlights.map((exercise) => (
        <ExerciseProgressCard key={exercise.exercise_id} exercise={exercise} />
      ))}

      {moreExercises.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowAllExercises((open) => !open)}
            aria-expanded={showAllExercises}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: showAllExercises ? 16 : 0,
            }}
          >
            {showAllExercises ? 'Weniger anzeigen' : `Alle Übungen (${moreExercises.length})`}
            <Icon
              name="chevronDown"
              size={16}
              style={{ color: 'var(--muted)', transform: showAllExercises ? 'rotate(180deg)' : 'none' }}
            />
          </Button>
          {showAllExercises &&
            moreExercises.map((exercise) => (
              <ExerciseProgressCard key={exercise.exercise_id} exercise={exercise} />
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="wrap">
      <PageHeader
        title="Fortschritt"
        action={
          !viewPartner && (
            <Button
              variant="secondary"
              onClick={() => setExportOpen((o) => !o)}
              ariaLabel="Daten exportieren"
              ariaPressed={exportOpen}
              style={{
                width: 44,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
                color: exportOpen ? 'var(--primary)' : 'var(--text)',
                boxShadow: exportOpen ? 'var(--shadow-selected)' : undefined,
              }}
            >
              <LineIcon d={MORE_PATH} size={20} style={{ strokeWidth: 2.6 }} />
            </Button>
          )
        }
      />

      {/* Exporte sind selten gebraucht — sie stehen nicht mehr neben dem Titel. */}
      {!viewPartner && exportOpen && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            background: 'var(--bg)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 24,
            padding: '10px 10px 10px 16px',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--muted)', marginRight: 'auto' }}>Daten exportieren</span>
          <Button variant="secondary" onClick={handleExportJson} style={{ padding: '0 16px', fontSize: 14 }}>
            JSON
          </Button>
          <a
            href="/api/export.csv"
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 16px',
              minHeight: 44,
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 999,
              background: 'var(--bg)',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            CSV
          </a>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div className="px-seg-scroll">
          <div className="px-seg">
            <button
              type="button"
              className="px-seg-opt"
              aria-pressed={!viewPartner}
              onClick={() => setSelectedUserId(null)}
            >
              Ich
            </button>
            {(others ?? []).map((u) => (
              <button
                key={u.id}
                type="button"
                className="px-seg-opt"
                aria-pressed={selectedUserId === u.id}
                onClick={() => setSelectedUserId(u.id)}
              >
                {u.name}
              </button>
            ))}
          </div>
        </div>
        <Link to="/freunde" className="btn btn-secondary" aria-label="Freunde hinzufügen" style={pillLinkStyle}>
          <Icon name="plus" size={16} />
          Freunde
        </Link>
      </div>

      {!viewPartner && (
        <>
          <ProgressSummary
            weekRecap={weekRecap}
            summary={summary}
            summaryError={summaryError}
            proposals={progression?.proposals ?? (progression === undefined ? null : [])}
          />
          {heatmapRange && <RecoveryMap sessions={heatmapRange.sessions} />}
          {treeOn && treeData && <TrainingTree weeks={treeData.weeks} />}
          <Button
            variant="secondary"
            fullWidth
            ariaPressed={treeOn}
            onClick={() => saveTree.mutate(!treeOn)}
            disabled={saveTree.isPending}
            style={{ marginBottom: 16 }}
          >
            {treeOn ? 'Trainingsbaum ausblenden' : 'Trainingsbaum anzeigen'}
          </Button>
        </>
      )}

      {viewPartner && exerciseSection}
    </div>
  );
}
