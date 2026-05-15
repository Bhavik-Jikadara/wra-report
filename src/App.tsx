import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MapEditor } from '@/components/map/MapEditor';
import { Header } from '@/components/header/Header';
import { Toaster } from 'sonner';
import { Menu } from 'lucide-react';

import { EYAReportPage } from '@/components/report/EYAReportPage';
import { ProjectHistoryPage } from '@/components/projects/ProjectHistoryPage';
import { useProjectStore } from '@/store/useProjectStore';
import { useProjectHistoryStore } from '@/store/useProjectHistoryStore';

export type AppView = 'map' | 'report' | 'projects';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Keep history entry name in sync whenever the user renames the current project
  const projectId   = useProjectStore(s => s.projectId);
  const projectName = useProjectStore(s => s.projectName);

  useEffect(() => {
    if (!projectId) return;
    useProjectHistoryStore.getState().renameProject(projectId, projectName);
  }, [projectId, projectName]);

  // Update browser tab title to reflect current project
  useEffect(() => {
    document.title = `${projectName} — WindEYA`;
  }, [projectName]);

  return (
    <div className="flex flex-col min-h-screen lg:h-screen lg:overflow-hidden overflow-y-auto overflow-x-hidden bg-background text-foreground">
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {currentView === 'map' ? (
        <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden relative">
          <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

          <main className="flex-1 flex flex-col relative z-0 min-h-0 h-[60vh] lg:h-full">
            <div className="flex-1 relative">
              <MapEditor />

              {/* Mobile Sidebar Toggle Button */}
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden absolute top-4 left-4 z-30 bg-primary text-white p-2 rounded-md shadow-lg"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
            </div>
          </main>
        </div>
      ) : currentView === 'report' ? (
        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          <EYAReportPage />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          <ProjectHistoryPage onViewChange={setCurrentView} />
        </div>
      )}
      <Toaster position="top-center" />
    </div>
  );
}

export default App;
