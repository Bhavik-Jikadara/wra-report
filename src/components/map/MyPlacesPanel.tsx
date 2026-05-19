import { useState } from 'react';
import { Bookmark, Plus, Navigation, Trash2, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import type { SavedPlace } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

interface Props {
  onSave:  (name: string) => void;
  onFlyTo: (place: SavedPlace) => void;
}

export function MyPlacesPanel({ onSave, onFlyTo }: Props) {
  const savedPlaces    = useProjectStore(s => s.savedPlaces);
  const removeSavedPlace = useProjectStore(s => s.removeSavedPlace);

  const [open,    setOpen]    = useState(false);
  const [adding,  setAdding]  = useState(false);
  const [name,    setName]    = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
    setAdding(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setAdding(false); setName(''); }
  };

  return (
    <div className="absolute right-4 bottom-[170px] z-10 w-[200px] select-none">
      <div className="bg-black/75 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden">

        {/* Header toggle */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
        >
          <Bookmark className="w-3.5 h-3.5 text-white/60 shrink-0" />
          <span className="flex-1 text-left text-[11px] font-bold text-white/90 tracking-wide">
            My Places
          </span>
          {savedPlaces.length > 0 && (
            <span className="text-[9px] font-mono text-white/40 mr-1">{savedPlaces.length}</span>
          )}
          {open
            ? <ChevronUp   className="w-3.5 h-3.5 text-white/40" />
            : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
        </button>

        {open && (
          <div className="border-t border-white/10">

            {/* Saved places list */}
            {savedPlaces.length === 0 && !adding && (
              <div className="px-3 py-3 flex flex-col items-center gap-1.5 text-center">
                <MapPin className="w-4 h-4 text-white/20" />
                <p className="text-[10px] text-white/30 leading-snug">
                  No saved places yet. Navigate to a location and save it.
                </p>
              </div>
            )}

            {savedPlaces.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                {savedPlaces.map((place) => (
                  <div
                    key={place.id}
                    className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/5 group transition-colors"
                  >
                    <MapPin className="w-3 h-3 text-emerald-400/70 shrink-0" />
                    <span className="flex-1 text-[11px] text-white/75 truncate leading-tight">
                      {place.name}
                    </span>
                    <span className="text-[9px] font-mono text-white/25 shrink-0">
                      z{Math.round(place.zoom)}
                    </span>
                    <button
                      onClick={() => onFlyTo(place)}
                      title="Fly to"
                      className="shrink-0 rounded p-0.5 text-white/30 hover:text-emerald-400 transition-colors"
                    >
                      <Navigation className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeSavedPlace(place.id)}
                      title="Delete"
                      className="shrink-0 rounded p-0.5 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add place input */}
            {adding ? (
              <div className="px-2 py-2 border-t border-white/10 flex gap-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Place name…"
                  className={cn(
                    'flex-1 bg-white/10 border border-white/20 rounded px-2 py-1',
                    'text-[11px] text-white placeholder:text-white/30',
                    'focus:outline-none focus:border-emerald-500/60',
                  )}
                />
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[10px] font-medium text-white transition-colors"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="px-2 py-1.5 border-t border-white/10">
                <button
                  onClick={() => setAdding(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1 rounded-lg hover:bg-white/8 text-white/50 hover:text-white/80 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span className="text-[10px]">Save current view</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
