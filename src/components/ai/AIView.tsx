import { useState } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import ChatView from './ChatView';
import AIHarnessView from './AIHarnessView';
import AgentsView from './AgentsView';

export default function AIView() {
  const state = useDashboardStore();
  const [activeTab, setActiveTab] = useState<string>('assistant');

  const tabs = [
    { id: 'assistant', label: 'Assistant', icon: '\u{1F4AC}' },
    { id: 'harness',   label: 'Harness',   icon: '\u{1F9E0}' },
    { id: 'agents',    label: 'Agents',    icon: '\u{1F916}' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="view-header" style={{ marginBottom: '16px' }}>
        <div>
          <div className="view-title">Intelligence Workspace</div>
          <div className="view-subtitle">Unified AI command center, automated decision harness, and agent monitoring</div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-panel)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: activeTab === tab.id ? 'var(--bg-active)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'assistant' && <ChatView />}
        {activeTab === 'harness'   && <AIHarnessView />}
        {activeTab === 'agents'    && <AgentsView />}
      </div>
    </div>
  );
}