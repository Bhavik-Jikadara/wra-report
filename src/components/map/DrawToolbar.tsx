import { Hexagon, MousePointer2, Minus, Spline, Pentagon, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { RulerMode } from './RulerPanel';

interface DrawToolbarProps {
  activeMode: string;
  onSetMode: (mode: string) => void;
  isRulerOpen: boolean;
  rulerMode: RulerMode;
  onOpenRuler: (mode: RulerMode) => void;
}

const drawTools = [
  {
    id: 'simple_select',
    icon: MousePointer2,
    title: 'Select',
    description: 'Select & move features',
  },
  {
    id: 'draw_polygon',
    icon: Hexagon,
    title: 'Draw',
    description: 'Draw boundary or exclusion zone',
  },
] as const;

const rulerTools: { id: RulerMode; icon: React.ElementType; title: string; description: string }[] = [
  { id: 'line',    icon: Minus,    title: 'Line',    description: 'Measure distance between two points' },
  { id: 'path',    icon: Spline,   title: 'Path',    description: 'Measure distance along a multi-point path' },
  { id: 'polygon', icon: Pentagon, title: 'Polygon', description: 'Measure perimeter & area of a shape' },
  { id: 'circle',  icon: Circle,   title: 'Circle',  description: 'Measure radius & area of a circle' },
];

export function DrawToolbar({ activeMode, onSetMode, isRulerOpen, rulerMode, onOpenRuler }: DrawToolbarProps) {
  const activeDrawLabel  = drawTools.find((t) => t.id === activeMode)?.title;
  const activeRulerLabel = isRulerOpen ? rulerTools.find((t) => t.id === rulerMode)?.title : null;
  const activeLabel      = activeRulerLabel ?? activeDrawLabel ?? 'Select';

  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute top-3 left-3 z-10 flex items-center gap-0.5 bg-black/70 backdrop-blur-md rounded-full px-1.5 py-1.5 border border-white/10 shadow-lg">

        {/* Draw tools */}
        {drawTools.map((t, idx) => (
          <span key={t.id} className="flex items-center">
            {idx > 0 && <span className="w-px h-4 bg-white/15 mx-1 flex-shrink-0" />}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSetMode(t.id)}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0',
                    !isRulerOpen && activeMode === t.id
                      ? 'bg-primary text-white shadow-inner'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  )}
                >
                  <t.icon className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="p-2">
                <p className="font-semibold text-xs">{t.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
              </TooltipContent>
            </Tooltip>
          </span>
        ))}

        {/* Divider */}
        <span className="w-px h-4 bg-white/15 mx-1 flex-shrink-0" />

        {/* Ruler mode buttons */}
        {rulerTools.map((t, idx) => (
          <span key={t.id} className="flex items-center">
            {idx > 0 && <span className="w-px h-3.5 bg-white/10 mx-0.5 flex-shrink-0" />}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onOpenRuler(t.id)}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0',
                    isRulerOpen && rulerMode === t.id
                      ? 'bg-amber-500 text-white shadow-inner'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  )}
                >
                  <t.icon className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="p-2">
                <p className="font-semibold text-xs">{t.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
              </TooltipContent>
            </Tooltip>
          </span>
        ))}

        {/* Active mode label */}
        <span className="w-px h-4 bg-white/15 mx-1 flex-shrink-0" />
        <span className="text-[10px] text-white/50 pr-1.5 font-medium select-none">{activeLabel}</span>
      </div>
    </TooltipProvider>
  );
}
