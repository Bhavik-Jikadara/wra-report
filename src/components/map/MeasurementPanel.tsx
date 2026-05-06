import { useState } from 'react';
import { LENGTH_UNITS, AREA_UNITS, convertLength, convertArea } from '@/lib/measurements';
import type { LengthUnit, AreaUnit } from '@/lib/measurements';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Map, Ban, Waves, Home, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MeasurementPanelProps {
  perimeterMeters: number;
  areaSqMeters: number;
  radiusMeters: number;
  featureType: string | null;
  onClear: () => void;
  onSetBoundary?: () => void;
  onSetExclusion?: () => void;
  onSetFeature?: (type: string) => void;
}

export function MeasurementPanel({ 
  perimeterMeters, 
  areaSqMeters, 
  radiusMeters, 
  featureType, 
  onClear,
  onSetBoundary,
  onSetExclusion,
  onSetFeature
}: MeasurementPanelProps) {
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>('Meters');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('Sq Meters');

  if (!featureType) return null;

  const showArea = areaSqMeters > 0;
  const showRadius = radiusMeters > 0;
  
  const convertedLength = convertLength(perimeterMeters, lengthUnit);
  const convertedArea = convertArea(areaSqMeters, areaUnit);
  const convertedRadius = convertLength(radiusMeters, lengthUnit);

  const formatNumber = (num: number) => {
    if (num < 0.01) return num.toExponential(2);
    if (num > 1000000) return num.toExponential(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const actionButtons = [
    { label: 'Boundary', icon: Map, color: 'text-primary bg-primary/10 border-primary/20 hover:bg-primary/20', onClick: onSetBoundary },
    { label: 'Exclusion', icon: Ban, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20', onClick: onSetExclusion },
    { label: 'Water', icon: Waves, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20', onClick: () => onSetFeature?.('water') },
    { label: 'Habitation', icon: Home, color: 'text-red-500 bg-red-500/10 border-red-500/20 hover:bg-red-500/20', onClick: () => onSetFeature?.('dwelling') },
  ];

  return (
    <div className="absolute top-4 right-4 z-10 w-[calc(100vw-32px)] sm:w-80 bg-card rounded-xl shadow-2xl border overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <div className="p-1 bg-primary/20 rounded">
            <Maximize2 className="w-4 h-4 text-primary" />
          </div>
          Active Selection
        </div>
        <button 
          onClick={onClear} 
          className="p-1.5 hover:bg-destructive/10 rounded-full text-muted-foreground hover:text-destructive transition-colors" 
          title="Clear all drawings"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {actionButtons.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-3 border rounded-lg transition-all active:scale-95 group",
                btn.color
              )}
            >
              <btn.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4 pt-2 border-t">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {showArea ? 'Perimeter' : 'Distance'}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-lg border">
              <div className="font-mono text-lg font-bold flex-1 truncate text-primary" title={formatNumber(convertedLength)}>
                {formatNumber(convertedLength)}
              </div>
              <Select value={lengthUnit} onValueChange={(val) => setLengthUnit(val as LengthUnit)}>
                <SelectTrigger className="w-[100px] h-7 text-[10px] font-bold bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LENGTH_UNITS.map(unit => (
                    <SelectItem key={unit} value={unit} className="text-xs">{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showRadius && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Radius</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-lg border">
                <div className="font-mono text-lg font-bold flex-1 truncate text-primary" title={formatNumber(convertedRadius)}>
                  {formatNumber(convertedRadius)}
                </div>
                <div className="w-[100px] px-2 py-1 text-[10px] font-bold text-center border rounded bg-background/50 text-muted-foreground truncate uppercase">
                  {lengthUnit}
                </div>
              </div>
            </div>
          )}

          {showArea && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Area</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-lg border">
                <div className="font-mono text-lg font-bold flex-1 truncate text-primary" title={formatNumber(convertedArea)}>
                  {formatNumber(convertedArea)}
                </div>
                <Select value={areaUnit} onValueChange={(val) => setAreaUnit(val as AreaUnit)}>
                  <SelectTrigger className="w-[100px] h-7 text-[10px] font-bold bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREA_UNITS.map(unit => (
                      <SelectItem key={unit} value={unit} className="text-xs">{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
