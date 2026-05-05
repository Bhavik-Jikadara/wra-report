import { useState } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MapEditor } from '@/components/map/MapEditor';
import { Header } from '@/components/header/Header';
import { Toaster } from 'sonner';

import { EYAReportPage } from '@/components/report/EYAReportPage';

function App() {
  const [currentView, setCurrentView] = useState<'map' | 'report'>('map');

  return (
    <div className="flex flex-col min-h-screen lg:h-screen lg:overflow-hidden overflow-y-auto overflow-x-hidden bg-background text-foreground">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      
      {currentView === 'map' ? (
        <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden relative">
          <Sidebar />
          
          <main className="flex-1 flex flex-col relative z-0 min-h-0">
            <div className="flex-1 relative">
              <MapEditor />
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
