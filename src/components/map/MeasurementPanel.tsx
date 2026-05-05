import { useState } from 'react';
import { LENGTH_UNITS, AREA_UNITS, convertLength, convertArea } from '@/lib/measurements';
import type { LengthUnit, AreaUnit } from '@/lib/measurements';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ruler, Trash2 } from 'lucide-react';

interface MeasurementPanelProps {
  perimeterMeters: number;
  areaSqMeters: number;
  radiusMeters: number;
  featureType: string | null;
  onClear: () => void;
  onSetBoundary?: () => void;
  onSetExclusion?: () => void;
}

export function MeasurementPanel({ 
  perimeterMeters, 
  areaSqMeters, 
  radiusMeters, 
  featureType, 
  onClear,
  onSetBoundary,
  onSetExclusion
}: MeasurementPanelProps) {
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>('Meters');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('Sq Meters');

  if (!featureType) return null;

  const showArea = areaSqMeters > 0;
  const showRadius = radiusMeters > 0;
  const isPolygon = featureType === 'Polygon' || featureType === 'MultiPolygon';
  
  const convertedLength = convertLength(perimeterMeters, lengthUnit);
  const convertedArea = convertArea(areaSqMeters, areaUnit);
  const convertedRadius = convertLength(radiusMeters, lengthUnit);

  const formatNumber = (num: number) => {
    if (num < 0.01) return num.toExponential(2);
    if (num > 1000000) return num.toExponential(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-card rounded-md shadow-lg border overflow-hidden flex flex-col">
      <div className="px-4 py-2 bg-muted/50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ruler className="w-4 h-4 text-primary" />
          Measurements
        </div>
        <button onClick={onClear} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive" title="Clear all drawings">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {isPolygon && (
          <div className="grid grid-cols-2 gap-2 pb-2 border-b">
            <button
              onClick={onSetBoundary}
              className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-colors"
            >
              Set Boundary
            </button>
            <button
              onClick={onSetExclusion}
              className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20 rounded hover:bg-destructive/20 transition-colors"
            >
              Set Exclusion
            </button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {showArea ? 'Perimeter / Circumference' : 'Length / Distance'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-mono text-lg font-bold flex-1 truncate" title={formatNumber(convertedLength)}>
              {formatNumber(convertedLength)}
            </div>
            <Select value={lengthUnit} onValueChange={(val) => setLengthUnit(val as LengthUnit)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
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
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Radius</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-lg font-bold flex-1 truncate" title={formatNumber(convertedRadius)}>
                {formatNumber(convertedRadius)}
              </div>
              <div className="w-[120px] px-3 py-1.5 text-xs border rounded-md bg-muted/50 text-muted-foreground truncate">
                {lengthUnit}
              </div>
            </div>
          </div>
        )}

        {showArea && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Area</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-lg font-bold flex-1 truncate" title={formatNumber(convertedArea)}>
                {formatNumber(convertedArea)}
              </div>
              <Select value={areaUnit} onValueChange={(val) => setAreaUnit(val as AreaUnit)}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
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
  );
}
