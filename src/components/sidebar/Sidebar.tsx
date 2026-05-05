import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BoundaryUploader } from './BoundaryUploader';
import { TurbineConfigPanel } from './TurbineConfigPanel';
import { GenerateButton } from './GenerateButton';
import { EYASettingsPanel } from './EYASettingsPanel';

export function Sidebar() {
  const [width, setWidth] = useState(380);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // const newWidth = e.clientX; // Assuming sidebar is on the left
      // To prevent it from getting too small or too large:
      const newWidth = Math.max(300, Math.min(e.clientX, 800));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto'; // Re-enable text selection
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
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
  };

  return (
    <aside 
      className="w-full lg:w-[var(--sidebar-width)] h-auto max-h-[40vh] lg:max-h-none lg:h-full bg-card border-r lg:border-r border-b lg:border-b-0 flex flex-col flex-shrink-0 z-10 shadow-lg relative transition-none"
      style={{ '--sidebar-width': `${width}px` } as React.CSSProperties}
    >
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <BoundaryUploader />
          <TurbineConfigPanel />
          <EYASettingsPanel />
        </div>
      </ScrollArea>
      <GenerateButton />
      
      {/* Resizer Handle - only visible/active on desktop (lg) */}
      <div 
        className="hidden lg:block absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-20 transition-colors"
        onMouseDown={startResizing}
        style={{ transform: 'translateX(50%)' }}
      />
    </aside>
  );
}