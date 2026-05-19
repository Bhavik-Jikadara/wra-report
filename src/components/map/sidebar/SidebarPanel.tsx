import { useState } from 'react';
import { Wind, ChevronLeft, ChevronRight, Bookmark, Layers } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import type { SavedPlace } from '@/store/useProjectStore';
import { LocationSearch } from './LocationSearch';
import { PlacesTree }     from './PlacesTree';
import { LayersTree }     from './LayersTree';
import { cn }             from '@/lib/utils';

interface Props {
  collapsed:     boolean;
  onToggle:      () => void;
  onFlyToCoords: (lng: number, lat: number, zoom?: number) => void;
  onFlyToPlace:  (place: SavedPlace) => void;
  onSavePlace:   (name: string, folderId: string) => void;
}

export function SidebarPanel({ collapsed, onToggle, onFlyToCoords, onFlyToPlace, onSavePlace }: Props) {
  const [savingFolderId,   setSavingFolderId]   = useState<string | null>(null);
  const [saveNameInput,    setSaveNameInput]     = useState('');
  const [showSaveInput,    setShowSaveInput]     = useState(false);

  const projectName = useProjectStore(s => s.projectName);

  const handleSaveTo = (folderId: string) => {
    setSavingFolderId(folderId);
    setSaveNameInput('');
    setShowSaveInput(true);
  };

  const commitSave = () => {
    if (savingFolderId && saveNameInput.trim()) {
      onSavePlace(saveNameInput.trim(), savingFolderId);
    }
    setSavingFolderId(null);
    setSaveNameInput('');
    setShowSaveInput(false);
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full shrink-0 transition-all duration-200',
        collapsed ? 'w-8' : 'w-64',
        'bg-[#111827] border-r border-white/8',
      )}
    >
      {/* ── App brand + collapse toggle ── */}
      <div className="flex items-center gap-2 px-2 py-2.5 border-b border-white/8 shrink-0">
        {!collapsed && (
          <>
            <Wind className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white/90 truncate leading-tight">WindEYA</p>
              <p className="text-[9px] text-white/35 truncate leading-tight">{projectName}</p>
            </div>
          </>
        )}
        <button
          onClick={onToggle}
          className="ml-auto shrink-0 rounded p-0.5 text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft  className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsed rail: icon hints to expand sidebar */}
      {collapsed && (
        <div className="flex flex-col items-center gap-3 pt-2 pb-2">
          <button
            title="My Places"
            onClick={onToggle}
            className="p-1.5 rounded text-white/30 hover:text-amber-400 hover:bg-white/8 transition-colors"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button
            title="Layers"
            onClick={onToggle}
            className="p-1.5 rounded text-white/30 hover:text-emerald-400 hover:bg-white/8 transition-colors"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      )}

      {!collapsed && (
        <>
          {/* ── Search ── */}
          <div className="shrink-0 border-b border-white/8">
            <LocationSearch onFlyTo={onFlyToCoords} />
          </div>

          {/* ── Save-place input (shown when user clicks + on a folder) ── */}
          {showSaveInput && (
            <div className="shrink-0 px-2 py-2 border-b border-white/8 bg-emerald-900/20">
              <p className="text-[9px] text-emerald-400/80 mb-1">Name this view:</p>
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={saveNameInput}
                  onChange={e => setSaveNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  commitSave();
                    if (e.key === 'Escape') { setShowSaveInput(false); setSavingFolderId(null); }
                  }}
                  placeholder="Place name…"
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={commitSave}
                  disabled={!saveNameInput.trim()}
                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[10px] text-white font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* ── Scrollable content ── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="border-b border-white/8 pb-1 mb-0.5">
              <PlacesTree
                onFlyTo={onFlyToPlace}
                onSaveTo={handleSaveTo}
                activeSaveFolder={savingFolderId}
              />
            </div>
            <LayersTree />
          </div>
        </>
      )}
    </div>
  );
}
