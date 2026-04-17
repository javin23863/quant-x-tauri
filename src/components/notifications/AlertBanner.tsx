import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// AlertBanner — sticky top notification bar

interface AlertBannerProps {
  alert: { severity: 'error' | 'warning'; message: string; since?: string } | null;
  onClose?: () => void;
}

export default function AlertBanner({  alert, onClose  }: AlertBannerProps) {
  if (!alert) return null;
  const cls = 'alert-banner ' + (alert.severity === 'error' ? 'error' : 'warning');
  const icon = alert.severity === 'error' ? '🔴' : '⚠️';
  return (
    <div className={cls}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontWeight: 500 }}>{alert.message}</span>
      {alert.since && <span className="alert-since">since {alert.since}</span>}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'currentColor',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 4px',
            opacity: 0.7,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
