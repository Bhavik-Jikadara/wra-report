import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BoundaryUploader } from './BoundaryUploader';
import { TurbineConfigPanel } from './TurbineConfigPanel';
import { GenerateButton } from './GenerateButton';
import { EYASettingsPanel } from './EYASettingsPanel';
import { ExternalDataPanel } from './ExternalDataPanel';
import {
  X, ChevronLeft, ChevronRight, Wind,
  Map, Settings2, BarChart3, Layers, Pencil, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import turbineModelsData from '@/data/turbineModels.json';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

// ── Section header (always visible, no collapse) ──────────────────────────────

interface SectionProps {
  step: number;
  title: string;
  icon: React.ReactNode;
  done?: boolean;
  optional?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ step, title, icon, done, optional, badge, children }: SectionProps) {
  return (
    <div className="space-y-2">
      {/* Section label row */}
      <div className="flex items-center gap-2">
        {/* Step circle */}
        <div className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border',
          done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'bg-muted border-border text-muted-foreground'
        )}>
          {done ? <Check className="w-3 h-3" /> : step}
        </div>

        {/* Icon + title */}
        <span className="flex items-center gap-1.5 flex-1 min-w-0">
          {icon}
          <span className="text-xs font-bold text-foreground truncate">{title}</span>
          {optional && (
            <span className="text-[8px] uppercase tracking-wide text-muted-foreground bg-muted px-1 py-0.5 rounded ml-1 shrink-0">
              optional
            </span>
          )}
        </span>

        {/* Badge */}
        {badge}
      </div>

      {/* Content — always visible */}
      <div className="pl-7">
        {children}
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [width, setWidth] = useState(380);
  const isResizing = useRef(false);

  const {
    turbines, micrositingSettings, projectBoundary,
    externalTurbines, mapFeatures,
    projectName, setProjectName,
  } = useProjectStore();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(projectName);

  // Dirty-state: settings changed after turbines were placed
  const settingsSnapshot = useRef('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const key = JSON.stringify(micrositingSettings);
    if (turbines.length > 0) {
      if (settingsSnapshot.current && settingsSnapshot.current !== key) {
        setIsDirty(true);
      }
    } else {
      setIsDirty(false);
    }
    settingsSnapshot.current = key;
  }, [micrositingSettings, turbines.length]);

  const handleGenerated = () => {
    settingsSnapshot.current = JSON.stringify(micrositingSettings);
    setIsDirty(false);
  };

  const selectedModel = (turbineModelsData as any[]).find(
    (m: any) => m.id === micrositingSettings.turbineModelId
  ) ?? turbineModelsData[0];

  const totalCapacityMW = turbines.length > 0
    ? ((turbines.length * (selectedModel as any).ratedKW) / 1000).toFixed(1)
    : null;

  const constraintCount = externalTurbines.length + (mapFeatures?.features.length ?? 0);

  // Resizer
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setWidth(Math.max(300, Math.min(e.clientX, 800)));
    };
    const onUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const commitName = () => {
    setProjectName(nameInput.trim() || 'New Wind Farm Project');
    setEditingName(false);
  };

  return (
    <>
      <aside
        className={cn(
          'bg-card border-r flex flex-col flex-shrink-0 z-20 shadow-sm',
          'transition-all duration-300 ease-in-out',
          'fixed inset-y-0 left-0 lg:relative lg:inset-auto',
          isOpen
            ? 'translate-x-0 w-[85vw] sm:w-[400px] lg:w-[var(--sidebar-width)]'
            : '-translate-x-full lg:translate-x-0 lg:w-0 overflow-hidden'
        )}
        style={{ '--sidebar-width': `${width}px` } as React.CSSProperties}
      >

        {/* ── Project header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-card shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Wind className="w-4 h-4 text-primary" />
          </div>

          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') { setNameInput(projectName); setEditingName(false); }
              }}
              className="flex-1 min-w-0 text-sm font-bold bg-transparent border-b-2 border-primary outline-none text-foreground"
            />
          ) : (
            <button
              onClick={() => { setNameInput(projectName); setEditingName(true); }}
              className="flex-1 min-w-0 text-left flex items-center gap-1.5 group"
              title="Click to rename"
            >
              <span className="text-sm font-bold truncate text-foreground">{projectName}</span>
              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}

          <button onClick={onToggle} className="lg:hidden p-1 hover:bg-muted rounded-md shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable panels ──────────────────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-5">

            {/* Divider helper */}
            <div className="border-t border-border/50" />

            {/* 1 — Project Boundary */}
            <Section
              step={1}
              title="Project Boundary"
              icon={<Map className="w-3.5 h-3.5 text-primary shrink-0" />}
              done={!!projectBoundary}
              badge={
                projectBoundary ? (
                  <span className="text-[9px] font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded shrink-0">
                    1 file
                  </span>
                ) : undefined
              }
            >
              <BoundaryUploader />
            </Section>

            <div className="border-t border-border/50" />

            {/* 2 — Constraints */}
            <Section
              step={2}
              title="Constraints & External Data"
              icon={<Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              done={constraintCount > 0}
              optional
              badge={
                constraintCount > 0 ? (
                  <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
                    {constraintCount} items
                  </span>
                ) : undefined
              }
            >
              <ExternalDataPanel />
            </Section>

            <div className="border-t border-border/50" />

            {/* 3 — Turbine Config */}
            <Section
              step={3}
              title="Turbine Configuration"
              icon={<Settings2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              badge={
                <span className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                  {micrositingSettings.targetCount} WTG
                </span>
              }
            >
              <TurbineConfigPanel />
            </Section>

            <div className="border-t border-border/50" />

            {/* 4 — EYA Parameters */}
            <Section
              step={4}
              title="EYA Parameters"
              icon={<BarChart3 className="w-3.5 h-3.5 text-primary shrink-0" />}
              badge={
                <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
                  {micrositingSettings.prevailingWindDir}°
                </span>
              }
            >
              <EYASettingsPanel />
            </Section>

            {/* Bottom padding so last section isn't flush against footer */}
            <div className="h-2" />
          </div>
        </ScrollArea>

        {/* ── Sticky footer ──────────────────────────────────────────── */}
        <div className="border-t bg-card shrink-0">

          {/* Quick stats — only when turbines placed */}
          {turbines.length > 0 && (
            <div className="px-3 pt-2.5 pb-1 grid grid-cols-3 gap-1.5 text-center">
              {[
                { label: 'Placed', val: `${turbines.length} WTG` },
                { label: 'Capacity', val: `${totalCapacityMW} MW` },
                { label: 'Target', val: `${micrositingSettings.targetCount} WTG` },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-md bg-muted/60 py-1.5 px-1">
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                  <p className="text-xs font-bold text-foreground leading-tight mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          )}

          {/* Dirty-state banner */}
          {isDirty && turbines.length > 0 && (
            <div className="mx-3 mt-1.5 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              <span className="text-[10px] text-amber-700 font-medium leading-tight">
                Settings changed — regenerate to update layout
              </span>
            </div>
          )}

          <div className="p-3 pt-2">
            <GenerateButton onGenerated={handleGenerated} />
          </div>
        </div>

        {/* Resize handle (desktop) */}
        {isOpen && (
          <div
            className="hidden lg:block absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-30 transition-colors"
            onMouseDown={e => {
              e.preventDefault();
              isResizing.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
          />
        )}
      </aside>

      {/* Desktop collapse toggle */}
      <button
        onClick={onToggle}
        className={cn(
          'hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30',
          'bg-card border rounded-full p-1 shadow-md hover:bg-muted transition-all',
          isOpen ? 'left-[var(--sidebar-width)] -translate-x-1/2' : 'left-0'
        )}
        style={isOpen ? { left: `${width}px` } : {}}
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}
