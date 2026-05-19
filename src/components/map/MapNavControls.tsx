import { Plus, Minus, Compass, LocateFixed } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  bearing:       number;
  pitch:         number;
  onZoomIn:      () => void;
  onZoomOut:     () => void;
  onResetNorth:  () => void;
  onFlyToProject:() => void;
}

export function MapNavControls({ bearing, onZoomIn, onZoomOut, onResetNorth, onFlyToProject }: Props) {
  const isNorth = Math.abs(bearing) < 1;

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-center gap-1.5 select-none">

      {/* Compass rose */}
      <button
        onClick={onResetNorth}
        title="Reset north"
        className={cn(
          'w-10 h-10 rounded-full border shadow-xl flex items-center justify-center transition-all',
          'bg-black/70 backdrop-blur-sm',
          isNorth ? 'border-white/15' : 'border-emerald-500/50',
        )}
        style={{ transform: `rotate(${-bearing}deg)` }}
      >
        <svg viewBox="0 0 40 40" className="w-8 h-8">
          {/* Outer ring */}
          <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          {/* North arrow — red */}
          <polygon points="20,4 22.5,20 20,18 17.5,20" fill="#ef4444" opacity="0.9" />
          {/* South arrow — white */}
          <polygon points="20,36 22.5,20 20,22 17.5,20" fill="rgba(255,255,255,0.35)" />
          {/* Center dot */}
          <circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.6)" />
          {/* N label */}
          <text x="20" y="13" textAnchor="middle" fontSize="5" fill="#ef4444" fontWeight="bold" fontFamily="sans-serif">N</text>
        </svg>
      </button>

      {/* Zoom controls */}
      <div className="flex flex-col bg-black/70 backdrop-blur-sm border border-white/12 rounded-lg overflow-hidden shadow-xl">
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="w-8 h-8 flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors border-b border-white/8"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="w-8 h-8 flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Fly to project */}
      <button
        onClick={onFlyToProject}
        title="Center on project"
        className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-sm border border-white/12 shadow-xl flex items-center justify-center text-white/55 hover:text-emerald-400 hover:border-emerald-500/40 transition-all"
      >
        <LocateFixed className="w-4 h-4" />
      </button>

      {/* Bearing indicator (shows when rotated) */}
      {!isNorth && (
        <div className="bg-black/60 backdrop-blur-sm border border-white/12 rounded px-1.5 py-0.5 shadow-lg">
          <span className="text-[9px] font-mono text-emerald-300">
            {Math.round(bearing < 0 ? bearing + 360 : bearing)}°
          </span>
        </div>
      )}

      {/* Compass icon button (shortcut to open full controls) */}
      <button
        onClick={onResetNorth}
        className={cn(
          'w-8 h-8 rounded-lg bg-black/70 backdrop-blur-sm border shadow-xl flex items-center justify-center transition-all',
          isNorth ? 'border-white/12 text-white/40' : 'border-emerald-500/40 text-emerald-400',
        )}
        title="Reset north"
      >
        <Compass className="w-4 h-4" />
      </button>
    </div>
  );
}
