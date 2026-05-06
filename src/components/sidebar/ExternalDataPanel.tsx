import { useState, useRef } from 'react';
import { UploadCloud, File, X, Wind, MapPin } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { parseKmlPointsOrKmz, parseKmlFeaturesOrKmz } from '@/lib/kmlParser';
import { toast } from 'sonner';
import { latLngToUTM } from '@/lib/utmConverter';
import { identifyFeaturesFromOSM } from '@/lib/osmService';
import { Loader2, Search } from 'lucide-react';
import type { TurbinePosition } from '@/types';

export function ExternalDataPanel() {
  const [isDraggingWTG, setIsDraggingWTG] = useState(false);
  const [isDraggingFeatures, setIsDraggingFeatures] = useState(false);
  const { setExternalTurbines, externalTurbines, setMapFeatures, mapFeatures, projectBoundary } = useProjectStore();
  const [isIdentifying, setIsIdentifying] = useState(false);
  
  const wtgInputRef = useRef<HTMLInputElement>(null);
  const featureInputRef = useRef<HTMLInputElement>(null);

  const processWTGFile = async (file: File) => {
    try {
      toast.info('Parsing external WTG file...');
      const featureCollection = await parseKmlPointsOrKmz(file);
      if (featureCollection) {
        const positions: TurbinePosition[] = featureCollection.features.map((f, i) => {
          const [lng, lat] = (f.geometry as any).coordinates;
          const utm = latLngToUTM(lat, lng);
          return {
            id: `EXT-${i + 1}`,
            lat,
            lng,
            easting: utm.easting,
            northing: utm.northing,
            utmZone: `${utm.zone}${utm.letter}`,
            nearestNeighborId: '',
            nearestNeighborDistanceM: 0,
            nearestNeighborDistanceRD: 0,
            spacingStatus: 'ok',
          };
        });
        setExternalTurbines(positions);
        toast.success(`${positions.length} external WTGs imported`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error processing WTG file');
    }
  };

  const processFeatureFile = async (file: File) => {
    try {
      toast.info('Parsing map features file...');
      const featureCollection = await parseKmlFeaturesOrKmz(file);
      if (featureCollection) {
        setMapFeatures(featureCollection);
        toast.success(`Features imported successfully`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error processing features file');
    }
  };
  const handleAutoIdentify = async () => {
    if (!projectBoundary) {
      toast.error('Please upload a project boundary first');
      return;
    }

    setIsIdentifying(true);
    const featureToast = toast.loading('Identifying water bodies and dwellings from OSM...');
    try {
      const { waterbodies, dwellings } = await identifyFeaturesFromOSM(projectBoundary);
      
      const newFeatures = [
        ...(mapFeatures?.features || []),
        ...waterbodies.features,
        ...dwellings.features
      ];

      setMapFeatures({
        type: 'FeatureCollection',
        features: newFeatures as any
      });

      toast.success(`Identified ${waterbodies.features.length} water bodies and ${dwellings.features.length} dwellings`, { id: featureToast });
    } catch (e) {
      toast.error('Failed to auto-identify features', { id: featureToast });
    } finally {
      setIsIdentifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">External WTGs</h3>
        </div>
        
        {externalTurbines.length === 0 ? (
          <div 
            className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center transition-colors cursor-pointer ${
              isDraggingWTG ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingWTG(true); }}
            onDragLeave={() => setIsDraggingWTG(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDraggingWTG(false);
              if (e.dataTransfer.files?.[0]) await processWTGFile(e.dataTransfer.files[0]);
            }}
            onClick={() => wtgInputRef.current?.click()}
          >
            <UploadCloud className="w-6 h-6 text-muted-foreground mb-2" />
            <p className="text-xs font-medium">Upload external WTG KML/KMZ</p>
            <input type="file" className="hidden" ref={wtgInputRef} accept=".kml,.kmz" onChange={(e) => e.target.files?.[0] && processWTGFile(e.target.files[0])} />
          </div>
        ) : (
          <div className="border rounded-lg p-3 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <File className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">{externalTurbines.length} Turbines</span>
            </div>
            <button onClick={() => setExternalTurbines([])} className="p-1 hover:bg-muted rounded text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Map Features</h3>
          <button 
            onClick={handleAutoIdentify}
            disabled={isIdentifying || !projectBoundary}
            className="ml-auto flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {isIdentifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Auto Identify
          </button>
        </div>
        
        {!mapFeatures || mapFeatures.features.length === 0 ? (
          <div 
            className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center transition-colors cursor-pointer ${
              isDraggingFeatures ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingFeatures(true); }}
            onDragLeave={() => setIsDraggingFeatures(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDraggingFeatures(false);
              if (e.dataTransfer.files?.[0]) await processFeatureFile(e.dataTransfer.files[0]);
            }}
            onClick={() => featureInputRef.current?.click()}
          >
            <UploadCloud className="w-6 h-6 text-muted-foreground mb-2" />
            <p className="text-xs font-medium">Upload Features (Water, Dwellings, etc.)</p>
            <input type="file" className="hidden" ref={featureInputRef} accept=".kml,.kmz" onChange={(e) => e.target.files?.[0] && processFeatureFile(e.target.files[0])} />
          </div>
        ) : (
          <div className="border rounded-lg p-3 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <File className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">{mapFeatures.features.length} Features</span>
            </div>
            <button onClick={() => setMapFeatures(null)} className="p-1 hover:bg-muted rounded text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
