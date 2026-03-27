import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload as UploadIcon,
  FileUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  File,
  Loader2,
} from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import api from '../lib/api';

interface UploadStatus {
  loaded_rows: number;
  active_count: number;
  departed_count: number;
  loaded_at: string | null;
}

interface UploadedFile {
  name: string;
  size: number;
}

export function Upload() {
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const res = await api.get('/api/upload/status');
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.csv')) {
      setUploadError('Only .csv files are accepted');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/api/upload/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadSuccess(true);
      setUploadedFiles(prev => [...prev, { name: file.name, size: file.size }]);
      await fetchStatus();
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail ?? err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await api.post('/api/upload/reload');
      await fetchStatus();
    } catch {
      // Silently fail
    } finally {
      setReloading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <PageHero
        icon={<UploadIcon size={20} />}
        title="Data Upload"
        subtitle="Upload and manage workforce CSV data"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload zone */}
        <Panel delay={0}>
          <SectionHeader icon={<FileUp size={16} />} title="Upload CSV" subtitle="Drag and drop or click to select" />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="transition-all duration-200"
            style={{
              padding: '40px 20px',
              borderRadius: 12,
              border: `2px dashed ${dragOver ? '#FF8A4C' : 'rgba(255,255,255,0.08)'}`,
              background: dragOver ? 'rgba(255,138,76,0.06)' : 'rgba(255,255,255,0.02)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={e => handleUpload(e.target.files)}
              style={{ display: 'none' }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} style={{ color: '#FF8A4C' }} className="animate-spin" />
                <p style={{ fontSize: 13, color: '#a1a1aa' }}>Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                  style={{ background: 'rgba(255,138,76,0.1)' }}
                >
                  <UploadIcon size={22} style={{ color: '#FF8A4C' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>
                    Drop your CSV file here
                  </p>
                  <p style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                    or click to browse files
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload feedback */}
          {uploadError && (
            <div
              className="flex items-center gap-2 mt-4"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(251,113,133,0.08)',
                border: '1px solid rgba(251,113,133,0.15)',
              }}
            >
              <AlertCircle size={14} style={{ color: '#fb7185', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#fb7185' }}>{uploadError}</p>
            </div>
          )}

          {uploadSuccess && (
            <div
              className="flex items-center gap-2 mt-4"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.15)',
              }}
            >
              <CheckCircle2 size={14} style={{ color: '#34d399', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#34d399' }}>File uploaded successfully</p>
            </div>
          )}

          {/* Uploaded files preview */}
          {uploadedFiles.length > 0 && (
            <div className="mt-5 space-y-2">
              <p style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Uploaded Files
              </p>
              {uploadedFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <File size={14} style={{ color: '#FF8A4C', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#d4d4d8', flex: 1 }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: '#52525b' }}>{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Status panel */}
        <Panel delay={80}>
          <SectionHeader
            icon={<CheckCircle2 size={16} />}
            title="Data Status"
            subtitle="Current dataset information"
            action={
              <button
                onClick={handleReload}
                disabled={reloading}
                className="flex items-center gap-2 transition-all duration-200"
                style={{
                  padding: '7px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,138,76,0.1)',
                  border: '1px solid rgba(255,138,76,0.2)',
                  color: '#FF8A4C',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: reloading ? 'not-allowed' : 'pointer',
                  opacity: reloading ? 0.6 : 1,
                }}
              >
                <RefreshCw size={13} className={reloading ? 'animate-spin' : ''} />
                Reload Data
              </button>
            }
          />

          {statusLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="h-5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: `${60 + n * 8}%`, animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : status ? (
            <div className="space-y-4">
              {[
                { label: 'Total Loaded Rows', value: status.loaded_rows.toLocaleString(), color: '#FF8A4C' },
                { label: 'Active Employees', value: status.active_count.toLocaleString(), color: '#34d399' },
                { label: 'Departed Employees', value: status.departed_count.toLocaleString(), color: '#fb7185' },
                {
                  label: 'Last Loaded',
                  value: status.loaded_at
                    ? new Date(status.loaded_at).toLocaleString()
                    : 'Never',
                  color: '#a78bfa',
                },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#71717a' }}>{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Badge label="Data loaded" color="#34d399" dot />
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-3 py-8"
              style={{ color: '#52525b' }}
            >
              <AlertCircle size={24} />
              <p style={{ fontSize: 13 }}>No data loaded yet. Upload a CSV to get started.</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
