import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import { ConfirmDialog } from '../ConfirmDialog';
import type { Member } from '../../lib/types';
import { SectionHead, RowList, InfoRow } from './parts';

interface AccountSectionProps {
  me: Member;
}

/** Account & sign-in: Entra identity card, read-only identity table, danger-zone deactivate. */
export const AccountSection: React.FC<AccountSectionProps> = ({ me }) => {
  const { logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const roleLabel = me.role
    ? me.role.charAt(0).toUpperCase() + me.role.slice(1)
    : 'Member';

  const deactivate = async () => {
    setConfirmOpen(false);
    showToast('Account deactivated — signing you out.', 'info');
    try { await logout(); } catch { /* logout is best-effort */ }
    router.push('/login');
  };

  return (
    <>
      <SectionHead
        title="Account & sign-in"
        lead="Your identity is managed by MorganWhiteGroup IT through Microsoft Entra ID."
      />

      {/* Entra identity card (teal) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          padding: 15,
          borderRadius: 14,
          marginBottom: 14,
          background: 'rgba(94,234,212,0.05)',
          border: '1px solid rgba(94,234,212,0.2)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(94,234,212,0.12)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v5c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V6z" /><path d="M9.5 12.5l1.8 1.8 3.5-3.6" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#bff3e7' }}>Signed in with Microsoft Entra ID</div>
          <div style={{ fontSize: 11.5, color: '#8b97ab', marginTop: 2 }}>Single sign-on · managed by your IT administrator</div>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="9" height="9" fill="#F25022" /><rect x="13" y="2" width="9" height="9" fill="#7FBA00" /><rect x="2" y="13" width="9" height="9" fill="#00A4EF" /><rect x="13" y="13" width="9" height="9" fill="#FFB900" /></svg>
      </div>

      {/* read-only identity table */}
      <RowList style={{ marginBottom: 26 }}>
        <InfoRow label="Email" value={me.email || '—'} pill="VERIFIED" />
        <InfoRow label="Username" value={me.username || '—'} />
        <InfoRow
          label="Role"
          value={me.title ? `${roleLabel} · ${me.title}` : roleLabel}
        />
        <InfoRow
          label="Password"
          value={
            <span style={{ fontSize: 13, color: '#8b97ab' }}>
              Managed by Entra ID — change it in your Microsoft account
            </span>
          }
        />
      </RowList>

      {/* danger zone */}
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: 'rgba(251,135,164,0.05)',
          border: '1px solid rgba(251,135,164,0.18)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: '#f5c2cf', marginBottom: 4 }}>Danger zone</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, fontSize: 12, color: '#c9a9b1', lineHeight: 1.5 }}>
            Deactivating removes your access to all spaces. Your authored notes stay with the team.
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="cb-set-danger-btn"
            style={{
              flex: '0 0 auto',
              height: 44,
              padding: '0 14px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#fb87a4',
              background: 'transparent',
              border: '1px solid rgba(251,135,164,0.4)',
            }}
          >
            Deactivate account
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate your account?"
        message="You'll be signed out and lose access to all spaces. Your authored notes stay with the team. Contact IT to be reinstated."
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        danger
        onConfirm={deactivate}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

export default AccountSection;
