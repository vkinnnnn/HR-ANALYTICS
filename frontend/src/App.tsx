import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { AmbientBackground } from './components/layout/AmbientBackground';
import { ChatTrigger } from './components/chat/ChatTrigger';
import { ChatPanel } from './components/chat/ChatPanel';
import { useChatStore } from './stores/chatStore';
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
import LandingPage from './pages/LandingPage';
import api from './lib/api';

function AppContent() {
  const { isOpen, openPanel, closePanel, togglePanel, addMessage } = useChatStore();
  const [hasNotification, setHasNotification] = useState(false);

  // First-time onboarding
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('workforceiq_onboarded');
    if (!hasOnboarded) {
      setTimeout(() => {
        openPanel();
        setHasNotification(false);
        const currentMessages = useChatStore.getState().messages;
        if (!currentMessages.some(m => m.content.includes('Welcome to Workforce IQ'))) {
          addMessage({
            role: 'system',
            content: '**Welcome to Workforce IQ!** I\'m your AI workforce analyst powered by **The Brain**. I can analyze your data, answer questions, generate reports, and guide you around the platform.\n\nTry clicking a prompt below, or ask me anything.',
          });
        }
        localStorage.setItem('workforceiq_onboarded', 'true');
      }, 2000);
    }
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePanel();
        if (!isOpen) setHasNotification(false);
      }
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, togglePanel, closePanel]);

  // Proactive insights
  useEffect(() => {
    async function checkAnomalies() {
      try {
        const [sumRes, riskRes] = await Promise.all([
          api.get('/api/turnover/danger-zones'),
          api.get('/api/predictions/flight-risk', { params: { top_n: 5 } }),
        ]);
        const dangers = sumRes.data?.danger_zones || [];
        const highRisk = (riskRes.data?.employees || []).filter((e: Record<string, unknown>) => (e.risk_score as number) > 0.8);

        if (dangers.length > 0 || highRisk.length > 0) {
          setHasNotification(true);
          const parts: string[] = ['**I noticed some things worth your attention:**'];
          if (dangers.length > 0) {
            const worst = dangers[0];
            parts.push(`- ${worst.department} has ${worst.turnover_rate}% turnover — significantly above the ${worst.company_avg}% company average`);
          }
          if (highRisk.length > 0) {
            const depts = [...new Set(highRisk.map((e: Record<string, unknown>) => e.department))];
            parts.push(`- ${highRisk.length} employees in ${depts.join(', ')} are flagged above 80% flight risk`);
          }

          const currentMessages = useChatStore.getState().messages;
          if (!currentMessages.some(m => m.content.includes('noticed some things'))) {
            addMessage({
              role: 'system',
              content: parts.join('\n'),
            });
          }
        }
      } catch {
        // Non-critical
      }
    }
    checkAnomalies();
  }, []);

  const handleOpenChat = useCallback(() => {
    openPanel();
    setHasNotification(false);
  }, [openPanel]);

  return (
    <>
      <AmbientBackground />
      <Sidebar />
      <main
        className="relative z-10"
        style={{
          marginLeft: 228,
          marginRight: isOpen ? 420 : 0,
          padding: '28px 28px 44px',
          maxWidth: isOpen ? undefined : 1320 + 228,
          minHeight: '100vh',
          transition: 'margin-right 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Routes>
          <Route path="" element={<Dashboard />} />
          <Route path="workforce" element={<Workforce />} />
          <Route path="turnover" element={<Turnover />} />
          <Route path="tenure" element={<Tenure />} />
          <Route path="flight-risk" element={<FlightRisk />} />
          <Route path="careers" element={<Careers />} />
          <Route path="managers" element={<Managers />} />
          <Route path="org" element={<Org />} />
          <Route path="chat" element={<Chat />} />
          <Route path="insights" element={<Insights />} />
          <Route path="upload" element={<Upload />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <ChatTrigger
        onClick={handleOpenChat}
        isOpen={isOpen}
        hasNotification={hasNotification}
      />
      <ChatPanel />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app/*" element={<AppContent />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
