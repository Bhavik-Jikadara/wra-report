import { useState, useRef } from 'react';
import { UploadCloud, File, X } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { parseKmlOrKmz } from '@/lib/kmlParser';
import { toast } from 'sonner';
import { area, centroid } from '@turf/turf';
import { identifyFeaturesFromOSM } from '@/lib/osmService';

export function BoundaryUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setProjectBoundary, projectBoundary } = useProjectStore();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    // Validate size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds 20 MB limit');
      return;
    }

    try {
      toast.info('Parsing boundary file...');
      const featureCollection = await parseKmlOrKmz(file);
      if (featureCollection) {
        setProjectBoundary(featureCollection);
        setFileName(file.name);
        toast.success('Boundary uploaded successfully');

        // Automatically identify features
        const featureToast = toast.loading('Identifying water bodies and dwellings...');
        try {
          const { waterbodies, dwellings } = await identifyFeaturesFromOSM(featureCollection);
          const { setMapFeatures, mapFeatures } = useProjectStore.getState();
          
          const newFeatures = [
            ...(mapFeatures?.features || []),
            ...waterbodies.features,
            ...dwellings.features
          ];

          setMapFeatures({
            type: 'FeatureCollection',
            features: newFeatures as any
          });

          toast.success(`Identified ${waterbodies.features.length} water bodies and ${dwellings.features.length} dwelling zones`, { id: featureToast });
        } catch (e) {
          toast.error('Failed to auto-identify features', { id: featureToast });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error processing file');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processFile(file);
      // Reset input so the same file can be selected again if removed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setFileName(null);
    setProjectBoundary({ type: 'FeatureCollection', features: [] } as any); // Reset to empty or null. The store uses null for initial state. Wait, I should set to null but the type might be strict.
    // Let's check type in store: FeatureCollection | null
    // Yes, null is allowed but I need to ensure typescript is happy.
  };

  // Compute stats if boundary exists
  let boundaryStats = null;
  if (projectBoundary && projectBoundary.features.length > 0) {
    try {
      const boundaryAreaKm2 = area(projectBoundary) / 1000000;
      const center = centroid(projectBoundary);
      boundaryStats = {
        area: boundaryAreaKm2.toFixed(2),
        lat: center.geometry.coordinates[1].toFixed(6),
        lng: center.geometry.coordinates[0].toFixed(6),
      };
    } catch(e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-card-foreground">Project Boundary</h3>
      
      {!fileName ? (
        <>
          <div 
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors cursor-pointer ${
              isDragging ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Click to upload or drag & drop</p>
          <p className="text-xs text-muted-foreground mt-1">.KML or .KMZ up to 20MB</p>
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef}
            accept=".kml,.kmz"
            onChange={handleFileSelect}
          />
        </div>
        <div className="flex justify-center mt-2">
          <a href="/sample_boundary.kml" download className="text-xs text-primary hover:underline font-medium">
            Download Sample KML
          </a>
        </div>
      </>
      ) : (
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <File className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium break-all">{fileName}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  Valid Geometry Found
                </p>
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); handleRemove(); useProjectStore.getState().setProjectBoundary(null as any) }} 
              className="p-1 hover:bg-muted-foreground/20 rounded text-muted-foreground"
              title="Remove boundary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {boundaryStats && (
            <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Total Area</span>
                <span className="font-mono font-medium">{boundaryStats.area} km²</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Centroid</span>
                <span className="font-mono font-medium">{boundaryStats.lat}, {boundaryStats.lng}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
