import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import api from '@/lib/api';
import { Download, Copy, Loader2 } from 'lucide-react';

interface ReportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reportType?: 'summary' | 'kpis' | 'department';
}

export const ReportPanel: React.FC<ReportPanelProps> = ({ isOpen, onClose, reportType = 'summary' }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, reportType]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (reportType === 'summary') {
        response = await api.get('/brain/report/summary');
        setContent(response.data.summary);
      } else if (reportType === 'kpis') {
        response = await api.get('/brain/report/kpis');
        setContent(JSON.stringify(response.data, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text('Workforce Intelligence Report', 20, 20);
      
      doc.setFontSize(10);
      const lines = content.split('\n');
      let yPos = 40;
      
      lines.forEach((line) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 20, yPos);
        yPos += 7;
      });
      
      doc.save(`report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      alert('Failed to generate PDF: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      alert('Report copied to clipboard');
    } catch {
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[600px] flex flex-col bg-bg-raised border-border-subtle">
        <SheetHeader>
          <SheetTitle className="text-text-primary">
            {reportType === 'summary' && 'Executive Summary'}
            {reportType === 'kpis' && 'KPI Export'}
            {reportType === 'department' && 'Department Report'}
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-accent-orange" />
          </div>
        )}

        {error && (
          <div className="text-text-secondary text-sm p-4 bg-rose-muted rounded-lg">
            {error}
          </div>
        )}

        {!loading && content && (
          <div className="flex-1 overflow-y-auto">
            <pre className="text-text-secondary text-xs p-4 bg-bg-base rounded-lg whitespace-pre-wrap break-words">
              {content}
            </pre>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t border-border-subtle">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-accent-orange text-text-inverse rounded-lg hover:opacity-90 transition"
            disabled={loading}
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-subtle text-text-primary rounded-lg hover:bg-bg-raised transition"
            disabled={loading}
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
