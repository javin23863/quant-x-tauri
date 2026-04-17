import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ProfileData {
  id: string;
  name: string;
  description: string;
}

interface ActiveProfile {
  profile: ProfileData;
  updatedAt: string | null;
  propFirmMode: boolean;
  propProfileId: string | null;
}

interface ProfilesResponse {
  profiles: ProfileData[];
  active: ActiveProfile;
}

interface SwitchResponse {
  ok: boolean;
  active?: ActiveProfile;
  error?: string;
}

function ProfileBadge({ profile, propMode }: { profile: string; propMode: boolean }) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    quant_x_light: { bg: 'rgba(59,130,246,0.15)', border: '#3B82F6', text: '#60A5FA' },
    quant_x_live: { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#34D399' },
  };
  const c = colors[profile] || colors.quant_x_light;
  const label = profile === 'quant_x_light' ? 'Light' : 'Live';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' as const, color: c.text }}>{label}</span>
      {propMode && <span style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid #8B5CF6', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' as const, color: '#A78BFA' }}>PROP</span>}
    </div>
  );
}

export default function ProfileView() {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [active, setActive] = useState<ActiveProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  async function fetchProfiles() {
    try {
      const data = await invoke<ProfilesResponse>('profiles');
      setProfiles(data.profiles || []);
      setActive(data.active);
      setLoading(false);
      setError(null);
    } catch (err: any) {
      setError(err?.message || String(err));
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfiles();
    const interval = setInterval(fetchProfiles, 10000);
    return () => clearInterval(interval);
  }, []);

  async function switchProfile(profileId: string) {
    setSwitching(true);
    try {
      const data = await invoke<SwitchResponse>('profiles_switch', { profileId });
      if (data.ok && data.active) {
        setActive(data.active);
      } else {
        setError(data.error || 'Switch failed');
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSwitching(false);
    }
  }

  async function togglePropFirm() {
    setSwitching(true);
    try {
      const cmd = active?.propFirmMode ? 'profiles_prop_disable' : 'profiles_prop_enable';
      const data = await invoke<SwitchResponse>(cmd, { propProfileId: 'lucid_50k_flex' });
      if (data.ok && data.active) {
        setActive(data.active);
      } else {
        setError(data.error || 'Toggle failed');
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSwitching(false);
    }
  }

  if (loading) {
    return <div className="profile-view"><div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div></div>;
  }

  if (error) {
    return <div className="profile-view"><div style={{ color: 'var(--accent-red)', fontSize: 12 }}>{`Error: ${error}`}</div></div>;
  }

  return (
    <div className="profile-view" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Profile</span>
          {active && <ProfileBadge profile={active.profile?.id} propMode={active.propFirmMode} />}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{active?.updatedAt ? `Updated ${new Date(active.updatedAt).toLocaleTimeString()}` : 'Not saved'}</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Base Profile</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {profiles?.map((p: ProfileData) => (
            <button key={p.id} onClick={() => switchProfile(p.id)} disabled={switching || active?.profile?.id === p.id} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: active?.profile?.id === p.id ? '1px solid #10B981' : '1px solid var(--border-subtle)', background: active?.profile?.id === p.id ? 'rgba(16,185,129,0.1)' : 'var(--bg-panel)', color: active?.profile?.id === p.id ? '#10B981' : 'var(--text-secondary)', cursor: active?.profile?.id === p.id ? 'default' : 'pointer', fontSize: 12, fontWeight: active?.profile?.id === p.id ? 600 : 400, transition: 'all 0.2s' }}>
              <div>{p.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 12 }}>Prop Firm Mode</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{active?.propFirmMode ? `Active: ${active.propProfileId}` : 'Additive parallel evaluation'}</div>
        </div>
        <button onClick={togglePropFirm} disabled={switching} style={{ padding: '6px 14px', borderRadius: 6, border: active?.propFirmMode ? '1px solid #EF4444' : '1px solid #10B981', background: active?.propFirmMode ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: active?.propFirmMode ? '#EF4444' : '#10B981', cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.2s' }}>
          {active?.propFirmMode ? 'Disable' : 'Enable'}
        </button>
      </div>

      {active?.propFirmMode && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>Prop profiles: lucid_50k_flex</div>}
    </div>
  );
}