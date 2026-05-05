import { useProjectStore } from '@/store/useProjectStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function EYASettingsPanel() {
  const { eyaSettings, setEYASettings } = useProjectStore();

  const handleUpdate = (key: keyof typeof eyaSettings, value: number) => {
    setEYASettings({ [key]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-card-foreground">EYA Configuration</h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Mean Wind Speed (m/s)</Label>
            <Input 
              type="number" 
              value={eyaSettings.freeWindSpeed} 
              onChange={(e) => handleUpdate('freeWindSpeed', parseFloat(e.target.value) || 0)}
              step={0.1}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Weibull k (Shape)</Label>
            <Input 
              type="number" 
              value={eyaSettings.weibullK} 
              onChange={(e) => handleUpdate('weibullK', parseFloat(e.target.value) || 0)}
              step={0.01}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Air Density (kg/m³)</Label>
            <Input 
              type="number" 
              value={eyaSettings.airDensity} 
              onChange={(e) => handleUpdate('airDensity', parseFloat(e.target.value) || 0)}
              step={0.01}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Total Uncertainty (%)</Label>
            <Input 
              type="number" 
              value={eyaSettings.totalUncertainty} 
              onChange={(e) => handleUpdate('totalUncertainty', parseFloat(e.target.value) || 0)}
              step={0.1}
            />
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full border rounded-md">
          <AccordionItem value="losses" className="border-b-0 px-4">
            <AccordionTrigger className="py-3 text-sm text-muted-foreground hover:no-underline hover:text-foreground">
              Loss Assumptions (%)
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Wake Loss</Label>
                  <Input 
                    type="number" className="h-7 text-xs"
                    value={eyaSettings.wakeLoss} 
                    onChange={(e) => handleUpdate('wakeLoss', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Machine Avail.</Label>
                  <Input 
                    type="number" className="h-7 text-xs"
                    value={eyaSettings.machineAvailability} 
                    onChange={(e) => handleUpdate('machineAvailability', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Grid Avail.</Label>
                  <Input 
                    type="number" className="h-7 text-xs"
                    value={eyaSettings.gridAvailability} 
                    onChange={(e) => handleUpdate('gridAvailability', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">BOP Avail.</Label>
                  <Input 
                    type="number" className="h-7 text-xs"
                    value={eyaSettings.bopAvailability} 
                    onChange={(e) => handleUpdate('bopAvailability', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Transmission Eff.</Label>
                  <Input 
                    type="number" className="h-7 text-xs"
                    value={eyaSettings.transmissionEfficiency} 
                    onChange={(e) => handleUpdate('transmissionEfficiency', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Turbine Perf.</Label>
                  <Input 
                    type="number" className="h-7 text-xs"
                    value={eyaSettings.turbinePerformance} 
                    onChange={(e) => handleUpdate('turbinePerformance', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
