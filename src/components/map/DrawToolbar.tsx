import { Hexagon, Route, MousePointer2, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DrawToolbarProps {
  activeMode: string;
  onSetMode: (mode: string) => void;
}

export function DrawToolbar({ activeMode, onSetMode }: DrawToolbarProps) {
  const tools = [
    { 
      id: 'simple_select', 
      icon: MousePointer2, 
      title: 'Select & Edit',
      description: 'Move and modify existing drawings'
    },
    { 
      id: 'draw_line_string', 
      icon: Route, 
      title: 'Measure Distance',
      description: 'Click to start measuring path distance'
    },
    { 
      id: 'draw_polygon', 
      icon: Hexagon, 
      title: 'Draw Area',
      description: 'Define custom boundaries or zones'
    },
  ];

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div className="bg-card rounded-lg shadow-xl border overflow-hidden flex flex-col min-w-[50px]">
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
          <Ruler className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tools</span>
        </div>
        <TooltipProvider delayDuration={0}>
          <div className="flex flex-col">
            {tools.map(t => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSetMode(t.id)}
                    className={cn(
                      "p-3.5 transition-all flex items-center justify-center relative",
                      activeMode === t.id 
                        ? "bg-primary text-primary-foreground shadow-inner" 
                        : "hover:bg-muted text-foreground/70 hover:text-foreground"
                    )}
                  >
                    <t.icon className={cn("w-5 h-5", activeMode === t.id ? "scale-110" : "")} />
                    {activeMode === t.id && (
                      <div className="absolute left-0 top-0 w-1 h-full bg-white/30" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1 p-3">
                  <span className="font-bold text-sm">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>
      
      {/* Active Mode Label - Mobile/Desktop visibility helper */}
      <div className="bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-medium border border-white/10 shadow-lg self-start">
        Mode: {tools.find(t => t.id === activeMode)?.title || 'Custom'}
      </div>
    </div>
  );
}
