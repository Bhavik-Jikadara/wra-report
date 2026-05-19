import { useState, useCallback, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  onFlyTo: (lng: number, lat: number, zoom?: number) => void;
}

export function LocationSearch({ onFlyTo }: Props) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data = await res.json() as NominatimResult[];
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 450);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    search(e.target.value);
  };

  const handleSelect = (r: NominatimResult) => {
    onFlyTo(parseFloat(r.lon), parseFloat(r.lat), 13);
    setQuery(r.display_name.split(',')[0]);
    setOpen(false);
  };

  const handleClear = () => { setQuery(''); setResults([]); setOpen(false); };

  return (
    <div className="relative px-2 py-2">
      <div className="flex items-center gap-2 bg-white/8 border border-white/12 rounded-lg px-2.5 py-1.5 transition-colors focus-within:border-emerald-500/40">
        {loading
          ? <Loader2 className="w-3.5 h-3.5 text-white/40 shrink-0 animate-spin" />
          : <Search  className="w-3.5 h-3.5 text-white/40 shrink-0" />}
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search places…"
          className="flex-1 bg-transparent text-[11px] text-white/85 placeholder:text-white/28 focus:outline-none"
        />
        {query && (
          <button onClick={handleClear} className="text-white/25 hover:text-white/55 transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-2 right-2 top-full mt-0.5 bg-[#1c2234] border border-white/12 rounded-xl shadow-2xl z-50 overflow-hidden">
          {results.map((r) => {
            const parts = r.display_name.split(',');
            return (
              <button
                key={r.place_id}
                onMouseDown={() => handleSelect(r)}
                className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-white/8 text-left transition-colors border-b border-white/6 last:border-0"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400/70 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-white/80 leading-snug truncate">{parts[0]}</p>
                  <p className="text-[9px] text-white/35 leading-snug truncate">
                    {parts.slice(1, 3).join(', ').trim()}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
