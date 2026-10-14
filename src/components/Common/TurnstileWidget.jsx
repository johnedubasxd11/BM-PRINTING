import { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// Cloudflare's documented always-pass test site key (pairs with the always-pass
// test secret used server-side when TURNSTILE_USE_TEST_KEYS=true). Dev only.
const TURNSTILE_DEVELOPMENT_SITE_KEY = '1x0000000000000000000000000000000AA';
const usingTestKeys = import.meta.env.DEV && import.meta.env.VITE_TURNSTILE_USE_TEST_KEYS === 'true';
const TURNSTILE_SITE_KEY = usingTestKeys
  ? TURNSTILE_DEVELOPMENT_SITE_KEY
  : import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

const STATUS_TEXT = {
  loading: 'Loading security verification...',
  expired: 'Security verification expired. Please verify again.',
  unavailable: 'Security verification could not load. You can retry below.',
  'hostname-not-authorized': 'Security verification is not authorized for this website address.'
};

let turnstileScriptPromise;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load.'));
    script.onerror = () => {
      turnstileScriptPromise = undefined;
      script.remove();
      reject(new Error('Turnstile could not be loaded.'));
    };
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

export const TurnstileWidget = ({ resetSignal, onTokenChange, onStatusChange }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onTokenChange, onStatusChange });
  callbacksRef.current = { onTokenChange, onStatusChange };
  const [status, setStatus] = useState('loading');
  const [retrySignal, setRetrySignal] = useState(0);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);

  const reportStatus = value => {
    setStatus(value);
    callbacksRef.current.onStatusChange(value);
  };

  useEffect(() => {
    let active = true;
    if (!TURNSTILE_SITE_KEY) {
      reportStatus('unavailable');
      return () => { active = false; };
    }

    reportStatus('loading');
    loadTurnstileScript().then(turnstile => {
      if (!active || !containerRef.current) return;
      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: 'flexible',
        callback: token => {
          callbacksRef.current.onTokenChange(token);
          reportStatus('ready');
        },
        'expired-callback': () => {
          callbacksRef.current.onTokenChange('');
          reportStatus('expired');
        },
        'error-callback': errorCode => {
          callbacksRef.current.onTokenChange('');
          reportStatus(String(errorCode).startsWith('110200') ? 'hostname-not-authorized' : 'unavailable');
        },
        'timeout-callback': () => {
          callbacksRef.current.onTokenChange('');
          reportStatus('expired');
        }
      });
      reportStatus('ready');
    }).catch(() => {
      if (active) reportStatus('unavailable');
    });

    return () => {
      active = false;
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onStatusChange, retrySignal]);

  useEffect(() => {
    if (resetSignal === 0) return;
    callbacksRef.current.onTokenChange('');
    if (widgetIdRef.current !== null) {
      window.turnstile?.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  const retry = () => {
    setShowTroubleshoot(false);
    setDiagnostics(null);
    // Drop the failed cached loader so the script is requested again.
    if (!window.turnstile) turnstileScriptPromise = undefined;
    setRetrySignal(signal => signal + 1);
  };

  const runTroubleshoot = async () => {
    const next = !showTroubleshoot;
    setShowTroubleshoot(next);
    if (!next || diagnostics) return;
    const lines = [];
    lines.push(usingTestKeys
      ? 'Site key: development test keys active (dev server only; never applies to production builds).'
      : TURNSTILE_SITE_KEY
        ? 'Site key: production key configured for this build.'
        : 'Site key: MISSING — set VITE_TURNSTILE_SITE_KEY when building for production.');
    lines.push(window.turnstile
      ? 'Cloudflare widget script: loaded.'
      : 'Cloudflare widget script: NOT loaded — check your network, or disable ad blockers/extensions for this page.');
    try {
      const response = await fetch('/api/health');
      lines.push(response.ok
        ? 'Backend API: reachable.'
        : `Backend API: responded with HTTP ${response.status} — fix the backend before retrying.`);
    } catch {
      lines.push('Backend API: unreachable — start the backend (npm run dev), or check VITE_API_BASE_URL. Static hosts such as GitHub Pages cannot verify tokens without a deployed backend.');
    }
    setDiagnostics(lines);
  };

  return (
    <div className="bm-turnstile-wrap" role="group" aria-label="Security verification">
      <div ref={containerRef} className="bm-turnstile-widget" />
      {(status === 'unavailable' || status === 'expired' || status === 'hostname-not-authorized') && (
        <div className="bm-turnstile-status">
          <p role="status">{STATUS_TEXT[status] || STATUS_TEXT.unavailable}</p>
          <p>
            <button type="button" className="bm-auth-link" onClick={retry}>Retry verification</button>
            <span aria-hidden="true"> · </span>
            <button type="button" className="bm-auth-link" onClick={() => void runTroubleshoot()}>Troubleshoot</button>
          </p>
          {showTroubleshoot && (
            <ul className="bm-turnstile-troubleshoot">
              {(diagnostics || ['Running checks...']).map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
