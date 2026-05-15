import { useState } from 'react';
import {
  FolderOpen, Wind, Trash2, FolderInput, Pencil, Check, X,
  BarChart3, Zap, CalendarDays, AlertTriangle,
} from 'lucide-react';
import { useProjectHistoryStore, type ProjectSnapshot } from '@/store/useProjectHistoryStore';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatChip({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md bg-muted/60 px-2 py-1.5 min-w-0">
      {icon && <span className="text-muted-foreground mb-0.5">{icon}</span>}
      <span className="text-[10px] font-mono font-bold text-foreground leading-tight truncate">{value}</span>
      <span className="text-[8px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

interface CardProps {
  snap: ProjectSnapshot;
  onLoad: (snap: ProjectSnapshot) => void;
  onDelete: (id: string) => void;
}

function ProjectCard({ snap, onLoad, onDelete }: CardProps) {
  const renameProject = useProjectHistoryStore(s => s.renameProject);
  const [editing, setEditing]   = useState(false);
  const [nameVal, setNameVal]   = useState(snap.name);
  const [confirmDel, setConfirmDel] = useState(false);

  const commitRename = () => {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== snap.name) {
      renameProject(snap.id, trimmed);
      toast.success('Project renamed');
    } else {
      setNameVal(snap.name);
    }
    setEditing(false);
  };

  return (
    <>
      <div className="group bg-card rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden">

        {/* ── Card header ── */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 pt-4 pb-3 border-b">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Wind className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={nameVal}
                    onChange={e => setNameVal(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') { setNameVal(snap.name); setEditing(false); }
                    }}
                    className="flex-1 text-sm font-semibold bg-transparent border-b-2 border-primary outline-none min-w-0 text-foreground"
                  />
                  <button onClick={commitRename} className="text-primary shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setNameVal(snap.name); setEditing(false); }} className="text-muted-foreground shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setNameVal(snap.name); setEditing(true); }}
                  className="flex items-center gap-1 group/name text-left w-full"
                  title="Click to rename"
                >
                  <span className="text-sm font-semibold text-foreground truncate">{snap.name}</span>
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <CalendarDays className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground">{fmtDate(snap.savedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="px-4 py-3 flex-1">
          <div className="grid grid-cols-4 gap-1.5">
            <StatChip label="WTGs" value={`${snap.turbineCount}`} icon={<Wind className="w-3 h-3" />} />
            <StatChip label="Capacity" value={`${snap.capacityMW} MW`} icon={<Zap className="w-3 h-3" />} />
            <StatChip label="Net AEP" value={snap.netAepGwh != null ? `${snap.netAepGwh} GWh` : '—'} icon={<BarChart3 className="w-3 h-3" />} />
            <StatChip label="PLF" value={snap.plfPct != null ? `${snap.plfPct}%` : '—'} />
          </div>

          {/* Wind direction + model info */}
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
            <span className="bg-muted rounded px-1.5 py-0.5 font-mono">
              Wind {snap.micrositingSettings.prevailingWindDir}°
            </span>
            <span className="bg-muted rounded px-1.5 py-0.5 font-mono capitalize truncate max-w-[140px]">
              {snap.micrositingSettings.turbineModelId.replace(/-/g, ' ')}
            </span>
            <span className="bg-muted rounded px-1.5 py-0.5 font-mono">
              HH {snap.micrositingSettings.hubHeight} m
            </span>
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="px-4 py-3 border-t bg-muted/20 flex items-center gap-2">
          <button
            onClick={() => onLoad(snap)}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            <FolderInput className="w-3.5 h-3.5" />
            Load Project
          </button>
          <button
            onClick={() => setConfirmDel(true)}
            title="Delete project"
            className="p-2 rounded-md border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <DialogTitle className="text-base">Delete project?</DialogTitle>
            </div>
            <DialogDescription>
              <span className="font-semibold text-foreground">{snap.name}</span> will be permanently removed
              from history. The map data will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setConfirmDel(false)}
              className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onDelete(snap.id); setConfirmDel(false); }}
              className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface ProjectHistoryPageProps {
  onViewChange: (view: 'map' | 'report' | 'projects') => void;
}

export function ProjectHistoryPage({ onViewChange }: ProjectHistoryPageProps) {
  const projects      = useProjectHistoryStore(s => s.projects);
  const deleteProject = useProjectHistoryStore(s => s.deleteProject);
  const restoreProject = useProjectStore(s => s.restoreProject);

  const [search, setSearch] = useState('');

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLoad = (snap: ProjectSnapshot) => {
    restoreProject({
      projectId: snap.id,
      projectName: snap.name,
      projectBoundary: snap.projectBoundary,
      exclusionZones: snap.exclusionZones,
      mapFeatures: snap.mapFeatures,
      turbines: snap.turbines,
      externalTurbines: snap.externalTurbines,
      eyaSettings: snap.eyaSettings,
      micrositingSettings: snap.micrositingSettings,
      customPowerCurves: snap.customPowerCurves,
    });
    toast.success(`Loaded "${snap.name}"`);
    onViewChange('map');
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
    toast.success('Project removed from history');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">

      {/* ── Page header ── */}
      <div className="border-b bg-card px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Project History</h1>
              <p className="text-xs text-muted-foreground">
                {projects.length === 0
                  ? 'No projects saved yet'
                  : `${projects.length} saved project${projects.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {projects.length > 0 && (
            <input
              type="search"
              placeholder="Search projects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-64 px-3 py-1.5 text-sm border rounded-md bg-background outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6">
        {projects.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">No projects yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Projects are automatically saved to history each time you generate a micrositing layout.
                Head to the map and generate your first layout to get started.
              </p>
            </div>
            <button
              onClick={() => onViewChange('map')}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Wind className="w-4 h-4" />
              Go to Map
            </button>
          </div>
        ) : filtered.length === 0 ? (
          /* Search no results */
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <p className="text-muted-foreground text-sm">No projects match <strong>"{search}"</strong></p>
            <button onClick={() => setSearch('')} className="text-xs text-primary hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          /* Project grid */
          <div className={cn(
            'grid gap-4',
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          )}>
            {filtered.map(snap => (
              <ProjectCard
                key={snap.id}
                snap={snap}
                onLoad={handleLoad}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
