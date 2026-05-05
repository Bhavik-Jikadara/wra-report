import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { optimizeLayout } from '@/lib/layoutOptimizer';
import turbineModelsData from '@/data/turbineModels.json';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { TurbineModel } from '@/types';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

export function GenerateButton() {
  const { projectBoundary, micrositingSettings, setTurbines } = useProjectStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!projectBoundary) {
      toast.error('Please upload a project boundary first.');
      return;
    }

    const model = turbineModels.find(m => m.id === micrositingSettings.turbineModelId);
    if (!model) {
      toast.error('Selected turbine model not found.');
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading('Analyzing boundary geometry...');

    try {
      // Small artificial delay to show progress steps
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.loading('Building spacing grid...', { id: loadingToast });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.loading('Applying exclusion zones...', { id: loadingToast });

      const { exclusionZones } = useProjectStore.getState();
      const { turbines, warnings } = await optimizeLayout(projectBoundary, exclusionZones, micrositingSettings, model);
      
      setTurbines(turbines);

      if (warnings.length > 0) {
        warnings.forEach(w => toast.warning(w));
      }

      toast.success(`Done — ${turbines.length} turbines placed`, { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Optimization failed', { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 border-t bg-muted/50 mt-auto">
      <button 
        onClick={handleGenerate}
        disabled={isGenerating || !projectBoundary}
        className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        {isGenerating ? 'Generating...' : 'Generate Micrositing'}
      </button>
    </div>
  );
}
