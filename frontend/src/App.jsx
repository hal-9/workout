import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import BottomNav from './components/BottomNav.jsx';
import OfflineIndicator from './components/OfflineIndicator.jsx';
import Login from './screens/Login.jsx';
import Heute from './screens/Heute.jsx';
import Plan from './screens/Plan.jsx';
import Fortschritt from './screens/Fortschritt.jsx';
import Auswertung from './screens/Auswertung.jsx';

function AuthGuard({ children }) {
  const { data: me, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/me'),
    retry: false,
  });

  if (isLoading) return null;
  if (isError || !me) return <Navigate to="/login" replace />;

  return (
    <>
      <OfflineIndicator />
      {children}
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/heute" element={<AuthGuard><Heute /></AuthGuard>} />
      <Route path="/plan" element={<AuthGuard><Plan /></AuthGuard>} />
      <Route path="/fortschritt" element={<AuthGuard><Fortschritt /></AuthGuard>} />
      <Route path="/session/:id/auswertung" element={<AuthGuard><Auswertung /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/heute" replace />} />
    </Routes>
  );
}
