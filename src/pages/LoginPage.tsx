import React, { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import CyberGridBackground from '../components/CyberGridBackground';
import AppleGlassCard from '../components/AppleGlassCard';
import { fetchApi } from '../services/api';
import { setAuthSession } from '../services/authStorage';
import { defaultRouteFor } from '../config/roles';
import type { StoredUser } from '../config/roles';

// Memoized so typing in form inputs never re-triggers or re-renders the HUD text
const ScrambleText = memo(function ScrambleText({ targetText }: { targetText: string }) {
  const [displayText, setDisplayText] = useState(targetText);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayText(targetText);
      return;
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789°N|E#@*';
    let iteration = 0;

    const interval = setInterval(() => {
      setDisplayText(
        targetText
          .split('')
          .map((char, index) => {
            if (
              char === ' ' ||
              char === '.' ||
              char === ',' ||
              char === '(' ||
              char === ')' ||
              char === ':' ||
              char === '|' ||
              char === '/'
            ) {
              return char;
            }
            if (index < iteration) {
              return targetText[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );

      if (iteration >= targetText.length) {
        clearInterval(interval);
      }
      iteration += 0.6;
    }, 35);

    return () => clearInterval(interval);
  }, [targetText]);

  return <span>{displayText}</span>;
});

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await fetchApi<{ token: string }>('/api/identity/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }, null);

      // Resolve the identity before persisting anything, so a failed /me call
      // never leaves a half-written session behind.
      const { user } = await fetchApi<{ user: StoredUser }>(
        '/api/identity/me',
        {},
        data.token
      );

      // Session is scoped to this tab only (sessionStorage), and any cached
      // data from a previous account in this tab is discarded.
      setAuthSession(data.token, user);
      queryClient.clear();
      navigate(defaultRouteFor(user.role));
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Scoped interactive & responsive styles for crisp focus rings and hover states */}
      <style>{`
        .prism-input {
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background-color: rgba(2, 6, 23, 0.65);
          color: #f8fafc;
          font-size: 14px;
          line-height: 20px;
          outline: none;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
          box-sizing: border-box;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
        }
        .prism-input::placeholder {
          color: #475569;
        }
        .prism-input:hover:not(:disabled) {
          border-color: rgba(148, 163, 184, 0.3);
        }
        .prism-input:focus {
          border-color: rgba(56, 189, 248, 0.65);
          background-color: rgba(2, 6, 23, 0.85);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 3px rgba(56, 189, 248, 0.14);
        }
        .prism-input-password {
          padding-right: 42px;
        }
        .prism-submit-btn {
          margin-top: 6px;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid rgba(56, 189, 248, 0.25);
          background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.2px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.22);
          transition: transform 0.12s ease, box-shadow 0.18s ease, filter 0.18s ease, opacity 0.18s ease;
        }
        .prism-submit-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }
        .prism-submit-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        .prism-submit-btn:focus-visible {
          outline: 2px solid #38bdf8;
          outline-offset: 2px;
        }
        .prism-submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .prism-eye-btn {
          position: absolute;
          right: 8px;
          width: 30px;
          height: 30px;
          border-radius: 7px;
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: color 0.15s ease, background-color 0.15s ease;
        }
        .prism-eye-btn:hover {
          color: #cbd5e1;
          background-color: rgba(148, 163, 184, 0.1);
        }
        .prism-eye-btn:focus-visible {
          outline: 2px solid rgba(56, 189, 248, 0.6);
          color: #e2e8f0;
        }
        .prism-forgot-link {
          font-size: 12px;
          font-weight: 500;
          color: #38bdf8;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .prism-forgot-link:hover {
          color: #7dd3fc;
          text-decoration: underline;
        }
        .prism-forgot-link:focus-visible {
          outline: 2px solid rgba(56, 189, 248, 0.6);
          border-radius: 4px;
        }
        @media (max-width: 640px) {
          .prism-hud-label {
            font-size: 10px !important;
            left: 16px !important;
            right: 16px !important;
          }
          .prism-hud-top {
            top: 14px !important;
          }
          .prism-hud-bottom {
            bottom: 14px !important;
            text-align: center !important;
          }
        }
      `}</style>

      {/* Full-Screen Animated Geospatial Network */}
      <CyberGridBackground />

      {/* Technical Telemetry HUD Overlays */}
      <div className="prism-hud-label prism-hud-top" style={styles.hudTopLeft}>
        <span style={styles.statusDot} aria-hidden="true" />
        <ScrambleText targetText="SYSTEM: ONLINE // PRISM V1.0" />
      </div>
      <div className="prism-hud-label prism-hud-bottom" style={styles.hudBottomRight}>
        <ScrambleText targetText="LAT: 42.9264° N | LNG: 101.253° E (Mapskart Technologies)" />
      </div>

      {/* Centered Enterprise Glass Card */}
      <main style={styles.cardWrapper}>
        <AppleGlassCard maxWidth="416px">
          {/* Brand Header */}
          <header style={styles.headerContainer}>
            <h1 style={styles.title}>PRISM</h1>
            <p style={styles.subtitle}>Playground Risk Information System &amp; Monitoring</p>
          </header>

          <div style={styles.sectionHeader}>
            <h2 style={styles.formHeading}>Sign In</h2>
            <span style={styles.formSubheading}>Enter your credentials to access the platform</span>
          </div>

          {error && (
            <div role="alert" style={styles.errorBanner}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="prism-email" style={styles.label}>
                Email Address
              </label>
              <input
                id="prism-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="prism-input"
                placeholder="username@gmail.com"
              />
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.passwordRow}>
                <label htmlFor="prism-password" style={styles.label}>
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => e.preventDefault()}
                  className="prism-forgot-link"
                >
                  Forgot Password?
                </a>
              </div>

              <div style={styles.passwordInputContainer}>
                <input
                  id="prism-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="prism-input prism-input-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="prism-eye-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="prism-submit-btn">
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div style={styles.dividerContainer}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>secure enterprise gateway</span>
            <span style={styles.dividerLine} />
          </div>

          <p style={styles.footerText}>
            Protected by role-based access control &amp; audit logging.
          </p>
        </AppleGlassCard>
      </main>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed' as const,
    inset: 0,
    width: '100vw',
    height: '100dvh',
    backgroundColor: '#020617',
    overflow: 'hidden',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box' as const,
    margin: 0,
    padding: 0,
  },
  cardWrapper: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    padding: '48px 20px',
    boxSizing: 'border-box' as const,
    overflowY: 'auto' as const,
  },
  hudTopLeft: {
    position: 'absolute' as const,
    top: '22px',
    left: '28px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'rgba(148, 163, 184, 0.72)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontVariantNumeric: 'tabular-nums' as const,
    fontSize: '11px',
    letterSpacing: '1.2px',
    fontWeight: '600',
    zIndex: 4,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#38bdf8',
    boxShadow: '0 0 8px rgba(56, 189, 248, 0.65)',
    flexShrink: 0,
  },
  hudBottomRight: {
    position: 'absolute' as const,
    bottom: '22px',
    right: '28px',
    color: 'rgba(148, 163, 184, 0.68)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontVariantNumeric: 'tabular-nums' as const,
    fontSize: '11px',
    letterSpacing: '0.8px',
    fontWeight: '500',
    zIndex: 4,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
  },
  headerContainer: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  title: {
    margin: '0',
    fontSize: '28px',
    lineHeight: '32px',
    fontWeight: '800',
    letterSpacing: '2px',
    color: '#f8fafc',
  },
  subtitle: {
    margin: '6px 0 0 0',
    fontSize: '12.5px',
    lineHeight: '18px',
    color: '#94a3b8',
    fontWeight: '400',
    letterSpacing: '0.15px',
  },
  sectionHeader: {
    marginBottom: '18px',
  },
  formHeading: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    lineHeight: '22px',
    fontWeight: '600',
    color: '#f1f5f9',
    letterSpacing: '-0.1px',
  },
  formSubheading: {
    display: 'block',
    fontSize: '12.5px',
    lineHeight: '18px',
    color: '#64748b',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '12.5px',
    lineHeight: '18px',
    fontWeight: '500',
    color: '#cbd5e1',
  },
  passwordRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordInputContainer: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  dividerContainer: {
    display: 'flex',
    alignItems: 'center',
    margin: '24px 0 12px 0',
    color: '#64748b',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  dividerText: {
    padding: '0 12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#64748b',
  },
  footerText: {
    textAlign: 'center' as const,
    fontSize: '11.5px',
    color: '#64748b',
    margin: 0,
    lineHeight: '16px',
  },
  errorBanner: {
    backgroundColor: 'rgba(127, 29, 29, 0.45)',
    border: '1px solid rgba(248, 113, 113, 0.35)',
    color: '#fecaca',
    padding: '10px 12px',
    borderRadius: '10px',
    fontSize: '12.5px',
    lineHeight: '18px',
    marginBottom: '16px',
    textAlign: 'center' as const,
  },
};