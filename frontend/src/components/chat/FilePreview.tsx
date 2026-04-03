import { X, FileText, Image, FileSpreadsheet } from 'lucide-react';

interface FilePreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  json: FileText,
  png: Image,
  jpg: Image,
  jpeg: Image,
};

function getIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || FileText;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function FilePreview({ files, onRemove }: FilePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 0' }}>
      {files.map((file, i) => {
        const Icon = getIcon(file.name);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px 4px 10px',
              borderRadius: 8,
              background: 'rgba(255,138,76,0.06)',
              border: '1px solid rgba(255,138,76,0.15)',
              fontSize: 11,
              color: '#a1a1aa',
            }}
          >
            <Icon size={13} style={{ color: '#FF8A4C', flexShrink: 0 }} />
            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </span>
            <span style={{ color: '#52525b', fontSize: 10 }}>{formatSize(file.size)}</span>
            <button
              onClick={() => onRemove(i)}
              style={{
                width: 16, height: 16, borderRadius: 4,
                background: 'transparent', border: 'none',
                color: '#52525b', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
