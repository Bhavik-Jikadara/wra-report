import { useState } from 'react';
import { X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { LengthUnit, AreaUnit } from '@/lib/measurements';
import {
  LENGTH_UNITS, AREA_UNITS,
  convertLength, convertArea,
  computeLineMetrics, computePathMetrics, computePolyMetrics, computeCircleMetrics,
} from '@/lib/measurements';

export type RulerMode = 'line' | 'path' | 'polygon' | 'circle';

interface RulerPanelProps {
  mode: RulerMode;
  points: [number, number][];
  mousePos: [number, number] | null;
  onModeChange: (mode: RulerMode) => void;
  onClear: () => void;
  onClose: () => void;
}

const TABS: { id: RulerMode; label: string; hint: string }[] = [
  { id: 'line',    label: 'Line',    hint: 'Measure the distance between two points on the ground' },
  { id: 'path',    label: 'Path',    hint: 'Measure the distance between multiple points on the ground' },
  { id: 'polygon', label: 'Polygon', hint: 'Measure the distance or area of a geometric shape on the ground' },
  { id: 'circle',  label: 'Circle',  hint: 'Measure the circumference or area of a circle on the ground' },
];

const DISPLAY_LENGTH_UNITS: LengthUnit[] = ['Meters', 'Kilometers', 'Feet', 'Miles', 'Nautical Miles'];
const DISPLAY_AREA_UNITS: AreaUnit[]     = ['Sq Meters', 'Sq Kilometers', 'Hectares', 'Acres', 'Sq Miles'];

function fmt(n: number, dec = 2): string {
  if (!isFinite(n) || isNaN(n)) return '0.00';
  return n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function RulerPanel({ mode, points, mousePos, onModeChange, onClear, onClose }: RulerPanelProps) {
  const [lenUnit,  setLenUnit]  = useState<LengthUnit>('Meters');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('Acres');

  const tab = TABS.find((t) => t.id === mode)!;

  const renderMeasurements = () => {
    // ── Line ──────────────────────────────────────────────────────────────
    if (mode === 'line') {
      const start = points[0] ?? null;
      const end   = points.length > 1 ? points[1] : mousePos;
      const m = computeLineMetrics(start, end);
      return (
        <div className="space-y-2.5">
          <MRow label="Map Length"    value={fmt(convertLength(m.lengthM, lenUnit))}   rightSlot={<LenSelect unit={lenUnit} onChange={setLenUnit} />} />
          <MRow label="Ground Length" value={fmt(m.groundLengthM, 2)}                  rightSlot={<UnitBadge label="Meters" />} />
          <MRow label="Heading"       value={`${fmt(m.headingDeg)} degrees`} />
        </div>
      );
    }

    // ── Path ──────────────────────────────────────────────────────────────
    if (mode === 'path') {
      const m = computePathMetrics(points, mousePos);
      return (
        <div className="space-y-2.5">
          <MRow label="Length" value={fmt(convertLength(m.totalLengthM, lenUnit))} rightSlot={<LenSelect unit={lenUnit} onChange={setLenUnit} />} />
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <input type="checkbox" id="ruler-elevation" className="w-3 h-3 rounded accent-primary" disabled />
            <label htmlFor="ruler-elevation" className="select-none">Show Elevation Profile</label>
            <span className="text-[10px] italic opacity-60">(not available)</span>
          </div>
        </div>
      );
    }

    // ── Polygon ───────────────────────────────────────────────────────────
    if (mode === 'polygon') {
      const m = computePolyMetrics(points, mousePos);
      return (
        <div className="space-y-2.5">
          <MRow label="Perimeter" value={fmt(convertLength(m.perimeterM, lenUnit))} rightSlot={<LenSelect unit={lenUnit} onChange={setLenUnit} />} />
          <MRow label="Area"      value={fmt(convertArea(m.areaSqM, areaUnit))}    rightSlot={<AreaSelect unit={areaUnit} onChange={setAreaUnit} />} />
        </div>
      );
    }

    // ── Circle ────────────────────────────────────────────────────────────
    if (mode === 'circle') {
      const center = points[0] ?? null;
      const edge   = points.length > 1 ? points[1] : mousePos;
      const m = computeCircleMetrics(center, edge);
      return (
        <div className="space-y-2.5">
          <MRow label="Radius"        value={fmt(convertLength(m.radiusM, lenUnit))} rightSlot={<LenSelect unit={lenUnit} onChange={setLenUnit} />} />
          <MRow label="Area"          value={fmt(convertArea(m.areaSqM, areaUnit))} rightSlot={<AreaSelect unit={areaUnit} onChange={setAreaUnit} />} />
          <MRow label="Circumference" value={fmt(m.circumferenceM, 2)}              rightSlot={<UnitBadge label="Meters" />} />
        </div>
      );
    }
  };

  return (
    <div className="absolute top-16 left-3 z-20 w-[340px] bg-card rounded-lg border shadow-2xl overflow-hidden">
      {/* ── Title bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
        <span className="text-sm font-semibold tracking-tight">Ruler</span>
        <button
          onClick={onClose}
          className="w-5 h-5 bg-destructive hover:bg-destructive/80 rounded-sm flex items-center justify-center transition-colors"
        >
          <X className="w-3 h-3 text-destructive-foreground" />
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div className="flex border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onModeChange(t.id)}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-medium transition-colors border-r last:border-r-0',
              mode === t.id
                ? 'bg-background text-primary border-b-2 border-b-primary -mb-px'
                : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Hint text ─────────────────────────────────────── */}
      <div className="px-3 py-2 bg-sky-50 border-b dark:bg-sky-950/30">
        <p className="text-[11px] text-sky-700 dark:text-sky-400 italic">{tab.hint}</p>
      </div>

      {/* ── Measurements ──────────────────────────────────── */}
      <div className="px-3 py-4 min-h-[90px]">{renderMeasurements()}</div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" defaultChecked className="w-3 h-3 rounded accent-primary" />
          Mouse Navigation
        </label>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="px-3 py-1 text-[11px] border rounded bg-background/50 text-muted-foreground/40 cursor-not-allowed"
          >
            Save
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1 text-[11px] border rounded hover:bg-muted transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MRow({ label, value, rightSlot }: { label: string; value: string; rightSlot?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 text-right text-[12px] text-muted-foreground flex-shrink-0">{label}:</span>
      <span className="font-mono font-semibold text-[13px] text-foreground tabular-nums min-w-[56px]">{value}</span>
      {rightSlot && <div className="ml-auto flex-shrink-0">{rightSlot}</div>}
    </div>
  );
}

function LenSelect({ unit, onChange }: { unit: LengthUnit; onChange: (u: LengthUnit) => void }) {
  return (
    <Select value={unit} onValueChange={(v) => onChange(v as LengthUnit)}>
      <SelectTrigger className="h-6 text-[10px] w-[108px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {DISPLAY_LENGTH_UNITS.map((u) => (
          <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
        ))}
        {LENGTH_UNITS.filter(u => !DISPLAY_LENGTH_UNITS.includes(u as LengthUnit)).map((u) => (
          <SelectItem key={u} value={u} className="text-xs text-muted-foreground">{u}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AreaSelect({ unit, onChange }: { unit: AreaUnit; onChange: (u: AreaUnit) => void }) {
  return (
    <Select value={unit} onValueChange={(v) => onChange(v as AreaUnit)}>
      <SelectTrigger className="h-6 text-[10px] w-[108px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {DISPLAY_AREA_UNITS.map((u) => (
          <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
        ))}
        {AREA_UNITS.filter(u => !DISPLAY_AREA_UNITS.includes(u as AreaUnit)).map((u) => (
          <SelectItem key={u} value={u} className="text-xs text-muted-foreground">{u}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UnitBadge({ label }: { label: string }) {
  return (
    <div className="h-6 px-2 text-[10px] font-medium border rounded bg-muted/40 flex items-center text-muted-foreground w-[108px] justify-center">
      {label}
    </div>
  );
}
