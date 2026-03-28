import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { AmbientBackground } from './components/layout/AmbientBackground';
import { ChatTrigger } from './components/chat/ChatTrigger';
import { ChatPanel, type ChatMessage } from './components/chat/ChatPanel';
import { Dashboard } from './pages/Dashboard';
import { Workforce } from './pages/Workforce';
import { Turnover } from './pages/Turnover';
import { Tenure } from './pages/Tenure';
import { FlightRisk } from './pages/FlightRisk';
import { Careers } from './pages/Careers';
import { Managers } from './pages/Managers';
import { Org } from './pages/Org';
import { Insights } from './pages/Insights';
import { Upload } from './pages/Upload';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/SettingsPage';
import { PipelineHub } from './pages/PipelineHub';
import api from './lib/api';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [hasNotification, setHasNotification] = useState(false);

  // Proactive insights: check for anomalies after data loads
  useEffect(() => {
    async function checkAnomalies() {
      try {
        const [sumRes, riskRes] = await Promise.all([
          api.get('/api/turnover/danger-zones'),
          api.get('/api/predictions/flight-risk', { params: { top_n: 5 } }),
        ]);
        const dangers = sumRes.data?.danger_zones || [];
        const highRisk = (riskRes.data?.employees || []).filter((e: any) => e.risk_score > 0.8);

        if (dangers.length > 0 || highRisk.length > 0) {
          setHasNotification(true);
          // Build proactive system message
          const parts: string[] = ['**I noticed some things worth your attention:**'];
          if (dangers.length > 0) {
            const worst = dangers[0];
            parts.push(`- ${worst.department} has ${worst.turnover_rate}% turnover — significantly above the ${worst.company_avg}% company average`);
          }
          if (highRisk.length > 0) {
            const depts = [...new Set(highRisk.map((e: any) => e.department))];
            parts.push(`- ${highRisk.length} employees in ${depts.join(', ')} are flagged above 80% flight risk`);
          }
          // Check new hires
          const hireRes = await api.get('/api/workforce/summary');
          if (hireRes.data?.new_hires_90d === 0) {
            parts.push('- No new hires recorded in the last 90 days');
          }

          // Store as a system message to show when panel opens
          const systemMsg: ChatMessage = {
            role: 'system',
            content: parts.join('\n'),
            timestamp: Date.now(),
          };
          setChatMessages([systemMsg]);
        }
      } catch {
        // Non-critical
      }
    }
    checkAnomalies();
  }, []);

  const handleSendMessage = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => [...prev, msg]);
  }, []);

  const handleClearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  const handleChartClick = useCallback((question: string) => {
    setPrefillMessage(question);
    setChatOpen(true);
  }, []);

  const handleOpenChat = useCallback(() => {
    setChatOpen(true);
    setHasNotification(false);
  }, []);

  return (
    <>
      <AmbientBackground />
      <Sidebar />
      <main
        className="relative z-10"
        style={{
          marginLeft: 228,
          marginRight: chatOpen ? 420 : 0,
          padding: '28px 28px 44px',
          maxWidth: chatOpen ? undefined : 1320 + 228,
          minHeight: '100vh',
          transition: 'margin-right 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard onChartClick={handleChartClick} />} />
          <Route path="/workforce" element={<Workforce />} />
          <Route path="/turnover" element={<Turnover />} />
          <Route path="/tenure" element={<Tenure />} />
          <Route path="/flight-risk" element={<FlightRisk />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/managers" element={<Managers />} />
          <Route path="/org" element={<Org />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/pipeline" element={<PipelineHub />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <ChatTrigger
        onClick={handleOpenChat}
        isOpen={chatOpen}
        hasNotification={hasNotification}
      />
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        onClearChat={handleClearChat}
        currentPage={location.pathname}
        prefillMessage={prefillMessage}
        onPrefillConsumed={() => setPrefillMessage(null)}
        onNavigate={navigate}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
