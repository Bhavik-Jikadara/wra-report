import { Hexagon, Route, MousePointer2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawToolbarProps {
  activeMode: string;
  onSetMode: (mode: string) => void;
  onClear: () => void;
}

export function DrawToolbar({ activeMode, onSetMode }: Omit<DrawToolbarProps, 'onClear'>) {
  const tools = [
    { id: 'simple_select', icon: MousePointer2, title: 'Select/Edit' },
    { id: 'draw_line_string', icon: Route, title: 'Measure Distance/Path' },
    { id: 'draw_polygon', icon: Hexagon, title: 'Draw Project Boundary' },
    { id: 'draw_exclusion', icon: Ban, title: 'Draw Exclusion Zone (Water/Habitation)' },
  ];

  return (
    <div className="absolute top-4 left-4 z-10 bg-card rounded-md shadow-lg border overflow-hidden flex flex-col">
      <div className="flex flex-col">
        {tools.map(t => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => onSetMode(t.id)}
            className={cn(
              "p-2.5 transition-colors border-b last:border-b-0",
              activeMode === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
            )}
          >
            <t.icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
