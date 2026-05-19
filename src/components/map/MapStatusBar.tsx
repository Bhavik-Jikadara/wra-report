interface Props {
  cursorCoords: [number, number] | null;
  zoom:         number;
  bearing:      number;
  pitch:        number;
}

function fmt(n: number, decimals = 5) {
  return n.toFixed(decimals);
}

export function MapStatusBar({ cursorCoords, zoom, bearing, pitch }: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 h-6 bg-black/60 backdrop-blur-sm border-t border-white/8 flex items-center px-3 gap-4 select-none">

      {/* Coordinates */}
      {cursorCoords ? (
        <span className="font-mono text-[10px] text-white/65">
          {cursorCoords[1] >= 0 ? '' : '-'}{Math.abs(cursorCoords[1]).toFixed(6)}°{cursorCoords[1] >= 0 ? 'N' : 'S'},&nbsp;
          {cursorCoords[0] >= 0 ? '' : '-'}{Math.abs(cursorCoords[0]).toFixed(6)}°{cursorCoords[0] >= 0 ? 'E' : 'W'}
        </span>
      ) : (
        <span className="font-mono text-[10px] text-white/28">— lat, lng —</span>
      )}

      <div className="flex-1" />

      {/* Zoom */}
      <span className="font-mono text-[10px] text-white/45">
        zoom {fmt(zoom, 1)}
      </span>

      {/* Bearing */}
      {Math.abs(bearing) > 0.5 && (
        <span className="font-mono text-[10px] text-white/45">
          {fmt(bearing < 0 ? bearing + 360 : bearing, 1)}°
        </span>
      )}

      {/* Pitch */}
      {Math.abs(pitch) > 0.5 && (
        <span className="font-mono text-[10px] text-white/45">
          tilt {fmt(pitch, 0)}°
        </span>
      )}

      {/* Attribution */}
      <span className="text-[9px] text-white/22">
        © Esri · © OSM contributors
      </span>
    </div>
  );
}
