import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Rail from "./components/layout/Rail";
import DriveStrip from "./components/layout/DriveStrip";
import Spinner from "./components/ui/Spinner";
import { useAppStore } from "./store/useAppStore";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const InboxPage = lazy(() => import("./pages/InboxPage"));
const SessionDetailPage = lazy(() => import("./pages/SessionDetailPage"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const ArchivePage = lazy(() => import("./pages/ArchivePage"));
const DuplicatesPage = lazy(() => import("./pages/DuplicatesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

export default function App() {
  const theme = useAppStore((s) => s.settings.ui.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-ground text-paper overflow-hidden">
        <Rail />
        <div className="flex flex-col flex-1 min-w-0">
          <DriveStrip />
          <main className="flex-1 overflow-auto px-8 py-7">
            <div className="max-w-[1100px]">
              <Suspense
                fallback={
                  <div className="py-24 flex justify-center">
                    <Spinner size={24} />
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/inbox" element={<InboxPage />} />
                  <Route path="/session/:id" element={<SessionDetailPage />} />
                  <Route path="/review" element={<ReviewPage />} />
                  <Route path="/archive" element={<ArchivePage />} />
                  <Route path="/duplicates" element={<DuplicatesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
