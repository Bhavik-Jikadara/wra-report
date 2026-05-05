import { useProjectStore } from '@/store/useProjectStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import turbineModelsData from '@/data/turbineModels.json';
import type { TurbineModel } from '@/types';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

export function TurbineConfigPanel() {
  const { 
    micrositingSettings, 
    setMicrositingSettings, 
    customPowerCurves, 
    setCustomPowerCurve,
    clearCustomPowerCurve 
  } = useProjectStore();
  
  const selectedModel = turbineModels.find(m => m.id === micrositingSettings.turbineModelId) || turbineModels[0];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-card-foreground">Turbine Configuration</h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Number of turbine locations</Label>
          <div className="flex items-center gap-4">
            <Slider 
              value={[micrositingSettings.targetCount]} 
              min={1} 
              max={1000} 
              step={1}
              onValueChange={([val]) => setMicrositingSettings({ targetCount: val })}
              className="flex-1"
            />
            <span className="w-12 text-center font-mono text-sm bg-muted py-1 rounded-md">{micrositingSettings.targetCount}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Turbine Model</Label>
          <Select 
            value={micrositingSettings.turbineModelId} 
            onValueChange={(val) => {
              const model = turbineModels.find(m => m.id === val);
              if (model) {
                setMicrositingSettings({ 
                  turbineModelId: val,
                  hubHeight: model.hubHeights[0] // reset hub height to first available
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select turbine model" />
            </SelectTrigger>
            <SelectContent>
              {turbineModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.oem} {model.model} ({model.ratedKW / 1000} MW)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Power Curve Import */}
          <div className="flex items-center justify-between mt-2 bg-muted/30 p-2 rounded-md border border-dashed">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {customPowerCurves?.[selectedModel.id] 
                  ? "Custom Power Curve Active" 
                  : "Default Power Curve"}
              </span>
              {customPowerCurves?.[selectedModel.id] && (
                <button 
                  onClick={() => clearCustomPowerCurve(selectedModel.id)}
                  className="text-[10px] text-destructive hover:underline text-left mt-0.5"
                >
                  Reset to Default
                </button>
              )}
            </div>
            
            <div>
              <input 
                type="file" 
                accept=".csv" 
                id="powerCurveImport" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  try {
                    const text = await file.text();
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    const curve: [number, number][] = [];
                    
                    // Skip header if first line is not numbers
                    let startIdx = 0;
                    if (lines[0] && isNaN(parseFloat(lines[0].split(',')[0]))) {
                      startIdx = 1;
                    }

                    for (let i = startIdx; i < lines.length; i++) {
                      const parts = lines[i].split(',').map(p => p.trim());
                      if (parts.length >= 2) {
                        const ws = parseFloat(parts[0]);
                        const pwr = parseFloat(parts[1]);
                        if (!isNaN(ws) && !isNaN(pwr)) {
                          curve.push([ws, pwr]);
                        }
                      }
                    }

                    if (curve.length < 2) throw new Error("Not enough valid data points");
                    
                    // sort by wind speed
                    curve.sort((a, b) => a[0] - b[0]);

                    setCustomPowerCurve(selectedModel.id, curve);
                    
                  } catch (err) {
                    console.error("Invalid CSV format", err);
                    alert("Invalid CSV. Please upload a CSV with two columns: Wind Speed (m/s), Power (kW)");
                  }
                  e.target.value = ''; // reset input
                }} 
              />
              <Label 
                htmlFor="powerCurveImport" 
                className="text-[10px] bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2 py-1 rounded cursor-pointer transition-colors"
              >
                Import CSV
              </Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Hub Height (m)</Label>
          <Select 
            value={micrositingSettings.hubHeight.toString()} 
            onValueChange={(val) => setMicrositingSettings({ hubHeight: parseInt(val) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select hub height" />
            </SelectTrigger>
            <SelectContent>
              {selectedModel.hubHeights.map((hh) => (
                <SelectItem key={hh} value={hh.toString()}>
                  {hh} m
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="spacing" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline hover:text-foreground">
              Advanced Spacing Configuration
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4 pb-2">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Crosswind Spacing</Label>
                  <span className="text-xs text-muted-foreground">{micrositingSettings.crosswindMultiple}D</span>
                </div>
                <Slider 
                  value={[micrositingSettings.crosswindMultiple]} 
                  min={2} 
                  max={6} 
                  step={0.5}
                  onValueChange={([val]) => setMicrositingSettings({ crosswindMultiple: val })}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Downwind Spacing</Label>
                  <span className="text-xs text-muted-foreground">{micrositingSettings.downwindMultiple}D</span>
                </div>
                <Slider 
                  value={[micrositingSettings.downwindMultiple]} 
                  min={3} 
                  max={10} 
                  step={0.5}
                  onValueChange={([val]) => setMicrositingSettings({ downwindMultiple: val })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs text-primary font-semibold">MNRE Boundary Setback</Label>
                  <span className="text-xs text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                    {(micrositingSettings.hubHeight + (0.5 * selectedModel.rotorDiameter) + 5).toFixed(1)} m
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Strictly enforced via formula: HH + 0.5*RD + 5m
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Prevailing Wind Dir</Label>
                  <span className="text-xs text-muted-foreground">{micrositingSettings.prevailingWindDir}°</span>
                </div>
                <Slider 
                  value={[micrositingSettings.prevailingWindDir]} 
                  min={0} 
                  max={359} 
                  step={1}
                  onValueChange={([val]) => setMicrositingSettings({ prevailingWindDir: val })}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
