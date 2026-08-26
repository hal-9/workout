import { Suspense, lazy, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import BottomNav from './components/BottomNav.jsx';
import Header from './components/Header.jsx';
import OfflineIndicator from './components/OfflineIndicator.jsx';
import LoadingScreen from './components/ui/LoadingScreen.jsx';
import Login from './screens/Login.jsx';
import Register from './screens/Register.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Heute from './screens/Heute.jsx';
import Plan from './screens/Plan.jsx';
import Fortschritt from './screens/Fortschritt.jsx';
import Freunde from './screens/Freunde.jsx';
import Kalender from './screens/Kalender.jsx';
import Auswertung from './screens/Auswertung.jsx';

// Kalibrierseite für die Muskelzonen — nur im Dev-Server, nie im Build.
const MuscleDev = import.meta.env.DEV ? lazy(() => import('./screens/MuscleDev.jsx')) : null;

function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/me'),
    retry: false,
  });
}

function AuthGuard({ children }) {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <main>
        <LoadingScreen label="Session wird geladen…" />
      </main>
    );
  }
  if (isError || !me) return <Navigate to="/login" replace />;
  if (!me.onboarded) return <Navigate to="/willkommen" replace />;

  return (
  <>
    <Header />
    <OfflineIndicator />
    <main className="app-shell">{children}</main>
    <BottomNav />
  </>
  );
}

function OnboardingRoute() {
  const { data: me, isLoading, isError } = useMe();
  const wasOnboarded = useRef(null);

  if (isLoading) {
    return (
      <main>
        <LoadingScreen />
      </main>
    );
  }
  if (isError || !me) return <Navigate to="/login" replace />;
  if (wasOnboarded.current === null) wasOnboarded.current = me.onboarded;
  if (wasOnboarded.current) return <Navigate to="/heute" replace />;

  return <Onboarding />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registrieren" element={<Register />} />
      <Route path="/willkommen" element={<OnboardingRoute />} />
      <Route path="/heute" element={<AuthGuard><Heute /></AuthGuard>} />
      <Route path="/plan" element={<AuthGuard><Plan /></AuthGuard>} />
      <Route path="/fortschritt" element={<AuthGuard><Fortschritt /></AuthGuard>} />
      <Route path="/freunde" element={<AuthGuard><Freunde /></AuthGuard>} />
      <Route path="/kalender" element={<AuthGuard><Kalender /></AuthGuard>} />
      <Route path="/session/:id/auswertung" element={<AuthGuard><Auswertung /></AuthGuard>} />
      {MuscleDev && (
        <Route path="/dev/muskeln" element={<Suspense fallback={null}><MuscleDev /></Suspense>} />
      )}
      <Route path="*" element={<Navigate to="/heute" replace />} />
    </Routes>
  );
}
