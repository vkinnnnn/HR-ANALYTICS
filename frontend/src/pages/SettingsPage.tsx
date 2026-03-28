import { useState, useEffect } from 'react';
import {
  Settings, Database, Cpu, ShieldAlert, FolderOpen, Zap, AlertTriangle,
  Check, Loader2, RefreshCw, User, Building,
} from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import api from '../lib/api';

interface LLMConfig {
  provider: string;
  model: string;
  has_key: boolean;
  has_openai_key: boolean;
  has_openrouter_key: boolean;
  is_available: boolean;
  available_models: { id: string; name: string; tier: string }[];
  available_providers: string[];
}

export function SettingsPage() {
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await api.get('/api/settings/llm');
      setLlmConfig(res.data);
      setSelectedProvider(res.data.provider);
      setSelectedModel(res.data.model);
    } catch {
      // Settings endpoint may not be available
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.post('/api/settings/llm', {
        provider: selectedProvider,
        model: selectedModel,
      });
      setLlmConfig(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update settings', err);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = llmConfig && (selectedProvider !== llmConfig.provider || selectedModel !== llmConfig.model);

  // Get models for the selected provider
  const providerModels = llmConfig?.available_models || [];

  // When provider changes, update models list
  async function handleProviderChange(provider: string) {
    setSelectedProvider(provider);
    // Temporarily save to get new models list
    try {
      const res = await api.post('/api/settings/llm', { provider });
      setLlmConfig(res.data);
      if (res.data.available_models?.length) {
        setSelectedModel(res.data.available_models[0].id);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <PageHero
        icon={<Settings size={20} />}
        title="Settings"
        subtitle="Configure LLM providers, models, and platform parameters."
      />

      <div style={{ display: 'grid', gap: 20 }}>
        {/* User Profile + Company */}
        <ProfileSection />

        {/* LLM Provider Configuration */}
        <Panel delay={0}>
          <SectionHeader
            icon={<Zap size={16} />}
            title="AI / LLM Configuration"
            subtitle="Choose your language model provider and model"
            action={
              llmConfig?.is_available
                ? <Badge label="Connected" color="#34d399" dot />
                : <Badge label="No API Key" color="#fbbf24" dot />
            }
          />

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 48, background: 'rgba(255,255,255,0.03)', borderRadius: 10, animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Provider Select */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717a', display: 'block', marginBottom: 8 }}>
                  Provider
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {['openrouter', 'openai'].map(p => (
                    <button
                      key={p}
                      onClick={() => handleProviderChange(p)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        background: selectedProvider === p ? 'rgba(255,138,76,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${selectedProvider === p ? 'rgba(255,138,76,0.25)' : 'rgba(255,255,255,0.06)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 150ms',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: selectedProvider === p ? '#FF8A4C' : '#fafafa' }}>
                            {p === 'openrouter' ? 'OpenRouter' : 'OpenAI'}
                          </p>
                          <p style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>
                            {p === 'openrouter' ? 'Free & paid models · 200+ models' : 'GPT-4o, GPT-4.1, o3-mini · Paid'}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: (p === 'openrouter' ? llmConfig?.has_openrouter_key : llmConfig?.has_openai_key) ? '#34d399' : '#fb7185',
                            }} />
                            <span style={{ fontSize: 10, color: '#52525b' }}>
                              {(p === 'openrouter' ? llmConfig?.has_openrouter_key : llmConfig?.has_openai_key) ? 'API key configured' : 'No API key'}
                            </span>
                          </div>
                        </div>
                        {selectedProvider === p && (
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#FF8A4C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} color="#fff" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Select */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717a', display: 'block', marginBottom: 8 }}>
                  Model
                </label>
                <div style={{ display: 'grid', gap: 8 }}>
                  {providerModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: selectedModel === m.id ? 'rgba(255,138,76,0.06)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${selectedModel === m.id ? 'rgba(255,138,76,0.20)' : 'rgba(255,255,255,0.04)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 150ms',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: selectedModel === m.id ? '#FF8A4C' : 'rgba(255,255,255,0.08)',
                            transition: 'background 150ms',
                          }}
                        />
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: selectedModel === m.id ? '#fafafa' : '#a1a1aa' }}>
                            {m.name}
                          </span>
                          <span style={{ fontSize: 10, color: '#52525b', marginLeft: 8, fontFamily: 'monospace' }}>
                            {m.id}
                          </span>
                        </div>
                      </div>
                      <Badge
                        label={m.tier === 'free' ? 'Free' : 'Paid'}
                        color={m.tier === 'free' ? '#34d399' : '#fbbf24'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 9999,
                    background: hasChanges
                      ? 'linear-gradient(135deg, #FF8A4C, #e85d04)'
                      : 'rgba(255,255,255,0.04)',
                    border: 'none',
                    color: hasChanges ? '#fff' : '#52525b',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: hasChanges ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 200ms',
                  }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <RefreshCw size={14} />}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Apply Changes'}
                </button>
                {saved && (
                  <span style={{ fontSize: 12, color: '#34d399', fontWeight: 500 }}>
                    Model updated successfully
                  </span>
                )}
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginTop: 4 }}>
                <p style={{ fontSize: 11, color: '#52525b', lineHeight: 1.5 }}>
                  <strong style={{ color: '#71717a' }}>Chat</strong> uses the selected model above.{' '}
                  <strong style={{ color: '#71717a' }}>Reports</strong> always use{' '}
                  <span style={{ color: '#a78bfa', fontFamily: 'monospace', fontSize: 10 }}>GPT-4o</span>{' '}
                  via OpenAI for premium quality{llmConfig?.has_openai_key ? '' : ' (key not set — will fallback to selected model)'}.
                </p>
              </div>
            </div>
          )}
        </Panel>

        {/* Data Source */}
        <Panel delay={80}>
          <SectionHeader
            icon={<Database size={16} />}
            title="Data Source"
            subtitle="CSV data directory configuration"
          />
          <div style={{ display: 'grid', gap: 10 }}>
            <SettingRow label="Data Directory" value="wh_Dataset/" icon={<FolderOpen size={14} />} />
            <SettingRow label="Employee Master" value="function_wh.csv (2,466 rows)" icon={<Database size={14} />} />
            <SettingRow label="Job History" value="wh_history_full.csv (11,803 rows)" icon={<Database size={14} />} />
            <SettingRow label="Enriched Subset" value="wh_user_history_v2.csv (100 rows)" icon={<Database size={14} />} />
          </div>
        </Panel>

        {/* Flight Risk Thresholds */}
        <Panel delay={160}>
          <SectionHeader
            icon={<ShieldAlert size={16} />}
            title="Flight Risk Thresholds"
            subtitle="Risk classification boundaries"
          />
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { level: 'High Risk', threshold: '>= 0.70', color: '#fb7185', desc: 'Immediate attention required' },
              { level: 'Medium Risk', threshold: '>= 0.50', color: '#fbbf24', desc: 'Monitor closely' },
              { level: 'Low Risk', threshold: '< 0.50', color: '#34d399', desc: 'Stable retention outlook' },
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
                    <p style={{ fontSize: 11, color: '#52525b', marginTop: 1 }}>{item.desc}</p>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: item.color, fontFamily: 'monospace', padding: '4px 12px', borderRadius: 8, background: `${item.color}12`, border: `1px solid ${item.color}25` }}>
                  {item.threshold}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ProfileSection() {
  const [name, setName] = useState(localStorage.getItem('workforceiq_user_name') || '');
  const [role, setRole] = useState(localStorage.getItem('workforceiq_user_role') || 'HR Leader');
  const [company, setCompany] = useState(localStorage.getItem('workforceiq_company') || 'Workhuman');
  const [industry, setIndustry] = useState(localStorage.getItem('workforceiq_industry') || 'Technology');
  const [profileSaved, setProfileSaved] = useState(false);

  function saveProfile() {
    localStorage.setItem('workforceiq_user_name', name);
    localStorage.setItem('workforceiq_user_role', role);
    localStorage.setItem('workforceiq_company', company);
    localStorage.setItem('workforceiq_industry', industry);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
    color: '#fafafa', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  };

  return (
    <Panel delay={0}>
      <SectionHeader icon={<User size={16} />} title="Profile & Company" subtitle="Your identity and organization settings" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717a', display: 'block', marginBottom: 6 }}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717a', display: 'block', marginBottom: 6 }}>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="CEO">CEO</option>
            <option value="CHRO">CHRO</option>
            <option value="VP of People">VP of People</option>
            <option value="HR Director">HR Director</option>
            <option value="HR Manager">HR Manager</option>
            <option value="HR Business Partner">HR Business Partner</option>
            <option value="HR Leader">HR Leader</option>
            <option value="People Analyst">People Analyst</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717a', display: 'block', marginBottom: 6 }}>Company</label>
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717a', display: 'block', marginBottom: 6 }}>Industry</label>
          <select value={industry} onChange={e => setIndustry(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="Technology">Technology</option>
            <option value="Finance">Finance</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Retail">Retail</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Professional Services">Professional Services</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={saveProfile}
          style={{
            padding: '10px 24px', borderRadius: 9999,
            background: 'linear-gradient(135deg, #FF8A4C, #e85d04)',
            border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {profileSaved ? <Check size={14} /> : <Building size={14} />}
          {profileSaved ? 'Saved!' : 'Save Profile'}
        </button>
        {profileSaved && <span style={{ fontSize: 12, color: '#34d399' }}>Profile updated</span>}
      </div>
    </Panel>
  );
}

function SettingRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
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
