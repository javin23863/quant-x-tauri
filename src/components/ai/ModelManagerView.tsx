import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  role: string;
  status?: string;
}

interface ApiToken {
  id: string;
  name: string;
  token?: string;
  createdAt?: string;
  lastUsed?: string;
}

interface BackupModel {
  id: string;
  name: string;
  status: string;
  capabilities: string[];
  description: string;
  offline: boolean;
}

export default function ModelManagerView() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProvider, setNewProvider] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelId: '',
    role: 'Research Director'
  });

  const providerPresets = [
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', placeholder: 'gpt-4, gpt-4-turbo, gpt-3.5-turbo' },
    { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', placeholder: 'claude-4.6-sonnet, claude-3-opus, claude-3-sonnet' },
    { id: 'google', name: 'Google AI', baseUrl: 'https://generativelanguage.googleapis.com/v1', placeholder: 'gemini-3.1-pro-reasoning, gemini-3.1-flash' },
    { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', placeholder: 'deepseek/deepseek-r1-671b, openai/gpt-5.2-high, qwen/qwq-32b' },
    { id: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', placeholder: 'mistral-large, mistral-medium, mistral-small' },
    { id: 'ollama', name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', placeholder: 'llama3, qwen2.5, mistral' },
    { id: 'vera-x', name: 'Vera-X Proxy', baseUrl: 'http://localhost:8080/v1', placeholder: 'glm-5, kimi-k2.5, qwen3-coder' },
    { id: 'energent', name: 'Energent.ai', baseUrl: 'https://api.energent.ai/v1', placeholder: 'energent-finance-agent' }
  ];

  const backupModels: BackupModel[] = [
    { id: 'fingpt', name: 'FinGPT', status: 'Online', capabilities: ['Sentiment analysis', 'Entity extraction'], description: 'Local calculation engine for financial NLP', offline: true },
    { id: 'finr1', name: 'FinR1', status: 'Online', capabilities: ['Risk metrics', 'Greeks calculation', 'Monte Carlo simulation'], description: 'Local calculation engine for quantitative analysis', offline: true }
  ];

  const finR1Alternatives = [
    'DeepSeek-R1-671B',
    'Gemini 3.1 Pro (Reasoning)',
    'Qwen3-235B-A22B',
    'QwQ-32B',
    'Kimi K2.5',
    'GPT-5.2 (High)'
  ];

  const finGPTAlternatives = [
    'Claude 4.6 Sonnet',
    'Gemini 3.1 Flash',
    'GLM-5',
    'Mistral Small 3',
    'Energent.ai Finance Agent',
    'Llama 4 Scout'
  ];

  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokensLoading, setTokensLoading] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const data = await invoke<{ ok: boolean; providers?: Provider[] }>('models_providers');
      if (data.ok) {
        setProviders(data.providers || []);
      }
    } catch {
      setProviders([
        { id: 'sample-local', name: 'Sample Local (Dummy)', baseUrl: 'http://localhost:11434/v1', modelId: 'llama3', role: 'Quant Analyst', status: 'ready' }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchApiTokens = useCallback(async () => {
    setTokensLoading(true);
    try {
      const data = await invoke<{ ok: boolean; tokens?: ApiToken[] }>('auth_tokens_list');
      if (data.ok) {
        setApiTokens(data.tokens || []);
      }
    } catch {
      setApiTokens([]);
    } finally {
      setTokensLoading(false);
    }
  }, []);

  const handleGenerateToken = async () => {
    if (!newTokenName.trim()) return;
    try {
      const data = await invoke<{ ok: boolean; token?: string; error?: string }>('auth_tokens', { name: newTokenName.trim() });
      if (data.ok && data.token) {
        setGeneratedToken(data.token);
        setNewTokenName('');
        fetchApiTokens();
      } else {
        setError(data.error || 'Failed to generate token');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    try {
      const data = await invoke<{ ok: boolean; error?: string }>('auth_tokens_revoke', { tokenId });
      if (data.ok) {
        fetchApiTokens();
      } else {
        setError(data.error || 'Failed to revoke token');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const formatDate = (isoString?: string): string => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const maskToken = (token?: string): string => {
    if (!token || token.length < 12) return token || '';
    return token.substring(0, 8) + '...' + token.substring(token.length - 4);
  };

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    fetchApiTokens();
  }, [fetchApiTokens]);

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.baseUrl) return;
    try {
      const data = await invoke<{ ok: boolean }>('models_providers', newProvider);
      if (data.ok) {
        fetchProviders();
        setNewProvider({ name: '', baseUrl: '', apiKey: '', modelId: '', role: 'Research Director' });
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const activePlaceholder = (() => {
    const p = providerPresets.find(pr => pr.name === newProvider.name);
    return p ? p.placeholder : 'gpt-4, llama3, etc.';
  })();

  return (
    <div className="mission-tab-frame">
      <div className="view-header">
        <div>
          <div className="view-title">Model Manager</div>
          <div className="view-subtitle">Connect and assign AI models to system roles (BYO Model)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
              <span className="panel-title">Connected Providers</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {providers.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No models connected yet. Add a provider to get started.
                </div>
              ) : providers.map(p => (
                <div key={p.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: '8px' 
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.baseUrl} &middot; {p.modelId}</div>
                    <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--accent-blue)', textTransform: 'uppercase' as const }}>{p.role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: '10px', 
                      color: p.status === 'ready' ? 'var(--accent-green)' : 'var(--accent-red)',
                      fontWeight: 700
                    }}>
                      {(p.status || 'OFFLINE').toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: '12px' }}>
              <span className="panel-title">2026 Fallback Ladders</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  Quant Reasoning (FinR1 Alt)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {finR1Alternatives.map(name => (
                    <div key={name} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>- {name}</div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  Financial NLP (FinGPT Alt)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {finGPTAlternatives.map(name => (
                    <div key={name} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>- {name}</div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)' }}>
              Auto-switching is enabled: models fail over on errors and latency degradation.
            </div>
          </div>

          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
              <span className="panel-title">Add New Provider</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Provider Preset
              </label>
              <select 
                className="factory-select"
                style={{ width: '100%' }}
                onChange={e => {
                  const preset = providerPresets.find(p => p.id === e.target.value);
                  if (preset) {
                    setNewProvider({
                      ...newProvider,
                      name: preset.name,
                      baseUrl: preset.baseUrl,
                      modelId: ''
                    });
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select a provider...</option>
                {providerPresets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Name</label>
                <input 
                  className="factory-input" 
                  value={newProvider.name} 
                  onChange={e => setNewProvider({...newProvider, name: e.target.value})}
                  placeholder="e.g. Local Ollama" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Base URL</label>
                <input 
                  className="factory-input" 
                  value={newProvider.baseUrl} 
                  onChange={e => setNewProvider({...newProvider, baseUrl: e.target.value})}
                  placeholder="https://api.openai.com/v1" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API Key</label>
                <input 
                  className="factory-input" 
                  type="password"
                  value={newProvider.apiKey} 
                  onChange={e => setNewProvider({...newProvider, apiKey: e.target.value})}
                  placeholder="sk-..." 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Model ID</label>
                <input 
                  className="factory-input" 
                  value={newProvider.modelId} 
                  onChange={e => setNewProvider({...newProvider, modelId: e.target.value})}
                  placeholder={activePlaceholder}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Assigned Role</label>
                <select 
                  className="factory-select" 
                  value={newProvider.role} 
                  onChange={e => setNewProvider({...newProvider, role: e.target.value})}
                >
                  <option>Research Director</option>
                  <option>Trade Manager</option>
                  <option>Quant Analyst</option>
                </select>
              </div>
            </div>
            <button 
              className="not-found-btn" 
              onClick={handleAddProvider}
              style={{ width: '100%', marginTop: '16px', background: 'var(--accent-blue)', color: '#fff', border: 'none' }}
            >
              Connect Provider
            </button>
          </div>

          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: '12px' }}>
              <span className="panel-title">Backup Models</span>
              <span style={{ 
                fontSize: '9px', 
                background: 'rgba(0,200,83,0.15)', 
                color: 'var(--accent-green)', 
                padding: '2px 6px', 
                borderRadius: '4px',
                marginLeft: '8px'
              }}>
                OFFLINE READY
              </span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Local calculation engines &mdash; no API keys required
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {backupModels.map(model => (
                <div key={model.id} style={{ 
                  padding: '12px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {model.name}
                    </div>
                    <div style={{ 
                      fontSize: '9px', 
                      color: 'var(--accent-green)', 
                      background: 'rgba(0,200,83,0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>
                      {model.status}
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {model.description}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px' }}>
                    {model.capabilities.map(cap => (
                      <span key={cap} style={{
                        fontSize: '9px',
                        background: 'rgba(100,108,255,0.1)',
                        color: 'var(--accent-blue)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid rgba(100,108,255,0.2)'
                      }}>
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header">
              <span className="panel-title">Role Mapping</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {[
                { role: 'Research Director', desc: 'Strategy generation & hypothesis synthesis' },
                { role: 'Trade Manager', desc: 'Execution approval & risk validation' },
                { role: 'Quant Analyst', desc: 'Market sentiment & macro analysis' }
              ].map(r => (
                <div key={r.role} style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>{r.role}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.desc}</div>
                  <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Active: {(() => {
                      const p = providers.find(pr => pr.role === r.role);
                      return p ? p.name : 'None (Fallback to Local)';
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header">
              <span className="panel-title">API Key Manager</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Manage QXL API tokens for external integrations
              </div>

              {generatedToken && (
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(0,200,83,0.1)', 
                  border: '1px solid rgba(0,200,83,0.3)', 
                  borderRadius: '6px' 
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--accent-green)', marginBottom: '8px', fontWeight: 600 }}>
                    Token Generated (copy now &mdash; won&apos;t be shown again)
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    background: 'rgba(0,0,0,0.3)', 
                    padding: '8px', 
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all' as const
                  }}>
                    <span style={{ flex: 1 }}>{generatedToken}</span>
                    <button 
                      onClick={() => copyToClipboard(generatedToken)}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '10px', 
                        background: 'var(--accent-blue)', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap' as const
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  className="factory-input" 
                  value={newTokenName} 
                  onChange={e => setNewTokenName(e.target.value)}
                  placeholder="Token name (e.g. CLI, Bot)" 
                  style={{ flex: 1 }}
                />
                <button 
                  className="not-found-btn" 
                  onClick={handleGenerateToken}
                  disabled={!newTokenName.trim()}
                  style={{ 
                    background: newTokenName.trim() ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                    color: newTokenName.trim() ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    opacity: newTokenName.trim() ? 1 : 0.6
                  }}
                >
                  Generate
                </button>
              </div>

              <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '8px', color: 'var(--text-secondary)' }}>
                Active Tokens ({apiTokens.length})
              </div>

              {tokensLoading ? (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                  Loading tokens...
                </div>
              ) : apiTokens.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                  No API tokens yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' as const }}>
                  {apiTokens.map(token => (
                    <div key={token.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '10px', 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border-subtle)', 
                      borderRadius: '6px' 
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {token.name || 'Unnamed Token'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {maskToken(token.token)}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Created: {formatDate(token.createdAt)}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          Last used: {formatDate(token.lastUsed)}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRevokeToken(token.id)}
                        style={{ 
                          padding: '4px 8px', 
                          fontSize: '10px', 
                          background: 'rgba(255,82,82,0.1)', 
                          color: 'var(--accent-red)', 
                          border: '1px solid rgba(255,82,82,0.3)', 
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}