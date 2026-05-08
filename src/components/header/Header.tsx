import { useState, useRef, useEffect } from 'react';
import { Wind, Download, FileText, ArrowLeft, Plus, Pencil, Check } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { generateKML, downloadKML } from '@/lib/kmlExporter';
import turbineModelsData from '@/data/turbineModels.json';
import { pdf } from '@react-pdf/renderer';
import { PDFReport } from '@/components/report/PDFReport';
import { toast } from 'sonner';
import { area } from '@turf/turf';

interface HeaderProps {
  currentView?: 'map' | 'report';
  onViewChange?: (view: 'map' | 'report') => void;
}

export function Header({ currentView = 'map', onViewChange }: HeaderProps) {
  const { turbines, projectBoundary, micrositingSettings, eyaSettings, resetProject, projectName, setProjectName } = useProjectStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  const commitName = () => {
    const trimmed = nameValue.trim();
    if (trimmed) setProjectName(trimmed);
    else setNameValue(projectName);
    setIsEditingName(false);
  };

  const handleNewProject = () => {
    if (confirm('Are you sure you want to start a new project? All current data will be lost.')) {
      resetProject();
      toast.success('Project reset successfully');
      if (currentView === 'report') {
        onViewChange?.('map');
      }
    }
  };

  const handleExportKML = () => {
    if (turbines.length === 0) {
      toast.error('No turbines to export');
      return;
    }
    const model = turbineModelsData.find(m => m.id === micrositingSettings.turbineModelId) || turbineModelsData[0];
    const kmlString = generateKML(turbines, projectBoundary, model as any);
    downloadKML(kmlString, 'wind_farm_layout.kml');
    toast.success('KML exported successfully');
  };

  const handleExportPDF = async () => {
    if (turbines.length === 0) {
      toast.error('No turbines to export');
      return;
    }
    
    const toastId = toast.loading('Generating PDF Report...');
    
    try {
      const model = turbineModelsData.find(m => m.id === micrositingSettings.turbineModelId) || turbineModelsData[0];
      
      let boundaryAreaKm2 = '';
      if (projectBoundary) {
        boundaryAreaKm2 = (area(projectBoundary) / 1e6).toFixed(2);
      }

      const doc = <PDFReport 
        turbines={turbines} 
        turbineModel={model as any} 
        eyaSettings={eyaSettings}
        prevailingWindDir={micrositingSettings.prevailingWindDir}
        boundaryAreaKm2={boundaryAreaKm2}
      />;

      const asPdf = pdf();
      asPdf.updateContainer(doc);
      const blob = await asPdf.toBlob();
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'EYA_Report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('PDF Report generated', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF', { id: toastId });
    }
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-3 md:px-6 flex-shrink-0 z-20 shadow-sm relative">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div className="bg-primary/20 p-1.5 rounded-md hidden sm:flex flex-shrink-0">
          <Wind className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameValue(projectName); setIsEditingName(false); } }}
                className="text-xs md:text-sm font-semibold bg-transparent border-b border-primary outline-none w-40 md:w-56 leading-tight"
              />
              <button onClick={commitName} className="text-primary hover:text-primary/80 flex-shrink-0">
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group cursor-pointer min-w-0" onClick={() => { setNameValue(projectName); setIsEditingName(true); }}>
              <h1 className="font-semibold text-xs md:text-sm leading-tight truncate max-w-[120px] md:max-w-[220px]">{projectName}</h1>
              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          )}
          <p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider font-medium">MNRE & IEC Compliant</p>
        </div>
        {turbines.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-full border border-primary/20 flex-shrink-0">
            <span className="text-[10px] font-bold text-primary">{turbines.length} WTGs</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1.5 md:gap-2">
        <button 
          onClick={handleNewProject}
          title="New Project"
          className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors text-muted-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">New Project</span>
        </button>

        <div className="w-[1px] h-6 bg-border mx-0.5 hidden sm:block" />

        {currentView === 'report' ? (
          <button 
            onClick={() => onViewChange?.('map')}
            className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Map</span>
          </button>
        ) : (
          <button 
            onClick={() => onViewChange?.('report')}
            className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors text-primary border-primary/20 bg-primary/5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EYA Report</span>
          </button>
        )}

        <button 
          onClick={handleExportKML}
          title="Export KML"
          className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors hidden sm:flex"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Export KML</span>
        </button>

        <button 
          onClick={handleExportPDF}
          title="Download PDF"
          className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-xs font-medium border rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">PDF</span>
        </button>
      </div>
    </header>
  );
}
