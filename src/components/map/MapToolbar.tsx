import {
  MousePointer2, Hexagon,
  Minus, Spline, Pentagon, CircleDot,
  Bookmark, LocateFixed,
  PanelLeft, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProjectStore } from '@/store/useProjectStore';
import type { BasemapKey } from '@/store/useProjectStore';
import type { RulerMode } from './RulerPanel';

interface Props {
  activeMode:       string;
  onSetMode:        (mode: string) => void;
  isRulerOpen:      boolean;
  rulerMode:        RulerMode;
  onOpenRuler:      (mode: RulerMode) => void;
  onSavePlace:      () => void;
  onFlyToProject:   () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar:  () => void;
}

// ── Basemap thumbnail colours ──────────────────────────────────────────────
const BASEMAPS: { key: BasemapKey; label: string; bg: string }[] = [
  { key: 'satellite', label: 'Satellite', bg: 'bg-[#3a5a3a]' },
  { key: 'hybrid',    label: 'Hybrid',    bg: 'bg-[#2d4a6e]' },
  { key: 'streets',   label: 'Streets',   bg: 'bg-[#e8d5a0]' },
  { key: 'terrain',   label: 'Terrain',   bg: 'bg-[#b5c9a0]' },
];

function Divider() {
  return <span className="w-px h-5 bg-white/15 mx-1 shrink-0" />;
}

interface ToolBtnProps {
  icon:    React.ElementType;
  title:   string;
  hint:    string;
  active?: boolean;
  color?:  'primary' | 'amber';
  onClick: () => void;
}
function ToolBtn({ icon: Icon, title, hint, active, color = 'primary', onClick }: ToolBtnProps) {
  const activeClass = color === 'amber'
    ? 'bg-amber-500/80 text-white'
    : 'bg-sky-600/80 text-white';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded transition-all shrink-0',
            active ? activeClass : 'text-white/55 hover:text-white hover:bg-white/10',
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="p-2">
        <p className="font-semibold text-xs">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function MapToolbar({
  activeMode, onSetMode,
  isRulerOpen, rulerMode, onOpenRuler,
  onSavePlace, onFlyToProject,
  sidebarCollapsed, onToggleSidebar,
}: Props) {
  const basemap    = useProjectStore(s => s.basemap);
  const setBasemap = useProjectStore(s => s.setBasemap);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="shrink-0 h-10 flex items-center px-1.5 gap-0.5 bg-[#161b27] border-b border-white/10 select-none z-20">

        {/* ── Group 1: Sidebar toggle ── */}
        <ToolBtn
          icon={PanelLeft}
          title="Sidebar"
          hint={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          active={!sidebarCollapsed}
          onClick={onToggleSidebar}
        />

        <Divider />

        {/* ── Group 2: Draw tools ── */}
        <ToolBtn
          icon={MousePointer2}
          title="Select"
          hint="Select & move drawn features"
          active={!isRulerOpen && activeMode === 'simple_select'}
          onClick={() => onSetMode('simple_select')}
        />
        <ToolBtn
          icon={Hexagon}
          title="Draw Polygon"
          hint="Draw boundary or exclusion zone"
          active={!isRulerOpen && activeMode === 'draw_polygon'}
          onClick={() => onSetMode('draw_polygon')}
        />

        <Divider />

        {/* ── Group 3: Measure / Ruler tools ── */}
        <ToolBtn
          icon={Minus}
          title="Line Distance"
          hint="Measure distance between two points"
          active={isRulerOpen && rulerMode === 'line'}
          color="amber"
          onClick={() => onOpenRuler('line')}
        />
        <ToolBtn
          icon={Spline}
          title="Path Distance"
          hint="Measure distance along a multi-point path"
          active={isRulerOpen && rulerMode === 'path'}
          color="amber"
          onClick={() => onOpenRuler('path')}
        />
        <ToolBtn
          icon={Pentagon}
          title="Polygon Area"
          hint="Measure perimeter & area of a shape"
          active={isRulerOpen && rulerMode === 'polygon'}
          color="amber"
          onClick={() => onOpenRuler('polygon')}
        />
        <ToolBtn
          icon={CircleDot}
          title="Circle Area"
          hint="Measure radius & area of a circle"
          active={isRulerOpen && rulerMode === 'circle'}
          color="amber"
          onClick={() => onOpenRuler('circle')}
        />

        <Divider />

        {/* ── Group 4: Places / Navigation ── */}
        <ToolBtn
          icon={Bookmark}
          title="Save View"
          hint="Save current map view as a place"
          onClick={onSavePlace}
        />
        <ToolBtn
          icon={LocateFixed}
          title="Project Boundary"
          hint="Fly to project boundary"
          onClick={onFlyToProject}
        />

        <Divider />

        {/* ── Group 5: Basemap selector ── */}
        <span className="text-[9px] text-white/28 font-medium mr-1 tracking-wide uppercase">Base</span>
        {BASEMAPS.map(bm => (
          <Tooltip key={bm.key}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setBasemap(bm.key)}
                className={cn(
                  'w-7 h-7 rounded transition-all shrink-0 flex items-center justify-center overflow-hidden',
                  bm.bg,
                  basemap === bm.key
                    ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-[#161b27]'
                    : 'opacity-55 hover:opacity-90',
                )}
              >
                <Layers className={cn('w-3 h-3', bm.key === 'streets' ? 'text-gray-700' : 'text-white/70')} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              <p className="text-xs font-medium">{bm.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* ── Spacer + active mode label ── */}
        <div className="flex-1" />
        <span className="text-[10px] text-white/30 pr-1 font-medium tracking-wide">
          {isRulerOpen
            ? `Measure · ${rulerMode}`
            : activeMode === 'draw_polygon'
              ? 'Draw Polygon'
              : 'Select'}
        </span>
      </div>
    </TooltipProvider>
  );
}
