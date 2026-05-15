import { useState, useRef, useEffect } from 'react';
import { Wind, Download, FileText, ArrowLeft, Plus, Pencil, Check, FolderOpen } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { useProjectHistoryStore } from '@/store/useProjectHistoryStore';
import type { AppView } from '@/App';
import { generateKML, downloadKML } from '@/lib/kmlExporter';
import turbineModelsData from '@/data/turbineModels.json';
import { pdf } from '@react-pdf/renderer';
import { PDFReport } from '@/components/report/PDFReport';
import { toast } from 'sonner';
import { area } from '@turf/turf';
import { logger } from '@/lib/logger';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface HeaderProps {
  currentView?: AppView;
  onViewChange?: (view: AppView) => void;
}

export function Header({ currentView = 'map', onViewChange }: HeaderProps) {
  const { turbines, projectBoundary, micrositingSettings, eyaSettings, resetProject, projectName, setProjectName } = useProjectStore();
  const projectCount = useProjectHistoryStore(s => s.projects.length);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
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

  const handleNewProject = () => setShowNewProjectDialog(true);

  const confirmNewProject = () => {
    resetProject();
    setShowNewProjectDialog(false);
    toast.success('Project reset successfully');
    if (currentView !== 'map') onViewChange?.('map');
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
      logger.error(e);
      toast.error('Failed to generate PDF', { id: toastId });
    }
  };

  return (
    <>
    <header className="h-14 border-b bg-card flex items-center justify-between px-3 md:px-6 flex-shrink-0 z-20 shadow-sm relative">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Platform brand mark */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <div className="bg-primary/20 p-1.5 rounded-md">
            <Wind className="w-5 h-5 text-primary" />
          </div>
          <div className="hidden md:block">
            <span className="text-sm font-black text-primary tracking-tight leading-none">WindEYA</span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-[1px] h-6 bg-border shrink-0" />

        {/* Project name (editable) */}
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
          <p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider font-medium">MNRE &amp; IEC Compliant</p>
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

        {/* Projects history button */}
        <button
          onClick={() => onViewChange?.(currentView === 'projects' ? 'map' : 'projects')}
          className={`relative flex items-center gap-2 px-2 md:px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors ${
            currentView === 'projects' ? 'text-primary border-primary/20 bg-primary/5' : ''
          }`}
          title="Project History"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{currentView === 'projects' ? 'Back to Map' : 'Projects'}</span>
          {projectCount > 0 && currentView !== 'projects' && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {projectCount > 9 ? '9+' : projectCount}
            </span>
          )}
        </button>

        {/* Map / EYA Report toggle */}
        {currentView === 'report' ? (
          <button
            onClick={() => onViewChange?.('map')}
            className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Map</span>
          </button>
        ) : currentView === 'map' ? (
          <button
            onClick={() => onViewChange?.('report')}
            className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors text-primary border-primary/20 bg-primary/5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EYA Report</span>
          </button>
        ) : null}

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

    <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Start new project?</DialogTitle>
          <DialogDescription>
            All current data — turbines, boundary, and settings — will be permanently lost.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => setShowNewProjectDialog(false)}
            className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmNewProject}
            className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            New Project
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
