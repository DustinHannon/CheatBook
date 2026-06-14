import React, { useState, useId } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';

/**
 * LoginCard — centered glass auth card (the page renders the aurora + centering).
 * Brand lockup + Entra SSO primary action + expandable break-glass panel.
 * Styles/SVGs lifted verbatim from designideas/design-references/Login.dc.html.
 */
export const LoginCard: React.FC = () => {
  const { signInEntra, signInBreakGlass } = useAuth();
  const router = useRouter();

  const [entraPending, setEntraPending] = useState(false);
  const [entraErr, setEntraErr] = useState('');

  const [breakOpen, setBreakOpen] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [breakPending, setBreakPending] = useState(false);
  const [breakErr, setBreakErr] = useState('');

  const userId = useId();
  const passId = useId();
  const panelId = useId();

  const signEntra = async () => {
    if (entraPending) return;
    setEntraErr('');
    setEntraPending(true);
    try {
      await signInEntra();
      // On success the browser redirects to Microsoft; keep the spinner up.
    } catch (e) {
      setEntraErr(e instanceof Error ? e.message : 'Unable to start Microsoft sign-in.');
      setEntraPending(false);
    }
  };

  const signBreak = async () => {
    if (breakPending) return;
    if (!user.trim() || !pass) {
      setBreakErr('Enter both username and password.');
      return;
    }
    setBreakErr('');
    setBreakPending(true);
    try {
      await signInBreakGlass(user.trim(), pass);
      router.push('/');
    } catch (e) {
      setBreakErr(e instanceof Error ? e.message : 'Invalid break-glass credentials.');
      setBreakPending(false);
    }
  };

  const toggleBreak = () => {
    setBreakErr('');
    setBreakOpen((v) => !v);
  };

  const onBreakKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleBreak();
    }
  };

  const onPassKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      signBreak();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        width: 'min(424px, 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(150deg,#6ea8fe,#8a7bff)',
            boxShadow:
              '0 8px 22px -6px rgba(110,168,254,0.7),inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-on-accent)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
            <path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />
          </svg>
        </div>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em' }}>CheatBook</div>
          <div
            style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--text-4)',
              marginTop: 4,
            }}
          >
            IT · ENGINEERING
          </div>
        </div>
      </div>

      {/* card */}
      <div
        style={{
          width: '100%',
          borderRadius: 22,
          padding: '30px 28px 24px',
          background:
            'linear-gradient(180deg,rgba(255,255,255,0.058),rgba(255,255,255,0.022))',
          backdropFilter: 'blur(36px) saturate(165%)',
          WebkitBackdropFilter: 'blur(36px) saturate(165%)',
          border: '1px solid var(--hairline)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.08),0 30px 80px -32px rgba(0,0,0,0.9)',
        }}
      >
        <h1
          style={{
            margin: '0 0 7px',
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            textAlign: 'center',
          }}
        >
          Sign In
        </h1>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'var(--text-3)',
            textAlign: 'center',
          }}
        >
          Access the org&apos;s runbooks, incidents and knowledge.
        </p>

        {/* Entra SSO (primary) */}
        <button
          type="button"
          onClick={signEntra}
          disabled={entraPending}
          aria-busy={entraPending}
          className="group"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            height: 52,
            border: 'none',
            borderRadius: 13,
            cursor: entraPending ? 'default' : 'pointer',
            background: '#ffffff',
            color: '#1a1d23',
            fontSize: 14.5,
            fontWeight: 700,
            fontFamily: "'Manrope',system-ui,sans-serif",
            boxShadow:
              '0 10px 26px -10px rgba(0,0,0,0.6),inset 0 0 0 1px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={(e) => {
            if (!entraPending) e.currentTarget.style.background = '#f1f3f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
          }}
        >
          {entraPending ? (
            <>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2.4px solid rgba(26,29,35,0.25)',
                  borderTopColor: '#1a1d23',
                  animation: 'cbSpin .7s linear infinite',
                }}
              />
              <span>Redirecting to Microsoft…</span>
            </>
          ) : (
            <>
              <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
              </svg>
              <span>Sign in with Microsoft Entra ID</span>
            </>
          )}
        </button>

        {entraErr && (
          <div
            role="alert"
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: 'var(--danger)',
              textAlign: 'center',
              margin: '10px 0 0',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {entraErr}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            marginTop: 14,
            color: 'var(--text-4)',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span
            style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 10.5,
              letterSpacing: '0.02em',
            }}
          >
            Single sign-on · MorganWhiteGroup tenant
          </span>
        </div>

        {/* divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0 4px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 9.5,
              letterSpacing: '0.14em',
              color: 'var(--text-4)',
            }}
          >
            EMERGENCY ACCESS
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
        </div>

        {/* break-glass trigger */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={breakOpen}
          aria-controls={panelId}
          onClick={toggleBreak}
          onKeyDown={onBreakKey}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            minHeight: 44,
            padding: '11px 4px 6px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              flex: '0 0 auto',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--warning)',
              background: 'rgba(251,191,114,0.13)',
              border: '1px solid rgba(251,191,114,0.22)',
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2l8 4v5c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V6z" />
              <path d="M9.5 12.5l1.8 1.8 3.5-3.6" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)' }}>
              Use a break-glass account
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>
              Backup login if Entra ID is unavailable
            </div>
          </div>
          {breakOpen ? (
            <svg
              width="18"
              height="18"
              style={{ flex: '0 0 auto', color: '#9bbcf2' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              style={{ flex: '0 0 auto', color: 'var(--text-3)' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </div>

        {/* break-glass panel (expandable) */}
        {breakOpen && (
          <div
            id={panelId}
            className="animate-cb-up"
            style={{
              marginTop: 12,
              padding: 15,
              borderRadius: 14,
              background: 'rgba(251,191,114,0.06)',
              border: '1px solid rgba(251,191,114,0.20)',
            }}
          >
            <div style={{ display: 'flex', gap: 9, marginBottom: 15 }}>
              <svg
                width="15"
                height="15"
                style={{ flex: '0 0 auto', marginTop: 1 }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--warning)"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
              <span style={{ fontSize: 11.5, lineHeight: 1.5, color: '#d9c8a6' }}>
                Emergency use only. Break-glass sign-ins are audit-logged and alert the security
                team.
              </span>
            </div>

            <label
              htmlFor={userId}
              style={{
                display: 'block',
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 9.5,
                letterSpacing: '0.1em',
                color: 'var(--text-3)',
                marginBottom: 6,
              }}
            >
              USERNAME
            </label>
            <input
              id={userId}
              value={user}
              onChange={(e) => {
                setUser(e.target.value);
                setBreakErr('');
              }}
              placeholder="breakglass-admin"
              autoComplete="off"
              spellCheck={false}
              disabled={breakPending}
              style={{
                width: '100%',
                height: 42,
                padding: '0 13px',
                borderRadius: 11,
                background: 'rgba(8,11,18,0.5)',
                border: '1px solid var(--hairline)',
                outline: 'none',
                color: 'var(--text-strong)',
                fontSize: 13.5,
                fontFamily: "'Manrope',system-ui,sans-serif",
                marginBottom: 13,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(251,191,114,0.5)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--hairline)';
              }}
            />

            <label
              htmlFor={passId}
              style={{
                display: 'block',
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 9.5,
                letterSpacing: '0.1em',
                color: 'var(--text-3)',
                marginBottom: 6,
              }}
            >
              PASSWORD
            </label>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <input
                id={passId}
                value={pass}
                onChange={(e) => {
                  setPass(e.target.value);
                  setBreakErr('');
                }}
                onKeyDown={onPassKeyDown}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••••••"
                autoComplete="off"
                disabled={breakPending}
                style={{
                  width: '100%',
                  height: 42,
                  padding: '0 44px 0 13px',
                  borderRadius: 11,
                  background: 'rgba(8,11,18,0.5)',
                  border: '1px solid var(--hairline)',
                  outline: 'none',
                  color: 'var(--text-strong)',
                  fontSize: 13.5,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(251,191,114,0.5)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hairline)';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                aria-pressed={showPass}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 6,
                  width: 30,
                  height: 30,
                  border: 'none',
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-3)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-3)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {showPass ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 2l20 20M10.6 10.7a2 2 0 0 0 2.8 2.8" />
                    <path d="M16.7 16.7A9 9 0 0 1 12 18c-5 0-9-6-9-6a16 16 0 0 1 4-4.4M9.9 5.2A9 9 0 0 1 12 5c5 0 9 6 9 6a16 16 0 0 1-2.3 2.9" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
                    <circle cx="12" cy="12" r="2.6" />
                  </svg>
                )}
              </button>
            </div>

            {breakErr && (
              <div role="alert" style={{ fontSize: 11.5, color: '#fb87a4', margin: '8px 0 2px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {breakErr}
              </div>
            )}

            <button
              type="button"
              onClick={signBreak}
              disabled={breakPending}
              aria-busy={breakPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 44,
                marginTop: 12,
                border: 'none',
                borderRadius: 11,
                cursor: breakPending ? 'default' : 'pointer',
                fontSize: 13.5,
                fontWeight: 700,
                fontFamily: "'Manrope',system-ui,sans-serif",
                color: '#1a1408',
                background: 'linear-gradient(160deg,#fcc97e,#fbbf72)',
                boxShadow: '0 8px 20px -8px rgba(251,191,114,0.6)',
              }}
              onMouseEnter={(e) => {
                if (!breakPending) e.currentTarget.style.filter = 'brightness(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              {breakPending ? (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: '2.2px solid rgba(26,20,8,0.3)',
                    borderTopColor: '#1a1408',
                    animation: 'cbSpin .7s linear infinite',
                  }}
                />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1a1408"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h13M12 5l7 7-7 7" />
                </svg>
              )}
              Break-glass sign in
            </button>
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22, color: 'var(--text-4)' }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2l8 4v5c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V6z" />
        </svg>
        <span
          style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 10,
            letterSpacing: '0.02em',
          }}
        >
          Protected by Microsoft Entra ID · SOC 2 Type II
        </span>
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 9.5,
          color: 'var(--text-4)',
          marginTop: 10,
        }}
      >
        CheatBook v4.2 · © MorganWhiteGroup 2026
      </div>
    </div>
  );
};

export default LoginCard;
