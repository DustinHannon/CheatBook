import React, { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useToast } from '../Toast';
import { SectionHead, Eyebrow, RowList } from './parts';

interface SecuritySectionProps {
  supabase: SupabaseClient;
}

/** Best-effort "MacBook Pro · Chrome" style label from the live user agent. */
function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  let os = 'Device';
  if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac';
  else if (/Windows/.test(ua)) os = 'Windows PC';
  else if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  return `${os} · ${browser}`;
}

/** Security: break-glass status, the real current session, sign-out-of-all-other-sessions. */
export const SecuritySection: React.FC<SecuritySectionProps> = ({ supabase }) => {
  const { showToast } = useToast();
  const [device, setDevice] = useState('This device');
  const [signedInAt, setSignedInAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDevice(deviceLabel());
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      // Supabase issues access tokens with an iat claim; surface a coarse age.
      const iat = data.session?.access_token
        ? (() => {
            try {
              const payload = JSON.parse(atob(data.session!.access_token.split('.')[1]));
              return typeof payload.iat === 'number' ? new Date(payload.iat * 1000).toISOString() : null;
            } catch { return null; }
          })()
        : null;
      setSignedInAt(iat);
    });
    return () => { cancelled = true; };
  }, [supabase]);

  const signOutOthers = useCallback(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      showToast('Signed out of all other sessions.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not sign out other sessions.', 'error');
    } finally {
      setBusy(false);
    }
  }, [supabase, showToast]);

  return (
    <>
      <SectionHead
        title="Security"
        lead="Your sign-in is protected by your organization's Entra ID policies."
      />

      {/* break-glass status (amber) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 13,
          padding: 15,
          borderRadius: 14,
          marginBottom: 24,
          background: 'rgba(251,191,114,0.06)',
          border: '1px solid rgba(251,191,114,0.2)',
        }}
      >
        <svg width="18" height="18" style={{ flex: '0 0 auto', marginTop: 1 }} viewBox="0 0 24 24" fill="none" stroke="#fbbf72" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v5c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V6z" /><path d="M9.5 12.5l1.8 1.8 3.5-3.6" /></svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e0d5be' }}>Break-glass access enabled</div>
          <div style={{ fontSize: 11.5, color: '#bfae8c', marginTop: 2, lineHeight: 1.5 }}>
            You can use the emergency account if Entra ID is down. Last used: never. All uses are audit-logged.
          </div>
        </div>
      </div>

      {/* active sessions */}
      <Eyebrow style={{ marginBottom: 10 }}>ACTIVE SESSIONS</Eyebrow>
      <RowList style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', background: 'rgba(255,255,255,0.025)' }}>
          <svg width="18" height="18" style={{ color: '#6ea8fe', flex: '0 0 auto' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#eef2f8' }}>
              {device}
              <span style={{ fontSize: 10, fontWeight: 700, color: '#5eead4', marginLeft: 5 }}>THIS DEVICE</span>
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: '#7c8aa0', marginTop: 2 }}>
              {signedInAt ? `Signed in ${new Date(signedInAt).toLocaleString()}` : 'Active now'}
            </div>
          </div>
        </div>
      </RowList>

      <button
        type="button"
        onClick={signOutOthers}
        disabled={busy}
        className="cb-set-signout-others"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 44,
          padding: '0 16px',
          borderRadius: 11,
          cursor: busy ? 'wait' : 'pointer',
          fontSize: 12.5,
          fontWeight: 700,
          color: '#fb87a4',
          background: 'transparent',
          border: '1px solid rgba(251,135,164,0.35)',
          opacity: busy ? 0.7 : 1,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
        {busy ? 'Signing out…' : 'Sign out of all other sessions'}
      </button>
    </>
  );
};

export default SecuritySection;
