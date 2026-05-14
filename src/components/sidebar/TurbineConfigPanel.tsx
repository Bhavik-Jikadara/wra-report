import { useProjectStore } from '@/store/useProjectStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import turbineModelsData from '@/data/turbineModels.json';
import type { TurbineModel } from '@/types';
import { Minus, Plus, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef } from 'react';
import { toast } from 'sonner';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

// ── Stepper input ─────────────────────────────────────────────────────────────

function Stepper({
  value, onChange, min = 1, max = 500, step = 1,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center rounded-md border border-border overflow-hidden h-8 bg-background">
      <button
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="w-8 h-full flex items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors border-r border-border shrink-0"
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(clamp(parseInt(e.target.value) || min))}
        className="flex-1 h-full text-center text-sm font-mono font-bold bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="w-8 h-full flex items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors border-l border-border shrink-0"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Wind direction compass pill ───────────────────────────────────────────────

function CompassBadge({ deg }: { deg: number }) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const label = dirs[Math.round(deg / 45) % 8];
  return (
    <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
      {deg}° {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TurbineConfigPanel() {
  const {
    micrositingSettings, setMicrositingSettings,
    customPowerCurves, setCustomPowerCurve, clearCustomPowerCurve,
  } = useProjectStore();

  const selectedModel =
    turbineModels.find(m => m.id === micrositingSettings.turbineModelId) ?? turbineModels[0];

  const hasCustomCurve = !!customPowerCurves?.[selectedModel.id];
  const fileRef = useRef<HTMLInputElement>(null);

  // MNRE setback formula: HH + 0.5*RD + 5m
  const mnreSetback = micrositingSettings.hubHeight + 0.5 * selectedModel.rotorDiameter + 5;

  const handleCsvImport = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let startIdx = isNaN(parseFloat(lines[0]?.split(',')[0])) ? 1 : 0;
      const curve: [number, number][] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const [ws, pw] = lines[i].split(',').map(p => parseFloat(p.trim()));
        if (!isNaN(ws) && !isNaN(pw)) curve.push([ws, pw]);
      }
      if (curve.length < 2) throw new Error('Not enough data points');
      curve.sort((a, b) => a[0] - b[0]);
      setCustomPowerCurve(selectedModel.id, curve);
      toast.success('Custom power curve imported');
    } catch {
      toast.error('Invalid CSV — need two columns: Wind Speed (m/s), Power (kW)');
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Turbine count ───────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Target Turbine Count</Label>
          <span className="text-[10px] text-muted-foreground">1 – 500</span>
        </div>
        <Stepper
          value={micrositingSettings.targetCount}
          onChange={v => setMicrositingSettings({ targetCount: v })}
          min={1} max={500}
        />
        <p className="text-[10px] text-muted-foreground">
          Installed capacity: <span className="font-mono font-semibold text-foreground">
            {((micrositingSettings.targetCount * selectedModel.ratedKW) / 1000).toFixed(1)} MW
          </span>
        </p>
      </div>

      {/* ── Turbine model ───────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Turbine Model</Label>
        <Select
          value={micrositingSettings.turbineModelId}
          onValueChange={val => {
            const m = turbineModels.find(m => m.id === val);
            if (m) setMicrositingSettings({ turbineModelId: val, hubHeight: m.hubHeights[0] });
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {turbineModels.map(m => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                {m.oem} {m.model} — {(m.ratedKW / 1000).toFixed(1)} MW
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Model specs card */}
        <div className="rounded-md border bg-muted/30 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          <span className="text-muted-foreground">Rotor diameter</span>
          <span className="font-mono font-semibold text-right">{selectedModel.rotorDiameter} m</span>
          <span className="text-muted-foreground">Rated power</span>
          <span className="font-mono font-semibold text-right">{(selectedModel.ratedKW / 1000).toFixed(1)} MW</span>
          <span className="text-muted-foreground">Cut-in / Rated / Cut-out</span>
          <span className="font-mono font-semibold text-right">
            {selectedModel.cutInSpeed} / {selectedModel.ratedSpeed} / {selectedModel.cutOutSpeed} m/s
          </span>
          <span className="text-muted-foreground">IEC class</span>
          <span className="font-mono font-semibold text-right">{selectedModel.iecClass}</span>
        </div>
      </div>

      {/* ── Hub height ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Hub Height</Label>
        <div className="flex gap-1.5 flex-wrap">
          {selectedModel.hubHeights.map(hh => (
            <button
              key={hh}
              onClick={() => setMicrositingSettings({ hubHeight: hh })}
              className={cn(
                'px-3 py-1 rounded-md border text-xs font-mono font-semibold transition-colors',
                micrositingSettings.hubHeight === hh
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border text-foreground'
              )}
            >
              {hh} m
            </button>
          ))}
        </div>
      </div>

      {/* ── MNRE setback badge (always visible) ─────────────────────────── */}
      <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">MNRE Boundary Setback</p>
          <p className="text-[10px] text-blue-600 mt-0.5">HH + 0.5 × RD + 5 m</p>
        </div>
        <span className="font-mono text-sm font-bold text-blue-800">{mnreSetback.toFixed(0)} m</span>
      </div>

      {/* ── Custom power curve ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-foreground">
            {hasCustomCurve ? 'Custom Power Curve Active' : 'Default Power Curve'}
          </p>
          {hasCustomCurve && (
            <button
              onClick={() => clearCustomPowerCurve(selectedModel.id)}
              className="text-[10px] text-destructive hover:underline"
            >
              Reset to default
            </button>
          )}
        </div>
        <input
          type="file" accept=".csv" ref={fileRef} className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0];
            if (f) { await handleCsvImport(f); e.target.value = ''; }
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-[10px] font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2 py-1 rounded transition-colors"
        >
          <Upload className="w-3 h-3" /> CSV
        </button>
        {hasCustomCurve && (
          <button
            onClick={() => clearCustomPowerCurve(selectedModel.id)}
            className="p-1 hover:bg-muted rounded text-muted-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── Advanced spacing ────────────────────────────────────────────── */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="spacing" className="border rounded-md px-3">
          <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline hover:text-foreground">
            Advanced Spacing Configuration
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2 pb-3">

            {/* Crosswind spacing */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Crosswind Spacing</Label>
                <span className="text-xs font-mono font-bold text-primary">
                  {micrositingSettings.crosswindMultiple}D
                  <span className="text-muted-foreground font-normal ml-1">
                    ({(micrositingSettings.crosswindMultiple * selectedModel.rotorDiameter).toFixed(0)} m)
                  </span>
                </span>
              </div>
              <input
                type="range" min={2} max={8} step={0.5}
                value={micrositingSettings.crosswindMultiple}
                onChange={e => setMicrositingSettings({ crosswindMultiple: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>2D (min)</span><span className="text-amber-600 font-semibold">5D MNRE min</span><span>8D</span>
              </div>
            </div>

            {/* Downwind spacing */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Downwind Spacing</Label>
                <span className="text-xs font-mono font-bold text-primary">
                  {micrositingSettings.downwindMultiple}D
                  <span className="text-muted-foreground font-normal ml-1">
                    ({(micrositingSettings.downwindMultiple * selectedModel.rotorDiameter).toFixed(0)} m)
                  </span>
                </span>
              </div>
              <input
                type="range" min={3} max={12} step={0.5}
                value={micrositingSettings.downwindMultiple}
                onChange={e => setMicrositingSettings({ downwindMultiple: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>3D (min)</span><span className="text-amber-600 font-semibold">7D MNRE min</span><span>12D</span>
              </div>
            </div>

            {/* Prevailing wind direction */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Prevailing Wind Direction</Label>
                <CompassBadge deg={micrositingSettings.prevailingWindDir} />
              </div>
              <input
                type="range" min={0} max={359} step={1}
                value={micrositingSettings.prevailingWindDir}
                onChange={e => setMicrositingSettings({ prevailingWindDir: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>0° (N)</span><span>180° (S)</span><span>359°</span>
              </div>
            </div>

          </AccordionContent>
        </AccordionItem>
      </Accordion>

    </div>
  );
}
