import type React from 'react';
import type {
  BaselineVehicleMode,
  SustainableTransitMode,
} from '../../domain/impactCalculator';
import type { ImpactLogEntry } from '../../types/breathewise';
import { parseBoundedInt } from '../../utils/number';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Selector } from '../ui/Selector';

interface EditImpactModalProps {
  editingEntry: ImpactLogEntry | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  editTitle: string;
  onChangeTitle: (value: string) => void;
  editDate: string;
  onChangeDate: (value: string) => void;
  editBaselineMode: BaselineVehicleMode;
  onChangeBaselineMode: (value: BaselineVehicleMode) => void;
  editChosenMode: SustainableTransitMode;
  onChangeChosenMode: (value: SustainableTransitMode) => void;
  editDistanceKm: number;
  onChangeDistanceKm: (value: number) => void;
  editAssumptions: string;
  onChangeAssumptions: (value: string) => void;
  editError: string | null;
}

export function EditImpactModal({
  editingEntry,
  onClose,
  onSubmit,
  editTitle,
  onChangeTitle,
  editDate,
  onChangeDate,
  editBaselineMode,
  onChangeBaselineMode,
  editChosenMode,
  onChangeChosenMode,
  editDistanceKm,
  onChangeDistanceKm,
  editAssumptions,
  onChangeAssumptions,
  editError,
}: EditImpactModalProps) {
  return (
    <Modal
      open={editingEntry !== null}
      onClose={onClose}
      title="Edit Logged Action"
      description={
        editingEntry?.category === 'transport_shift'
          ? 'Updating mode or distance automatically recalculates CO2e and fuel displaced.'
          : 'Update title, date, or recorded assumptions.'
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-impact-form" variant="primary" size="sm">
            Save changes
          </Button>
        </>
      }
    >
      {editingEntry && (
        <form id="edit-impact-form" onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input
            label="Action title"
            value={editTitle}
            errorText={editError ?? undefined}
            onChange={(e) => onChangeTitle(e.target.value)}
            maxLength={140}
            required
          />
          <Input
            label="Date"
            type="date"
            value={editDate}
            onChange={(e) => onChangeDate(e.target.value)}
            required
          />

          {editingEntry.category === 'transport_shift' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Selector
                label="Baseline vehicle"
                value={editBaselineMode}
                onChange={onChangeBaselineMode}
                options={[
                  { value: 'petrol_car', label: 'Petrol Car' },
                  { value: 'diesel_car', label: 'Diesel Car' },
                  { value: 'two_wheeler', label: 'Two-Wheeler' },
                ]}
              />
              <Selector
                label="Chosen mode"
                value={editChosenMode}
                onChange={onChangeChosenMode}
                options={[
                  { value: 'metro_rail', label: 'Metro Rail' },
                  { value: 'public_bus', label: 'Public Bus' },
                  { value: 'carpool', label: 'Carpool' },
                  { value: 'walk_cycle', label: 'Walk / Cycle' },
                  { value: 'work_from_home', label: 'Work from Home' },
                ]}
              />
              <Input
                label="Distance (km)"
                type="number"
                min={1}
                max={500}
                value={editDistanceKm}
                onChange={(e) => onChangeDistanceKm(parseBoundedInt(e.target.value, 1, 500, 1))}
              />
            </div>
          )}

          <Input
            label="Assumptions / notes"
            value={editAssumptions}
            onChange={(e) => onChangeAssumptions(e.target.value)}
            maxLength={400}
          />
        </form>
      )}
    </Modal>
  );
}

export function MethodologyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transparent Calculation Methodology"
      description="Documented emission factors & strict attribution boundaries"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          Transport emission factors use urban India passenger-km midpoint estimates (India GHG
          Program / Shakti Sustainable Energy Foundation):
        </p>
        <ul className="list-disc pl-5 space-y-1 font-mono text-xs text-slate-700">
          <li>Petrol Car: 140 g CO2e/pkm (assumed 14 km/L fuel economy)</li>
          <li>Diesel Car: 135 g CO2e/pkm (assumed 16 km/L fuel economy)</li>
          <li>Two-Wheeler: 50 g CO2e/pkm (assumed 45 km/L fuel economy)</li>
          <li>3-Person Carpool: 47 g CO2e/pkm</li>
          <li>Public City Bus: 40 g CO2e/pkm</li>
          <li>Metro / Urban Electric Rail: 35 g CO2e/pkm</li>
          <li>Walk / Cycle / Work from Home: 0 g CO2e/pkm direct tailpipe</li>
        </ul>
        <p>
          <strong>Three Separate Pillars:</strong> Avoided tailpipe emissions (Pillar A), pollution
          exposure-management habits (Pillar B: <strong>0 g CO2e claimed</strong>), and household
          sustainability actions (Pillar C) are never blended together or reported as a measured
          reduction in city-wide AQI.
        </p>
      </div>
    </Modal>
  );
}
