import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { PLAN_TEMPLATES } from '../data/templates/index.js';
import { clonePlan } from '../lib/planDefaults.js';
import PlanTemplatePicker from '../components/plan/PlanTemplatePicker.jsx';
import PlanEditor from '../components/plan/PlanEditor.jsx';
import PlanOverview from '../components/plan/PlanOverview.jsx';
import PlanAdvancedImport from '../components/plan/PlanAdvancedImport.jsx';

const MODES = {
  overview: 'overview',
  picker: 'picker',
  editor: 'editor',
};

export default function Plan() {
  const queryClient = useQueryClient();
  const { data: plan, error: planError, isLoading } = useQuery({
    queryKey: ['plan'],
    queryFn: () => api.get('/plan'),
    retry: false,
  });

  const [mode, setMode] = useState(null);
  const [editorPlan, setEditorPlan] = useState(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const hasActivePlan = Boolean(plan);
  const activeMode = mode ?? (hasActivePlan ? MODES.overview : MODES.picker);

  const handleSavePlan = async (planPayload) => {
    setSaving(true);
    setSuccessMessage(null);
    try {
      await api.post('/plan', planPayload);
      setSuccessMessage('Plan erfolgreich gespeichert.');
      setMode(MODES.overview);
      setEditorPlan(null);
      setIsEditingExisting(false);
      await queryClient.invalidateQueries({ queryKey: ['plan'] });
    } finally {
      setSaving(false);
    }
  };

  const handleImportPlan = async (planPayload) => {
    setImporting(true);
    setSuccessMessage(null);
    try {
      await api.post('/plan', planPayload);
      setSuccessMessage('Plan erfolgreich importiert.');
      setMode(MODES.overview);
      await queryClient.invalidateQueries({ queryKey: ['plan'] });
    } finally {
      setImporting(false);
    }
  };

  const handleStartEdit = () => {
    if (!plan) return;
    setEditorPlan(clonePlan(plan));
    setIsEditingExisting(true);
    setMode(MODES.editor);
    setSuccessMessage(null);
  };

  const handleStartNew = () => {
    setMode(MODES.picker);
    setEditorPlan(null);
    setIsEditingExisting(false);
    setSuccessMessage(null);
  };

  const handleSelectTemplate = (templatePlan) => {
    setEditorPlan(templatePlan);
    setIsEditingExisting(false);
    setMode(MODES.editor);
  };

  const handleCancelEditor = () => {
    setEditorPlan(null);
    setIsEditingExisting(false);
    setMode(hasActivePlan ? MODES.overview : MODES.picker);
  };

  return (
    <div className="wrap">
      <h2>Plan</h2>

      {isLoading && (
        <p style={{ color: 'var(--muted)' }}>Plan wird geladen…</p>
      )}

      {planError && planError.status !== 404 && !isLoading && (
        <p style={{ color: 'var(--danger)' }}>Plan konnte nicht geladen werden.</p>
      )}

      {successMessage && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--success-dim)',
            color: 'var(--success)',
            fontSize: 14,
          }}
          role="status"
        >
          {successMessage}
        </div>
      )}

      {activeMode === MODES.picker && (
        <>
          {!hasActivePlan && (
            <p style={{ color: 'var(--muted)' }}>Noch kein aktiver Plan — wähle eine Vorlage zum Start.</p>
          )}
          <PlanTemplatePicker
            templates={PLAN_TEMPLATES}
            onSelect={handleSelectTemplate}
            onBlank={hasActivePlan ? () => setMode(MODES.overview) : undefined}
          />
        </>
      )}

      {activeMode === MODES.editor && editorPlan && (
        <PlanEditor
          initialPlan={editorPlan}
          hasActivePlan={hasActivePlan}
          isEditingExisting={isEditingExisting}
          onSave={handleSavePlan}
          onCancel={handleCancelEditor}
          saving={saving}
        />
      )}

      {activeMode === MODES.overview && plan && (
        <PlanOverview plan={plan} onEdit={handleStartEdit} onNewPlan={handleStartNew} />
      )}

      {(activeMode === MODES.overview || activeMode === MODES.picker) && (
        <PlanAdvancedImport
          hasActivePlan={hasActivePlan}
          onImport={handleImportPlan}
          importing={importing}
        />
      )}
    </div>
  );
}
