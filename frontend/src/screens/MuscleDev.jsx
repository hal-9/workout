// Nur im Dev-Server erreichbar (/dev/muskeln) — Kalibrierhilfe für die
// Ellipsoid-Regionen in lib/muscleRegions.js. Kein Teil der App-Navigation.
import { useState } from 'react';
import MuscleBody3D from '../components/MuscleBody3D.jsx';
import { MUSCLE_ZONES, ZONE_LABELS } from 'shared/muscles';

export default function MuscleDev() {
  const [zone, setZone] = useState(null);
  const [debug, setDebug] = useState(true);
  const [view, setView] = useState('front');

  const btn = (active) => ({
    padding: '4px 8px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${active ? '#e11d48' : '#ccc'}`,
    background: active ? '#fde8ec' : '#fff', color: '#333',
  });

  return (
    <div style={{ padding: 12, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <button type="button" style={btn(debug)} onClick={() => { setDebug(true); setZone(null); }}>Debug: alle Zonen</button>
        <button type="button" style={btn(view === 'front')} onClick={() => setView('front')}>Front</button>
        <button type="button" style={btn(view === 'back')} onClick={() => setView('back')}>Back</button>
        {MUSCLE_ZONES.map((key) => (
          <button key={key} type="button" style={btn(zone === key)} onClick={() => { setDebug(false); setZone(key); }}>
            {ZONE_LABELS[key]}
          </button>
        ))}
      </div>
      <div style={{ border: '1px solid #ddd', borderRadius: 12, background: '#f4f0fa' }}>
        <MuscleBody3D
          key={String(debug)}
          primary={zone ? [zone] : []}
          view={view}
          height={560}
          debugZones={debug}
        />
      </div>
    </div>
  );
}
