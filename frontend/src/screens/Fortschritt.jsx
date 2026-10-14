import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { getStoredLayout, mergeLayout, setStoredLayout } from '../lib/progressLayout.js';
import ExerciseChart from '../components/ExerciseChart.jsx';
import MaxTestsSection from '../components/MaxTestsSection.jsx';
import ConsistencyHeatmap, { buildConsistencyHeatmap } from '../components/ConsistencyHeatmap.jsx';
import RecoveryMap from '../components/RecoveryMap.jsx';
import TrainingTree from '../components/TrainingTree.jsx';
import WrappedStory, { monthLabel } from '../components/WrappedStory.jsx';
import ProgressionProposals from '../components/ProgressionProposals.jsx';
import ProgressLayoutEditor from '../components/ProgressLayoutEditor.jsx';
import ProgressSummary, { deNum } from '../components/ProgressSummary.jsx';
import { buildProgressSummary } from '../lib/progressSummary.js';
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
const SLIDERS_PATH = 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4';
const FLAT_PATH = 'M4 12h16';
const ALERT_PATH = 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5v5.5M12 16.4v.2';

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

// Karten des eigenen Fortschritt-Tabs: Reihenfolge + Sichtbarkeit sind pro
// User anpassbar (Anpassen-Modus), Titel dienen auch den eingeklappten Zeilen.
const CARD_TITLES = {
  exercises: 'Übungs-Fortschritt',
  consistency: 'Konsistenz',
  weeks: 'Trainingswochen',
  tree: 'Trainingsbaum',
  recovery: 'Erholung',
  stats: 'Statistiken',
  progression: 'Nächste Session',
  maxtests: 'Max-Tests & Körpergewicht',
  recent: 'Auswertungen',
  wrapped: 'Monats-Rückblick',
};
const CARD_IDS = Object.keys(CARD_TITLES);

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

// Kleine erhabene Pille (Freunde, Anpassen).
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

// Status der KI-Auswertung als Icon statt Glyph.
const EvaluationStatus = ({ status }) => {
  if (status === 'ok') {
    return (
      <span role="img" aria-label="ausgewertet" style={{ display: 'inline-flex', color: 'var(--success)' }}>
        <Icon name="check" size={16} />
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span role="img" aria-label="Auswertung läuft" style={{ display: 'inline-flex', color: 'var(--muted)' }}>
        <Icon name="timer" size={16} />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span role="img" aria-label="Auswertung fehlgeschlagen" style={{ display: 'inline-flex', color: 'var(--danger)' }}>
        <LineIcon d={ALERT_PATH} size={16} />
      </span>
    );
  }
  return <span style={{ width: 16, textAlign: 'center', color: 'var(--muted)' }}>–</span>;
};

// Ausgeblendete Karte: drückbare, leise Zeile zum Wieder-Einblenden.
const CollapsedCard = ({ title, onShow }) => (
  <button
    type="button"
    onClick={onShow}
    className="btn btn-secondary"
    style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      minHeight: 48,
      padding: '0 16px',
      marginBottom: 16,
      border: 'none',
      borderRadius: 20,
      background: 'var(--bg)',
      color: 'var(--muted)',
      textAlign: 'left',
      cursor: 'pointer',
      fontSize: 15,
    }}
  >
    <span>{title}</span>
    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Einblenden</span>
  </button>
);

export default function Fortschritt() {
  const queryClient = useQueryClient();
  const { data: others } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users') });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/me'), retry: false });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState(() => mergeLayout(CARD_IDS, getStoredLayout()));
  // Entfernte Freunde verschwinden aus der Liste — dann zurueck auf die eigene Ansicht.
  if (selectedUserId !== null && others && !others.some((u) => u.id === selectedUserId)) {
    setSelectedUserId(null);
  }
  const viewPartner = selectedUserId !== null;

  const saveLayout = useMutation({
    mutationFn: (next) => api.put('/me/progress-layout', next),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  });

  // Wie beim Theme: der Server ist die Quelle fuer das Geraet, das die Auswahl
  // noch nicht kennt; lokal Geaendertes wird sofort gespeichert.
  const serverLayout = me?.progress_layout ?? null;
  useEffect(() => {
    if (!serverLayout) return;
    const merged = mergeLayout(CARD_IDS, serverLayout);
    if (JSON.stringify(merged) === JSON.stringify(layout)) return;
    setLayout(merged);
    setStoredLayout(merged);
  }, [serverLayout]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyLayout = (next) => {
    setLayout(next);
    setStoredLayout(next);
    saveLayout.mutate(next);
  };

  const hiddenSet = new Set(layout.hidden);
  const unhideCard = (id) =>
    applyLayout({ order: layout.order, hidden: layout.hidden.filter((h) => h !== id) });

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
  const { data: progression } = useQuery({
    queryKey: ['progression-proposals'],
    queryFn: () => api.get('/progression/proposals'),
    retry: false,
    enabled: !viewPartner,
  });
  const { data: treeData } = useQuery({
    queryKey: ['stats-tree'],
    queryFn: () => api.get('/stats/tree'),
    retry: false,
    enabled: !viewPartner,
  });
  const { data: wrappedLatest } = useQuery({
    queryKey: ['wrapped-latest'],
    queryFn: () => api.get('/wrapped/latest'),
    retry: false,
    enabled: !viewPartner,
  });
  const heatmapFrom = mondayStart(11);
  const { data: heatmapRange } = useQuery({
    queryKey: ['sessions-heatmap'],
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
      ? buildWeekRecap(plan, groupSessionsByWeek(recapRange.sessions, 4))
      : null;

  const heatmapData =
    plan && heatmapRange ? buildConsistencyHeatmap(plan, heatmapRange.sessions, 12) : null;

  const summaryItems = buildProgressSummary({
    weekRecap,
    exercises,
    proposals: progression?.proposals,
  });

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

  // Falsy = Karte hat gerade nichts zu zeigen und taucht auch eingeklappt nicht auf.
  const cardNodes = {
    tree: treeData && <TrainingTree weeks={treeData.weeks} />,
    progression: progression?.proposals?.length > 0 && (
      <ProgressionProposals proposals={progression.proposals} deload={progression.deload} />
    ),
    recovery: heatmapRange && <RecoveryMap sessions={heatmapRange.sessions} />,
    consistency: heatmapData && (
      <Card>
        <h3 style={sectionHeading}>Konsistenz</h3>
        <p style={contextLine}>Trainingstage pro Woche, letzte 12 Wochen</p>
        <ConsistencyHeatmap data={heatmapData} />
      </Card>
    ),
    maxtests: <MaxTestsSection />,
    weeks: weekRecap && weekRecap.weeks.length > 0 && (
      <Card>
        <h3 style={sectionHeading}>Trainingswochen</h3>
        <p style={contextLine}>
          Ø {deNum(weekRecap.averageDone)} von {weekRecap.total}
          {weekRecap.streak > 0 && ` · Serie: ${weekRecap.streak} Woche${weekRecap.streak === 1 ? '' : 'n'}`}
        </p>
        {weekRecap.weeks.map((w) => (
          <div key={w.weekLabel} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 52, fontSize: 13, color: 'var(--muted)' }}>{w.weekLabel}</div>
            <div style={{ flex: 1, display: 'flex', gap: 4 }}>
              {Array.from({ length: w.total }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 5,
                    background: i < w.done ? 'var(--primary)' : 'var(--bg)',
                    boxShadow: i < w.done ? 'none' : 'var(--shadow-raised)',
                  }}
                />
              ))}
            </div>
            <div style={{ width: 36, fontSize: 14, textAlign: 'right' }}>
              {w.done}/{w.total}
            </div>
          </div>
        ))}
      </Card>
    ),
    stats: stats && <StatsSection stats={stats} />,
    exercises: exerciseSection,
    wrapped: wrappedLatest?.available && (
      <button
        type="button"
        onClick={() => setWrappedOpen(true)}
        className="btn btn-secondary"
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: 'none',
          borderRadius: 20,
          minHeight: 56,
          padding: '0 16px',
          marginBottom: 16,
          color: 'var(--text)',
          fontSize: 15,
          fontWeight: 600,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Icon name="gift" size={20} style={{ color: 'var(--primary)' }} />
        <span style={{ flex: 1 }}>Rückblick {monthLabel(wrappedLatest.month)}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>Ansehen</span>
        <Icon name="chevronRight" size={18} style={{ color: 'var(--muted)' }} />
      </button>
    ),
    recent: (
      <Card>
        <h3 style={sectionHeading}>Auswertungen</h3>
        {(recent?.sessions ?? []).length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>Noch keine abgeschlossenen Workouts.</p>
        )}
        <div className="px-rows" style={{ marginTop: 6 }}>
          {(recent?.sessions ?? []).map((s) => (
            <Link
              key={s.session_id}
              to={`/session/${s.session_id}/auswertung`}
              className="px-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 48,
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: 15,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{s.day_name}</span>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                {new Date(s.finished_at.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
              <EvaluationStatus status={s.evaluation_status} />
              <Icon name="chevronRight" size={16} style={{ color: 'var(--muted)' }} />
            </Link>
          ))}
        </div>
      </Card>
    ),
  };

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
        {!viewPartner && (
          <button
            type="button"
            onClick={() => setEditMode((m) => !m)}
            aria-pressed={editMode}
            className="btn btn-secondary"
            style={{
              ...pillLinkStyle,
              marginLeft: 'auto',
              border: 'none',
              cursor: 'pointer',
              color: editMode ? 'var(--primary)' : 'var(--text)',
              boxShadow: editMode ? 'var(--shadow-selected)' : undefined,
            }}
          >
            {editMode ? <Icon name="check" size={16} /> : <LineIcon d={SLIDERS_PATH} size={16} />}
            {editMode ? 'Fertig' : 'Anpassen'}
          </button>
        )}
      </div>

      {!viewPartner && editMode && (
        <ProgressLayoutEditor
          cards={layout.order.map((id) => ({ id, title: CARD_TITLES[id] }))}
          hidden={layout.hidden}
          onChange={applyLayout}
        />
      )}

      {!viewPartner && !editMode && <ProgressSummary items={summaryItems} weeks={weekRecap?.weeks} />}

      {!viewPartner &&
        !editMode &&
        layout.order.map((id) => {
          const node = cardNodes[id];
          if (!node) return null;
          if (hiddenSet.has(id)) {
            return <CollapsedCard key={id} title={CARD_TITLES[id]} onShow={() => unhideCard(id)} />;
          }
          return <Fragment key={id}>{node}</Fragment>;
        })}

      {viewPartner && cardNodes.exercises}

      {wrappedOpen && wrappedLatest?.month && (
        <WrappedStory month={wrappedLatest.month} onClose={() => setWrappedOpen(false)} />
      )}
    </div>
  );
}
