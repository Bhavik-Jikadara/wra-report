import { Wind } from 'lucide-react';

export function Header() {
  return (
    <header className="h-14 border-b bg-card text-card-foreground flex items-center px-4 justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-2">
        <div className="bg-primary text-primary-foreground p-1.5 rounded">
          <Wind className="w-5 h-5" />
        </div>
        <h1 className="font-semibold text-lg tracking-tight">WindMicro EYA</h1>
      </div>
      
      <div className="flex items-center gap-4 text-sm font-medium">
        <div className="flex items-center gap-2 text-primary">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">1</div>
          <span>Upload</span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">2</div>
          <span>Configure</span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">3</div>
          <span>Microsite</span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">4</div>
          <span>Report</span>
        </div>
      </div>
      
      <div>
        {/* Theme toggle could go here */}
      </div>
    </header>
  );
}
