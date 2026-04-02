import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { AmbientBackground } from './components/layout/AmbientBackground';
import { ChatTrigger } from './components/chat/ChatTrigger';
import { ChatPanel, type ChatMessage } from './components/chat/ChatPanel';
import { Dashboard } from './pages/Dashboard';
import { RecognitionExplorer } from './pages/RecognitionExplorer';
import { Categories } from './pages/Categories';
import { Inequality } from './pages/Inequality';
import { Quality } from './pages/Quality';
import { Flow } from './pages/Flow';
import { Nominators } from './pages/Nominators';
import { Fairness } from './pages/Fairness';
import { DataHub } from './pages/DataHub';
import { Workforce } from './pages/Workforce';
import { Turnover } from './pages/Turnover';
import { Tenure } from './pages/Tenure';
import { FlightRisk } from './pages/FlightRisk';
import { Careers } from './pages/Careers';
import { Managers } from './pages/Managers';
import { Org } from './pages/Org';
import { Insights } from './pages/Insights';
import { SettingsPage } from './pages/SettingsPage';
import api from './lib/api';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('wiq_chat');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [hasNotification, setHasNotification] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Persist chat to sessionStorage (debounced)
  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try { sessionStorage.setItem('wiq_chat', JSON.stringify(chatMessages)); } catch {}
    }, 500);
  }, [chatMessages]);

  // First-time onboarding: auto-open chat with welcome message
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('workforceiq_onboarded');
    if (!hasOnboarded) {
      setTimeout(() => {
        setChatOpen(true);
        setHasNotification(false);
        const welcomeMsg: ChatMessage = {
          role: 'system',
          content: '**Welcome to Workforce IQ!** I\'m your AI workforce analyst. I can help you understand your employee data, answer questions, and guide you around the platform.\n\nTry clicking one of the prompts below, or ask me anything about your workforce.',
          timestamp: Date.now(),
        };
        setChatMessages(prev => {
          if (prev.some(m => m.content.includes('Welcome to Workforce IQ'))) return prev;
          return [welcomeMsg, ...prev];
        });
        localStorage.setItem('workforceiq_onboarded', 'true');
      }, 2000);
    }
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setChatOpen(prev => {
          if (!prev) setHasNotification(false);
          return !prev;
        });
      }
      if (e.key === 'Escape' && chatOpen) {
        setChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatOpen]);

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/explorer" element={<RecognitionExplorer />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/inequality" element={<Inequality />} />
          <Route path="/quality" element={<Quality />} />
          <Route path="/flow" element={<Flow />} />
          <Route path="/network" element={<Flow />} />
          <Route path="/nominators" element={<Nominators />} />
          <Route path="/fairness" element={<Fairness />} />
          <Route path="/workforce" element={<Workforce />} />
          <Route path="/turnover" element={<Turnover />} />
          <Route path="/tenure" element={<Tenure />} />
          <Route path="/flight-risk" element={<FlightRisk />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/managers" element={<Managers />} />
          <Route path="/org" element={<Org />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/data-hub" element={<DataHub />} />
          <Route path="/pipeline" element={<DataHub />} />
          <Route path="/upload" element={<DataHub />} />
          <Route path="/reports" element={<DataHub />} />
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
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </BrowserRouter>
  );
}
