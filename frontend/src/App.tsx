import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { AmbientBackground } from './components/layout/AmbientBackground';
import { Dashboard } from './pages/Dashboard';
import { Workforce } from './pages/Workforce';
import { Turnover } from './pages/Turnover';
import { Tenure } from './pages/Tenure';
import { FlightRisk } from './pages/FlightRisk';
import { Careers } from './pages/Careers';
import { Managers } from './pages/Managers';
import { Org } from './pages/Org';
import { Chat } from './pages/Chat';
import { Insights } from './pages/Insights';
import { Upload } from './pages/Upload';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AmbientBackground />
      <Sidebar />
      <main
        className="relative z-10"
        style={{
          marginLeft: 228,
          padding: '28px 28px 44px',
          maxWidth: 1320 + 228,
          minHeight: '100vh',
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workforce" element={<Workforce />} />
          <Route path="/turnover" element={<Turnover />} />
          <Route path="/tenure" element={<Tenure />} />
          <Route path="/flight-risk" element={<FlightRisk />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/managers" element={<Managers />} />
          <Route path="/org" element={<Org />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
