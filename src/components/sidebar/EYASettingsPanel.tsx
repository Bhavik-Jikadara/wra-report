import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ── Tiny labelled number input ────────────────────────────────────────────────

function NumInput({
  value, onChange, min, max, step, unit, wide = false,
}: {
  value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit?: string; wide?: boolean;
}) {
  const outOfRange = value < min || value > max;
  return (
    <div className={cn('flex items-center rounded-md border overflow-hidden h-7', outOfRange ? 'border-destructive' : 'border-border')}>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className={cn(
          'h-full text-right text-xs font-mono bg-transparent outline-none px-2',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
          wide ? 'w-20' : 'w-16',
          outOfRange && 'text-destructive'
        )}
      />
      {unit && (
        <span className="px-1.5 text-[9px] text-muted-foreground bg-muted h-full flex items-center border-l border-border shrink-0">
          {unit}
        </span>
      )}
    </div>
  );
}

// ── Availability row: shows input as % + derived loss badge ──────────────────

function AvailRow({
  label, value, onChange, min = 80, max = 100, step = 0.1,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  const loss = 100 - value;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="flex-1 text-[10px] text-muted-foreground truncate">{label}</span>
      <span className={cn(
        'text-[10px] font-mono w-12 text-right',
        loss > 5 ? 'text-red-500' : loss > 2 ? 'text-amber-500' : 'text-muted-foreground'
      )}>
        −{loss.toFixed(1)}%
      </span>
      <NumInput value={value} onChange={onChange} min={min} max={max} step={step} unit="%" />
    </div>
  );
}

// ── Direct loss row ───────────────────────────────────────────────────────────

function LossRow({
  label, value, onChange, min = 0, max = 30, step = 0.1,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="flex-1 text-[10px] text-muted-foreground truncate">{label}</span>
      <NumInput value={value} onChange={onChange} min={min} max={max} step={step} unit="%" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EYASettingsPanel() {
  const { eyaSettings, setEYASettings } = useProjectStore();
  const s = eyaSettings;
  const set = (key: keyof typeof s) => (v: number) => setEYASettings({ [key]: v });

  // Live estimated total non-wake loss (multiplicative)
  const estimatedNonWakeLoss = useMemo(() => {
    const factor =
      (s.machineAvailability / 100) *
      (s.bopAvailability / 100) *
      (s.gridAvailability / 100) *
      (s.transmissionEfficiency / 100) *
      (s.turbinePerformance / 100) *
      (1 - s.curtailmentLoss / 100) *
      (1 - s.environmentalLoss / 100);
    return (1 - factor) * 100;
  }, [s]);

  const lossColor =
    estimatedNonWakeLoss > 20 ? 'text-red-500' :
    estimatedNonWakeLoss > 12 ? 'text-amber-500' :
    'text-emerald-600';

  return (
    <div className="space-y-4">

      {/* ── Wind Resource ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Wind Resource</p>
        <div className="grid grid-cols-2 gap-2">

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Mean Wind Speed</Label>
            <div className="flex items-center gap-1">
              <input
                type="range" min={1} max={15} step={0.1}
                value={s.freeWindSpeed}
                onChange={e => set('freeWindSpeed')(parseFloat(e.target.value))}
                className="flex-1 accent-primary"
              />
              <NumInput value={s.freeWindSpeed} onChange={set('freeWindSpeed')} min={1} max={15} step={0.1} unit="m/s" wide />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Weibull k (shape)</Label>
            <NumInput value={s.weibullK} onChange={set('weibullK')} min={1} max={4} step={0.01} wide />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Air Density</Label>
            <NumInput value={s.airDensity} onChange={set('airDensity')} min={0.9} max={1.3} step={0.001} unit="kg/m³" wide />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Project Lifetime</Label>
            <NumInput value={s.projectLifetime} onChange={set('projectLifetime')} min={10} max={35} step={1} unit="yr" wide />
          </div>

        </div>
      </div>

      <div className="border-t border-border/60" />

      {/* ── Uncertainty ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Uncertainty</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="range" min={5} max={30} step={0.5}
              value={s.totalUncertainty}
              onChange={e => set('totalUncertainty')(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <NumInput value={s.totalUncertainty} onChange={set('totalUncertainty')} min={5} max={30} step={0.5} unit="%" />
        </div>
        <p className="text-[9px] text-muted-foreground leading-tight">
          1σ combined energy uncertainty used for P-value exceedance calculation.
          P90 = P50 × (1 − 1.282 × σ)
        </p>
      </div>

      <div className="border-t border-border/60" />

      {/* ── Loss Assumptions ────────────────────────────────────────────── */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">Loss Assumptions</p>
        <p className="text-[9px] text-muted-foreground mb-2">
          Availability inputs are entered as %. Loss column shows equivalent loss.
        </p>

        {/* Section: Availability */}
        <div className="rounded-md border border-border overflow-hidden">
          <div className="bg-muted/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            Availability
          </div>
          <div className="px-2 py-1 divide-y divide-border/40">
            <AvailRow label="Machine Availability" value={s.machineAvailability} onChange={set('machineAvailability')} />
            <AvailRow label="Grid Availability" value={s.gridAvailability} onChange={set('gridAvailability')} />
            <AvailRow label="BOP Availability" value={s.bopAvailability} onChange={set('bopAvailability')} min={90} />
          </div>
        </div>

        {/* Section: Performance & Electrical */}
        <div className="rounded-md border border-border overflow-hidden mt-2">
          <div className="bg-muted/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            Performance & Electrical
          </div>
          <div className="px-2 py-1 divide-y divide-border/40">
            <AvailRow label="Transmission Efficiency" value={s.transmissionEfficiency} onChange={set('transmissionEfficiency')} min={80} />
            <AvailRow label="Turbine Performance" value={s.turbinePerformance} onChange={set('turbinePerformance')} min={80} />
          </div>
        </div>

        {/* Section: Environmental & Curtailment */}
        <div className="rounded-md border border-border overflow-hidden mt-2">
          <div className="bg-muted/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            Environmental & Curtailment
          </div>
          <div className="px-2 py-1 divide-y divide-border/40">
            <LossRow label="Environmental Loss" value={s.environmentalLoss} onChange={set('environmentalLoss')} max={15} />
            <LossRow label="Curtailment Loss" value={s.curtailmentLoss} onChange={set('curtailmentLoss')} max={20} />
          </div>
        </div>

        {/* Live total non-wake loss */}
        <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 border border-border px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold text-foreground">Estimated Non-Wake Loss</p>
            <p className="text-[9px] text-muted-foreground">Multiplicative — excludes wake (computed by optimizer)</p>
          </div>
          <span className={cn('text-base font-bold font-mono', lossColor)}>
            {estimatedNonWakeLoss.toFixed(1)}%
          </span>
        </div>

      </div>
    </div>
  );
}
