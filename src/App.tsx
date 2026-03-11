import { BrowserRouter, Route, Routes } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import DashboardPage from "./pages/DashboardPage";
import InboxPage from "./pages/InboxPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import ReviewPage from "./pages/ReviewPage";
import ArchivePage from "./pages/ArchivePage";
import DuplicatesPage from "./pages/DuplicatesPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[#0f1117] text-[#e8eaf0] overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/session/:id" element={<SessionDetailPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/duplicates" element={<DuplicatesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
