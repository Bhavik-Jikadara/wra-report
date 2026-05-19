import { useProjectStore } from '@/store/useProjectStore';
import type { BasemapKey } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

interface BasemapOption {
  key: BasemapKey;
  label: string;
  colors: [string, string];
  roads?: boolean;
  contour?: boolean;
  labels?: boolean;
}

const BASEMAPS: BasemapOption[] = [
  { key: 'satellite', label: 'Satellite', colors: ['#0d2137', '#1e4a7a'] },
  { key: 'hybrid',    label: 'Hybrid',    colors: ['#0d2137', '#1e4a7a'], labels: true },
  { key: 'streets',   label: 'Streets',   colors: ['#e8e4dc', '#c9b99a'], roads: true },
  { key: 'terrain',   label: 'Terrain',   colors: ['#7aad6c', '#a8d4a0'], contour: true },
];

function Thumb({ opt, active }: { opt: BasemapOption; active: boolean }) {
  const [bg, mid] = opt.colors;
  return (
    <div
      className={cn(
        'w-11 h-8 rounded overflow-hidden border transition-all',
        active ? 'border-emerald-400 ring-1 ring-emerald-400/40' : 'border-white/20',
      )}
      style={{ background: `linear-gradient(135deg, ${bg} 30%, ${mid} 100%)` }}
    >
      <div className="relative w-full h-full">
        {opt.roads && (
          <>
            <div className="absolute top-1/2 left-0 right-0 h-[1.5px] -translate-y-1/2 bg-white/50" />
            <div className="absolute top-0 bottom-0 left-1/3 w-[1px] bg-white/30" />
          </>
        )}
        {opt.contour && (
          <>
            <div className="absolute bottom-2 left-1 right-1 h-[1px] rounded bg-white/30" style={{ clipPath: 'ellipse(50% 80% at 50% 50%)' }} />
            <div className="absolute bottom-3 left-2 right-2 h-[1px] rounded bg-white/20" />
          </>
        )}
        {opt.labels && (
          <div className="absolute top-1 left-1 right-1 h-[1.5px] rounded bg-white/70" />
        )}
      </div>
    </div>
  );
}

export function BasemapSwitcher() {
  const basemap    = useProjectStore(s => s.basemap);
  const setBasemap = useProjectStore(s => s.setBasemap);

  return (
    <div className="absolute bottom-4 right-4 z-10 select-none">
      <div className="bg-black/75 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-2">
        <p className="text-[8px] font-bold uppercase tracking-widest text-white/35 px-0.5 pb-1.5">
          Basemap
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {BASEMAPS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setBasemap(opt.key)}
              className={cn(
                'flex flex-col items-center gap-1 p-1 rounded-lg transition-all',
                basemap === opt.key
                  ? 'bg-emerald-600/25 ring-1 ring-emerald-500/40'
                  : 'hover:bg-white/8',
              )}
            >
              <Thumb opt={opt} active={basemap === opt.key} />
              <span
                className={cn(
                  'text-[9px] font-medium leading-none',
                  basemap === opt.key ? 'text-emerald-300' : 'text-white/50',
                )}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
