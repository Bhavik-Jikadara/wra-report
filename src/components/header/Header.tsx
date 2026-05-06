import { Wind, Download, FileText, ArrowLeft, Plus } from 'lucide-react';
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
  const { turbines, projectBoundary, micrositingSettings, eyaSettings, resetProject } = useProjectStore();

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
      <div className="flex items-center gap-2 md:gap-3">
        <div className="bg-primary/20 p-1.5 rounded-md hidden sm:block">
          <Wind className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-xs md:text-sm leading-tight truncate">Wind Farm Tool</h1>
          <p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate">MNRE & IEC Compliant</p>
        </div>
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
