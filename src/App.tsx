import { useState } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MapEditor } from '@/components/map/MapEditor';
import { Header } from '@/components/header/Header';
import { Toaster } from 'sonner';
import { Menu } from 'lucide-react';

import { EYAReportPage } from '@/components/report/EYAReportPage';

function App() {
  const [currentView, setCurrentView] = useState<'map' | 'report'>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          <EYAReportPage />
        </div>
      )}
      <Toaster position="top-center" />
    </div>
  );
}

export default App;
