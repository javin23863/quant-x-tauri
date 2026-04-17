import React, { useState, useEffect, useMemo } from 'react';

interface FreshnessState {
  phase: string;
  color: string;
  opacity: number;
  pulse?: boolean;
  crossed?: boolean;
}

interface FreshnessIndicatorProps {
  timestamp?: string | Date | null;
  maxAge?: number;
  className?: string;
}

export default function FreshnessIndicator({ timestamp, maxAge = 300, className = '' }: FreshnessIndicatorProps) {
  const [age, setAge] = useState(0);

  const parsedTimestamp = useMemo(() => {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
  }, [timestamp]);

  useEffect(() => {
    if (!parsedTimestamp) return;

    const updateAge = () => {
      const now = Date.now();
      const ts = parsedTimestamp.getTime();
      setAge(Math.floor((now - ts) / 1000));
    };

    updateAge();
    const interval = setInterval(updateAge, 1000);
    return () => clearInterval(interval);
  }, [parsedTimestamp]);

  const freshnessState: FreshnessState = useMemo(() => {
    if (!parsedTimestamp) {
      return { phase: 'unknown', color: '#6B7280', opacity: 0.5 };
    }

    if (age <= 30) {
      return { phase: 'fresh', color: '#10B981', opacity: 1, pulse: true };
    } else if (age <= 120) {
      return { phase: 'stale', color: '#FBBF24', opacity: 0.8 };
    } else if (age <= 300) {
      return { phase: 'old', color: '#F97316', opacity: 0.6 };
    } else {
      return { phase: 'dead', color: '#EF4444', opacity: 0.4, crossed: true };
    }
  }, [age, maxAge, parsedTimestamp]);

  const timeStr = useMemo(() => {
    if (!parsedTimestamp) return '—';
    if (age < 5) return 'now';
    if (age < 60) return age + 's';
    if (age < 3600) return Math.floor(age / 60) + 'm';
    return Math.floor(age / 3600) + 'h';
  }, [age, parsedTimestamp]);

  if (!parsedTimestamp) {
    return (
      <span className={`freshness-indicator freshness-unknown ${className}`} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        —
      </span>
    );
  }

  return (
    <span
      className={`freshness-indicator freshness-${freshnessState.phase} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '14px',
        fontSize: '11px',
        opacity: freshnessState.opacity,
        transition: 'opacity 0.3s ease',
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        {freshnessState.pulse && (
          <span
            className="freshness-pulse"
            style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              border: `1px solid ${freshnessState.color}`,
              animation: 'freshnessPulse 2s ease-out infinite',
            }}
          />
        )}

        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: freshnessState.color,
            transition: 'background-color 0.3s ease',
          }}
        />

        {freshnessState.crossed && (
          <span
            style={{
              position: 'absolute',
              fontSize: '10px',
              fontWeight: 'bold',
              color: freshnessState.color,
              left: '-1px',
              top: '-1px',
            }}
          >
            ×
          </span>
        )}
      </span>

      <span>
        {timeStr}
        {age > 60 && ' ago'}
      </span>

      <style>{`
        @keyframes freshnessPulse {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        .freshness-indicator {
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </span>
  );
}

export function FreshnessIndicatorFromISO(isoString: string, options?: Omit<FreshnessIndicatorProps, 'timestamp'>) {
  return <FreshnessIndicator timestamp={isoString} {...options} />;
}

export function createFreshnessIndicatorWithMaxAge(maxAgeSeconds: number) {
  return function BoundedFreshnessIndicator(props: FreshnessIndicatorProps) {
    return <FreshnessIndicator {...props} maxAge={maxAgeSeconds} />;
  };
}