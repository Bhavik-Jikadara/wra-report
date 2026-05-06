import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BoundaryUploader } from './BoundaryUploader';
import { TurbineConfigPanel } from './TurbineConfigPanel';
import { GenerateButton } from './GenerateButton';
import { EYASettingsPanel } from './EYASettingsPanel';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [width, setWidth] = useState(380);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(300, Math.min(e.clientX, 800));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <>
      <aside 
        className={cn(
          "bg-card border-r flex flex-col flex-shrink-0 z-20 shadow-lg transition-all duration-300 ease-in-out",
          "fixed inset-y-0 left-0 lg:relative lg:inset-auto",
          isOpen ? "translate-x-0 w-[85vw] sm:w-[400px] lg:w-[var(--sidebar-width)]" : "-translate-x-full lg:translate-x-0 lg:w-0 overflow-hidden"
        )}
        style={{ '--sidebar-width': `${width}px` } as React.CSSProperties}
      >
        <div className="flex items-center justify-between p-4 border-b lg:hidden">
          <h2 className="font-bold">Project Settings</h2>
          <button onClick={onToggle} className="p-1 hover:bg-muted rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <BoundaryUploader />
            <TurbineConfigPanel />
            <EYASettingsPanel />
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-card">
          <GenerateButton />
        </div>
        
        {/* Resizer Handle - only visible/active on desktop (lg) when open */}
        {isOpen && (
          <div 
            className="hidden lg:block absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-30 transition-colors"
            onMouseDown={startResizing}
          />
        )}
      </aside>

      {/* Desktop Toggle Button */}
      <button 
        onClick={onToggle}
        className={cn(
          "hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 bg-card border rounded-full p-1 shadow-md hover:bg-muted transition-all",
          isOpen ? "left-[var(--sidebar-width)] -translate-x-1/2" : "left-0"
        )}
        style={isOpen ? { left: `${width}px` } : {}}
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}