import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { BottomBar } from '@/ui';
import { Today } from '@/features/today/Today';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { applyTheme, useSettings } from './stores';

const Scan = lazy(() => import('@/features/scan/Scan'));
const EntryEditor = lazy(() => import('@/features/entry/EntryEditor'));
const History = lazy(() => import('@/features/history/History'));
const Stats = lazy(() => import('@/features/stats/Stats'));
const Insights = lazy(() => import('@/features/insights/Insights'));
const SettingsScreen = lazy(() => import('@/features/settings/Settings'));
const Styleguide = lazy(() => import('@/features/settings/Styleguide'));

function Shell() {
  return (
    <>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
      <BottomBar />
    </>
  );
}

function RequireOnboarding() {
  const done = useSettings((s) => s.settings.onboardingDone);
  const location = useLocation();
  if (!done) return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function App() {
  const { ready, load, settings } = useSettings();

  useEffect(() => {
    void load();
  }, [load]);

  // En thème "système", suit les changements de l'appareil.
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [settings.theme]);

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/styleguide" element={<Suspense fallback={null}><Styleguide /></Suspense>} />
      <Route element={<RequireOnboarding />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route path="/scan" element={<Suspense fallback={null}><Scan /></Suspense>} />
        <Route path="/entry/:id" element={<Suspense fallback={null}><EntryEditor /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
