/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { AppShell } from './components/layout/AppShell';
import { OverviewPage } from './components/pages/OverviewPage';
import { LoadingSkeleton } from './components/ui/States';
import { AppStateProvider, useAppState } from './state/AppStateContext';

const AirQualityPage = lazy(() =>
  import('./components/pages/AirQualityPage').then((m) => ({ default: m.AirQualityPage })),
);
const AssistantPage = lazy(() =>
  import('./components/pages/AssistantPage').then((m) => ({ default: m.AssistantPage })),
);
const FamilyPage = lazy(() =>
  import('./components/pages/FamilyPage').then((m) => ({ default: m.FamilyPage })),
);
const PlannerPage = lazy(() =>
  import('./components/pages/PlannerPage').then((m) => ({ default: m.PlannerPage })),
);
const IndoorPage = lazy(() =>
  import('./components/pages/IndoorPage').then((m) => ({ default: m.IndoorPage })),
);
const SustainablePage = lazy(() =>
  import('./components/pages/SustainablePage').then((m) => ({ default: m.SustainablePage })),
);
const ImpactPage = lazy(() =>
  import('./components/pages/ImpactPage').then((m) => ({ default: m.ImpactPage })),
);
const SettingsPage = lazy(() =>
  import('./components/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function PageRouter() {
  const { activePage } = useAppState();

  switch (activePage) {
    case 'overview':
      return <OverviewPage />;
    case 'air-quality':
      return <AirQualityPage />;
    case 'assistant':
      return <AssistantPage />;
    case 'family':
      return <FamilyPage />;
    case 'planner':
      return <PlannerPage />;
    case 'indoor':
      return <IndoorPage />;
    case 'sustainable':
      return <SustainablePage />;
    case 'impact':
      return <ImpactPage />;
    case 'settings':
      return <SettingsPage />;
  }
}

export default function App() {
  return (
    <AppStateProvider>
      <AppShell>
        <Suspense fallback={<LoadingSkeleton rows={4} />}>
          <PageRouter />
        </Suspense>
      </AppShell>
    </AppStateProvider>
  );
}
