import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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
import { Chat } from './pages/Chat';
import { Insights } from './pages/Insights';
import { Upload } from './pages/Upload';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/SettingsPage';
import { PipelineHub } from './pages/PipelineHub';

function AppContent() {
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);

  const handleSendMessage = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => [...prev, msg]);
  }, []);

  const handleClearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  // Chart-click integration: any page can call this to auto-open chat with a prefilled question
  const handleChartClick = useCallback((question: string) => {
    setPrefillMessage(question);
    setChatOpen(true);
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
          transition: 'margin-right 280ms cubic-bezier(0.16, 1, 0.3, 1)',
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
          <Route path="/chat" element={<Chat />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/pipeline" element={<PipelineHub />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* AI Chat — always accessible */}
      <ChatTrigger
        onClick={() => setChatOpen(true)}
        isOpen={chatOpen}
      />
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        currentPage={location.pathname}
        prefillMessage={prefillMessage}
        onPrefillConsumed={() => setPrefillMessage(null)}
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
