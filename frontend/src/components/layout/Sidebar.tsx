import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingDown, Clock, AlertTriangle,
  GitBranch, UserCheck, Building2, Sparkles,
  Upload, FileText, Settings, ChevronLeft, ChevronRight, Activity,
  User, LogOut, HelpCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_GROUPS = [
  {
    label: 'Overview',
    color: '#FF8A4C',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/workforce', icon: Users, label: 'Workforce' },
    ],
  },
  {
    label: 'Retention',
    color: '#fb7185',
    items: [
      { to: '/turnover', icon: TrendingDown, label: 'Turnover' },
      { to: '/tenure', icon: Clock, label: 'Tenure' },
      { to: '/flight-risk', icon: AlertTriangle, label: 'Flight Risk' },
    ],
  },
  {
    label: 'People',
    color: '#34d399',
    items: [
      { to: '/careers', icon: GitBranch, label: 'Careers' },
      { to: '/managers', icon: UserCheck, label: 'Managers' },
      { to: '/org', icon: Building2, label: 'Org Structure' },
    ],
  },
  {
    label: 'Intelligence',
    color: '#a78bfa',
    items: [
      { to: '/insights', icon: Sparkles, label: 'AI Insights' },
    ],
  },
  {
    label: 'Operations',
    color: '#fbbf24',
    items: [
      { to: '/pipeline', icon: Activity, label: 'Pipeline Hub' },
      { to: '/upload', icon: Upload, label: 'Data Upload' },
      { to: '/reports', icon: FileText, label: 'Reports' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const userName = localStorage.getItem('workforceiq_user_name') || 'User';
  const userRole = localStorage.getItem('workforceiq_user_role') || 'HR Leader';
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <aside
      className="fixed top-0 left-0 h-full z-50 flex flex-col"
      style={{
        width: collapsed ? 60 : 228,
        background: 'rgba(9,9,11,0.96)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        transition: 'width 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="flex items-center gap-2.5 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="fire-orb" style={{ width: 32, height: 32, flexShrink: 0 }} />
        {!collapsed && <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.01em' }}>Workforce IQ</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="mb-4">
            {!collapsed && <p className="text-nav-group px-2 mb-1.5">{group.label}</p>}
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] mb-0.5 transition-all duration-200 relative',
                  isActive ? 'bg-subtle' : 'hover:bg-subtle'
                )}
                style={({ isActive }) => ({ color: isActive ? group.color : '#71717a' })}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2" style={{
                        width: collapsed ? 14 : 2,
                        height: collapsed ? 2 : 14,
                        background: group.color,
                        borderRadius: 2,
                        boxShadow: `0 0 8px ${group.color}40`,
                      }} />
                    )}
                    <item.icon size={16} strokeWidth={isActive ? 2 : 1.6} />
                    {!collapsed && <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User Profile Section */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: collapsed ? '8px 4px' : '8px' }}>
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2.5 w-full rounded-[8px] hover:bg-subtle transition-colors"
            style={{ padding: collapsed ? '8px' : '8px 10px', justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF8A4C20, #e85d0420)',
                border: '1px solid rgba(255,138,76,0.2)',
                fontSize: 10, fontWeight: 700, color: '#FF8A4C',
              }}
            >
              {initials}
            </div>
            {!collapsed && (
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
                <p style={{ fontSize: 10, color: '#52525b' }}>{userRole}</p>
              </div>
            )}
          </button>

          {/* Profile Dropdown */}
          {showProfile && (
            <div
              style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                marginBottom: 4, padding: 4, borderRadius: 12,
                background: 'rgba(19,19,24,0.95)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 -8px 30px rgba(0,0,0,0.4)',
                minWidth: 180, zIndex: 60,
              }}
            >
              <NavLink
                to="/settings"
                onClick={() => setShowProfile(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] hover:bg-subtle transition-colors"
                style={{ color: '#a1a1aa', fontSize: 12 }}
              >
                <User size={14} />
                Profile & Settings
              </NavLink>
              <button
                onClick={() => {
                  setShowProfile(false);
                  localStorage.removeItem('workforceiq_onboarded');
                  window.location.reload();
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] hover:bg-subtle transition-colors w-full"
                style={{ color: '#a1a1aa', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <HelpCircle size={14} />
                Restart Tour
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <button
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] hover:bg-subtle transition-colors w-full"
                style={{ color: '#71717a', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 hover:bg-subtle transition-colors"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#52525b' }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
