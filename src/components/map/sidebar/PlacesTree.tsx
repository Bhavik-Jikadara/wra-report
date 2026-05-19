import { useState } from 'react';
import {
  Folder, FolderOpen, MapPin, Navigation, Trash2,
  Plus, ChevronRight, ChevronDown, FolderPlus,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import type { SavedPlace, PlaceFolder } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

interface Props {
  onFlyTo:     (place: SavedPlace) => void;
  onSaveTo:    (folderId: string)  => void;
  activeSaveFolder: string | null;
}

// ── Single place item ─────────────────────────────────────────────────────────
function PlaceItem({ place, onFlyTo }: { place: SavedPlace; onFlyTo: (p: SavedPlace) => void }) {
  const removeSavedPlace = useProjectStore(s => s.removeSavedPlace);
  return (
    <div className="group flex items-center gap-1.5 pl-8 pr-1.5 py-1 hover:bg-white/6 rounded transition-colors">
      <MapPin className="w-3 h-3 text-amber-400/60 shrink-0" />
      <span className="flex-1 text-[11px] text-white/72 truncate leading-tight">{place.name}</span>
      <span className="text-[9px] font-mono text-white/25 shrink-0">z{Math.round(place.zoom)}</span>
      <button
        onClick={() => onFlyTo(place)}
        title="Fly to"
        className="shrink-0 p-0.5 text-white/20 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Navigation className="w-3 h-3" />
      </button>
      <button
        onClick={() => removeSavedPlace(place.id)}
        title="Delete"
        className="shrink-0 p-0.5 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Folder node ───────────────────────────────────────────────────────────────
function FolderNode({
  folder, places, onFlyTo, onSaveTo, activeSaveFolder,
}: {
  folder: PlaceFolder;
  places: SavedPlace[];
  onFlyTo: (p: SavedPlace) => void;
  onSaveTo: (id: string)   => void;
  activeSaveFolder: string | null;
}) {
  const { toggleFolderExpanded, removePlaceFolder, renamePlaceFolder } = useProjectStore.getState();
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const isDefault = folder.id === 'general';
  const isSaving  = activeSaveFolder === folder.id;

  const commitRename = () => {
    if (editName.trim()) renamePlaceFolder(folder.id, editName.trim());
    setRenaming(false);
  };

  return (
    <div>
      {/* Folder header */}
      <div className="group flex items-center gap-1.5 px-2 py-1 hover:bg-white/6 rounded transition-colors">
        <button
          onClick={() => toggleFolderExpanded(folder.id)}
          className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
        >
          {folder.expanded
            ? <ChevronDown  className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />}
        </button>

        {folder.expanded
          ? <FolderOpen className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
          : <Folder     className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />}

        {renaming ? (
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            className="flex-1 bg-white/10 rounded px-1 py-0 text-[11px] text-white focus:outline-none"
          />
        ) : (
          <span
            className="flex-1 text-[11px] text-white/80 truncate leading-tight"
            onDoubleClick={() => !isDefault && setRenaming(true)}
          >
            {folder.name}
          </span>
        )}

        {places.length > 0 && (
          <span className="text-[9px] font-mono text-white/28 shrink-0">{places.length}</span>
        )}

        {/* Hover actions */}
        <button
          onClick={() => onSaveTo(folder.id)}
          title="Save current view here"
          className={cn(
            'shrink-0 p-0.5 transition-all',
            isSaving
              ? 'text-emerald-400'
              : 'text-white/20 hover:text-emerald-400 opacity-0 group-hover:opacity-100',
          )}
        >
          <Plus className="w-3 h-3" />
        </button>
        {!isDefault && (
          <button
            onClick={() => removePlaceFolder(folder.id)}
            title="Delete folder"
            className="shrink-0 p-0.5 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Places */}
      {folder.expanded && places.map(p => (
        <PlaceItem key={p.id} place={p} onFlyTo={onFlyTo} />
      ))}
    </div>
  );
}

// ── Main tree ─────────────────────────────────────────────────────────────────
export function PlacesTree({ onFlyTo, onSaveTo, activeSaveFolder }: Props) {
  const { placeFolders, savedPlaces, addPlaceFolder } = useProjectStore();
  const [addingFolder, setAddingFolder] = useState(false);
  const [newName,      setNewName]      = useState('');

  const placesFor = (folderId: string) =>
    savedPlaces.filter(p => (p.folderId ?? 'general') === folderId);

  const commitFolder = () => {
    if (newName.trim()) { addPlaceFolder(newName.trim()); }
    setNewName('');
    setAddingFolder(false);
  };

  return (
    <div className="select-none">
      {/* Section header */}
      <div className="flex items-center justify-between px-2 py-1.5 sticky top-0 bg-[#111827] z-10">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">My Places</span>
        <button
          onClick={() => setAddingFolder(true)}
          title="New folder"
          className="text-white/25 hover:text-white/65 transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-1 space-y-0.5">
        {placeFolders.map(folder => (
          <FolderNode
            key={folder.id}
            folder={folder}
            places={placesFor(folder.id)}
            onFlyTo={onFlyTo}
            onSaveTo={onSaveTo}
            activeSaveFolder={activeSaveFolder}
          />
        ))}

        {/* New folder input */}
        {addingFolder && (
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Folder className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={commitFolder}
              onKeyDown={e => {
                if (e.key === 'Enter') commitFolder();
                if (e.key === 'Escape') { setAddingFolder(false); setNewName(''); }
              }}
              placeholder="Folder name…"
              className="flex-1 bg-white/10 border border-white/15 rounded px-2 py-0.5 text-[11px] text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        )}

        {/* Empty state */}
        {placeFolders.length === 0 && !addingFolder && (
          <p className="px-2 py-2 text-[10px] text-white/25 italic">No places saved.</p>
        )}
      </div>
    </div>
  );
}
