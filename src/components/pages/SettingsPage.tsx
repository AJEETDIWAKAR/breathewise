import { useState } from 'react';
import { Check, ExternalLink, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useAutoClearState } from '../../hooks/useAutoClearTimer';
import { useAppState } from '../../state/AppStateContext';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Selector } from '../ui/Selector';

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    resetAllLocalData,
    clearPersonalData,
    familyProfile,
  } = useAppState();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [savedNotice, showSaved] = useAutoClearState<string | null>(null, 2500);

  const handleDataModeChange = (val: 'preview' | 'live') => {
    updateSettings({ ...settings, dataModePreference: val });
    showSaved('Preference updated');
  };

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <CardHeader
          title="Display & Data Mode Preferences"
          subtitle="Control how BreatheWise displays live AirLive telemetry vs. clearly labeled preview fixtures."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Selector
            label="Data source mode"
            value={settings.dataModePreference}
            onChange={handleDataModeChange}
            helperText="Live API mode connects to the Express backend powered by AirLive (zero AQI API keys required)."
            options={[
              { value: 'live', label: 'Live API Mode (AirLive US AQI & PM2.5)' },
              { value: 'preview', label: 'Preview Fixture Mode (clearly labeled demo data)' },
            ]}
          />

          <Selector
            label="Primary metric display"
            value={settings.preferredUnit}
            onChange={(val) => {
              updateSettings({ ...settings, preferredUnit: val });
              showSaved('Metric display updated');
            }}
            options={[
              { value: 'aqi', label: 'US AQI (0–500 scale)' },
              { value: 'ugm3', label: 'Raw PM2.5 Concentration (µg/m³)' },
            ]}
          />
        </div>

        <label className="mt-4 flex items-center gap-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer text-sm text-slate-800">
          <input
            type="checkbox"
            checked={settings.enableThresholdAlerts}
            onChange={(e) => {
              updateSettings({ ...settings, enableThresholdAlerts: e.target.checked });
              showSaved('Alert preference updated');
            }}
            className="w-4 h-4 accent-teal-700"
          />
          <span>Enable household threshold notifications when US AQI exceeds Unhealthy (150+)</span>
        </label>

        {savedNotice && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-800" role="status">
            <Check className="w-4 h-4" aria-hidden="true" />
            {savedNotice}
          </p>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader
          title="Privacy, Location & Data Minimization"
          subtitle="How BreatheWise handles location lookups and household information"
        />
        <ul className="space-y-3 text-sm text-slate-700">
          <li className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Optional Location &amp; Manual Entry:</strong> You can search cities manually or enter coordinates anytime. Browser geolocation is strictly optional and runs only when you click &ldquo;Use device location&rdquo; to match the nearest monitoring station.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Minimized Local Storage:</strong> BreatheWise does not require accounts or cloud sign-in. Household counts, sensitivities, and impact logs stay in your browser&apos;s <code className="font-mono text-xs">localStorage</code>; AI queries forward only the non-identifying household fields needed to answer your question.
            </span>
          </li>
        </ul>
      </Card>

      <Card padding="lg">
        <CardHeader
          title="Data Sources & Attribution Commitments"
          subtitle="Verified zero-key AQI integration and transparent provenance rules"
        />
        <ul className="divide-y divide-slate-200 text-sm">
          <li className="py-3 first:pt-0 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">AirLive (Primary Live Air-Quality Provider)</p>
              <a
                href="https://airlive.tracsa.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-6 px-1 rounded inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:underline"
              >
                <span>airlive.tracsa.co.in</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
            <p className="text-slate-600">
              Provides live US AQI (0–500), PM2.5, Indian city &amp; locality coverage, city rankings, and explicit ground-station counts vs. atmospheric-model attribution with 10-minute server caching and zero AQI API keys.
            </p>
          </li>
          <li className="py-3">
            <p className="font-semibold text-slate-900">Google Gemini AI Assistant</p>
            <p className="text-slate-600">
              Server-side Gemini integration grounded in retrieved AirLive measurements and your household profile; never fabricates readings when live data is unavailable.
            </p>
          </li>
          <li className="py-3 last:pb-0">
            <p className="font-semibold text-slate-900">Open-Meteo / Copernicus CAMS (CC BY 4.0)</p>
            <p className="text-slate-600">
              Supplies optional 24-hour diurnal trajectory curves for indoor ventilation window planning, strictly labeled as modeled trajectory.
            </p>
          </li>
        </ul>
      </Card>

      <Card padding="lg">
        <CardHeader
          title="Profile Deletion & Local Data Management"
          subtitle={`Active household: ${familyProfile.householdName} (stored in browser localStorage only)`}
        />
        <div className="flex flex-wrap gap-3">
          <Button variant="danger" size="md" onClick={() => setConfirmClearOpen(true)}>
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Clear personal profile &amp; history
          </Button>
          <Button variant="secondary" size="md" onClick={() => setConfirmResetOpen(true)}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Restore sample demo household
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="Clear personal profile and logged history?"
        description="This deletes your saved household details, clears all impact logs and checklists, and reverts to a minimal anonymous session."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clearPersonalData();
                setConfirmClearOpen(false);
                showSaved('Personal profile and history cleared');
              }}
            >
              Delete personal data
            </Button>
          </>
        }
      >
        <p>All saved profile entries, health sensitivity flags, and logged activities will be removed from this browser.</p>
      </Modal>

      <Modal
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Restore sample BreatheWise household?"
        description="This restores the default sample household profile, sample impact logs, and initial settings."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetAllLocalData();
                setConfirmResetOpen(false);
                showSaved('Sample demo household restored');
              }}
            >
              Restore sample data
            </Button>
          </>
        }
      >
        <p>Your current browser data will be replaced with the sample reference household.</p>
      </Modal>
    </div>
  );
}
