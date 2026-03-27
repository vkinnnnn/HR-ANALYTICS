import { useState } from 'react';
import {
  Settings,
  Database,
  Cpu,
  ShieldAlert,
  Lock,
  FolderOpen,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';

interface SettingRow {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function DisabledEditButton() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        disabled
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1.5"
        style={{
          padding: '5px 12px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#52525b',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'not-allowed',
        }}
      >
        <Lock size={11} />
        Edit
      </button>
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 6,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(9,9,11,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          <p style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>Coming soon</p>
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 16,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>
      )}
    </div>
  );
}

function SettingRowItem({ label, value, icon }: SettingRow) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: '#52525b' }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#71717a' }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d8' }}>{value}</span>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <PageHero
        icon={<Settings size={20} />}
        title="Settings"
        subtitle="Configure data sources and platform parameters"
      />

      <div className="space-y-6">
        {/* Data Source */}
        <Panel delay={0}>
          <SectionHeader
            icon={<Database size={16} />}
            title="Data Source"
            subtitle="Current CSV data directory configuration"
            action={<DisabledEditButton />}
          />
          <div className="space-y-3">
            <SettingRowItem
              label="Data Directory"
              value="./data/"
              icon={<FolderOpen size={14} />}
            />
            <SettingRowItem
              label="Expected Files"
              value="employees.csv, movements.csv"
              icon={<Database size={14} />}
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Badge label="Read-only" color="#71717a" />
            <span style={{ fontSize: 11, color: '#52525b' }}>Configuration is managed via environment variables</span>
          </div>
        </Panel>

        {/* API Configuration */}
        <Panel delay={80}>
          <SectionHeader
            icon={<Cpu size={16} />}
            title="API Configuration"
            subtitle="LLM provider and model settings"
            action={<DisabledEditButton />}
          />
          <div className="space-y-3">
            <SettingRowItem
              label="LLM Provider"
              value="OpenAI"
              icon={<Zap size={14} />}
            />
            <SettingRowItem
              label="Model"
              value="gpt-4o-mini"
              icon={<Cpu size={14} />}
            />
            <SettingRowItem
              label="API Timeout"
              value="30 seconds"
              icon={<Settings size={14} />}
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Badge label="Connected" color="#34d399" dot />
          </div>
        </Panel>

        {/* Flight Risk Thresholds */}
        <Panel delay={160}>
          <SectionHeader
            icon={<ShieldAlert size={16} />}
            title="Flight Risk Thresholds"
            subtitle="Risk classification boundaries for employee retention scoring"
            action={<DisabledEditButton />}
          />
          <div className="space-y-3">
            {[
              {
                level: 'High Risk',
                threshold: '>= 0.70',
                color: '#fb7185',
                description: 'Immediate attention required',
              },
              {
                level: 'Medium Risk',
                threshold: '>= 0.50',
                color: '#fbbf24',
                description: 'Monitor closely',
              },
              {
                level: 'Low Risk',
                threshold: '< 0.50',
                color: '#34d399',
                description: 'Stable retention outlook',
              },
            ].map(item => (
              <div
                key={item.level}
                className="flex items-center justify-between"
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle size={14} style={{ color: item.color }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.level}</span>
                    <p style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{item.description}</p>
                  </div>
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    background: `${item.color}12`,
                    border: `1px solid ${item.color}25`,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>
                    {item.threshold}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Badge label="Default thresholds" color="#71717a" />
            <span style={{ fontSize: 11, color: '#52525b' }}>Adjust thresholds to match your organization's risk tolerance</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
