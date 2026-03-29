import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Spinner from "./components/ui/Spinner";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const InboxPage = lazy(() => import("./pages/InboxPage"));
const SessionDetailPage = lazy(() => import("./pages/SessionDetailPage"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const ArchivePage = lazy(() => import("./pages/ArchivePage"));
const DuplicatesPage = lazy(() => import("./pages/DuplicatesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[#0f1117] text-[#e8eaf0] overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto p-6">
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center">
                  <Spinner size={28} />
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
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
