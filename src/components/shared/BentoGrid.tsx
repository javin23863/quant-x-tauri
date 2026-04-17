import React, { useState, useEffect, useRef } from 'react';

interface BentoGridProps {
  children?: React.ReactNode;
  columns?: number;
  gap?: number;
  className?: string;
}

interface BentoCardProps {
  children?: React.ReactNode;
  title?: string;
  icon?: string;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  glow?: boolean;
  glowColor?: string;
  loading?: boolean;
  alert?: boolean;
  alertColor?: string;
  onClick?: () => void;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
}

interface BentoMetricProps {
  value?: number | string;
  label?: string;
  subvalue?: string;
  trend?: 'up' | 'down' | 'flat';
  trendData?: number[];
  color?: string;
  format?: 'number' | 'currency' | 'percent' | 'integer';
  size?: 'small' | 'default' | 'large' | 'hero';
}

interface RiskGaugeProps {
  level?: number;
  max?: number;
  label?: string;
  thresholds?: Array<{ value: number; color: string; label: string }>;
}

interface RegimeVisualProps {
  regime?: {
    state?: string;
    hmmState?: string;
    probability?: number;
    confidence?: number;
    volatility?: string;
    volCluster?: string;
    trend?: string;
    trendStrength?: string;
  };
}

interface AgentStatusCardProps {
  name?: string;
  role?: string;
  status?: string;
  lastAction?: string;
  icon?: string;
}

interface SignalFeedItemProps {
  signal?: {
    symbol?: string;
    asset?: string;
    direction?: string;
    side?: string;
    strategy?: string;
    source?: string;
    ts?: string;
    confidence?: number;
  };
  onClick?: () => void;
}

export function BentoGrid({ children, columns = 4, gap = 12, className = '' }: BentoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const checkCompact = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setIsCompact(width < 600);
      }
    };

    checkCompact();
    window.addEventListener('resize', checkCompact);
    return () => window.removeEventListener('resize', checkCompact);
  }, []);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isCompact ? '1fr' : `repeat(${columns}, 1fr)`,
    gridAutoRows: 'minmax(120px, auto)',
    gap: `${gap}px`,
    width: '100%',
  };

  const childArray = React.Children.toArray(children);
  const spacedChildren = childArray.map((child, index) => {
    if (!React.isValidElement(child)) return child;
    const childProps = child.props as Record<string, unknown>;
    const colSpan = (childProps.colSpan as number) ?? 1;
    const rowSpan = (childProps.rowSpan as number) ?? 1;
    return React.cloneElement(child, {
      key: child.key ?? index,
      colSpan: isCompact ? 1 : colSpan,
      rowSpan: isCompact ? 1 : rowSpan,
    });
  });

  return (
    <div ref={containerRef} className={`bento-grid ${className}`} style={gridStyle}>
      {spacedChildren}
    </div>
  );
}

export function BentoCard({
  children, title, icon, colSpan = 1, rowSpan = 1,
  className = '', glow = false, glowColor = 'var(--accent-blue)',
  loading = false, alert = false, alertColor = 'var(--accent-yellow)',
  onClick, footer, headerAction,
}: BentoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
    background: 'linear-gradient(135deg, rgba(22, 28, 42, 0.8) 0%, rgba(18, 24, 38, 0.9) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${alert ? (alertColor + '30') : 'var(--border-subtle)'}`,
    borderRadius: 'var(--radius-lg)',
    boxShadow: alert
      ? `0 0 20px ${alertColor}15, inset 0 1px 0 rgba(255,255,255,0.05)`
      : 'inset 0 1px 0 rgba(255,255,255,0.05)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
    cursor: onClick ? 'pointer' : 'default',
    position: 'relative',
  };

  if (loading) {
    return (
      <div className={`bento-card bento-card-loading ${className}`} style={cardStyle}>
        <div className="bento-card-header" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          {icon && (
            <div className="skeleton-icon" style={{
              width: '18px', height: '18px', borderRadius: '4px',
              background: 'linear-gradient(90deg, var(--bg-panel-alt) 25%, var(--bg-hover) 50%, var(--bg-panel-alt) 75%)',
              backgroundSize: '200% 100%',
            }} />
          )}
          <div className="skeleton-title" style={{
            flex: 1, height: '14px', marginLeft: icon ? '10px' : '0', borderRadius: '4px',
            background: 'linear-gradient(90deg, var(--bg-panel-alt) 25%, var(--bg-hover) 50%, var(--bg-panel-alt) 75%)',
            backgroundSize: '200% 100%',
          }} />
        </div>
        <div className="bento-card-body" style={{ flex: 1, padding: '16px' }}>
          <div className="skeleton-content" style={{
            height: '60%',
            background: 'linear-gradient(90deg, var(--bg-panel-alt) 25%, var(--bg-hover) 50%, var(--bg-panel-alt) 75%)',
            backgroundSize: '200% 100%', borderRadius: 'var(--radius-sm)',
          }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bento-card ${className}`}
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {glow && (
        <div className="bento-card-glow" style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: `linear-gradient(90deg, transparent, ${glowColor}60, transparent)`,
          opacity: isHovered ? 1 : 0.5, transition: 'opacity 0.2s ease',
        }} />
      )}
      {alert && (
        <div className="bento-card-alert-glow" style={{
          position: 'absolute', top: '-1px', left: '-1px', right: '-1px', bottom: '-1px',
          borderRadius: 'var(--radius-lg)', border: `1px solid ${alertColor}40`,
          boxShadow: `0 0 16px ${alertColor}25`, pointerEvents: 'none',
          animation: 'alert-pulse 2s ease-in-out infinite',
        }} />
      )}
      {(title || icon) && (
        <div className="bento-card-header" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {icon && <span className="bento-card-icon" style={{ fontSize: '16px', opacity: 0.8 }}>{icon}</span>}
            {title && (
              <span className="bento-card-title" style={{
                fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)',
              }}>{title}</span>
            )}
          </div>
          {headerAction}
        </div>
      )}
      <div className="bento-card-body" style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
        {children}
      </div>
      {footer && (
        <div className="bento-card-footer" style={{
          padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(0,0,0,0.2)',
        }}>{footer}</div>
      )}
    </div>
  );
}

export function BentoMetric({
  value, label, subvalue, trend, trendData = [],
  color = 'var(--accent-blue)', format = 'number', size = 'default',
}: BentoMetricProps) {
  const formatValue = (val: number | string | undefined) => {
    if (val === null || val === undefined) return '—';
    const numVal = Number(val);
    if (format === 'currency') return '$' + numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (format === 'percent') return numVal.toFixed(2) + '%';
    if (format === 'integer') return numVal.toLocaleString('en-US');
    return String(val);
  };

  const sizes = {
    small: { value: '20px', label: '10px', gap: '4px' },
    default: { value: '28px', label: '11px', gap: '6px' },
    large: { value: '36px', label: '12px', gap: '8px' },
    hero: { value: '48px', label: '13px', gap: '10px' },
  };

  const s = sizes[size];
  const trendColor = trend === 'up' ? 'var(--accent-green)' : trend === 'down' ? 'var(--accent-red)' : 'var(--text-muted)';

  return (
    <div className="bento-metric" style={{ display: 'flex', flexDirection: 'column', gap: s.gap }}>
      {label && (
        <div className="bento-metric-label" style={{
          fontSize: s.label, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>{label}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <div className="bento-metric-value" style={{
          fontSize: s.value, fontWeight: 700, color, fontFamily: 'var(--font-mono)',
        }}>{formatValue(value)}</div>
        {trend && (
          <span className="bento-metric-trend" style={{
            fontSize: '11px', fontWeight: 600, color: trendColor,
            display: 'flex', alignItems: 'center', gap: '3px',
          }}>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'}</span>
        )}
      </div>
      {subvalue && (
        <div className="bento-metric-subvalue" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{subvalue}</div>
      )}
      {trendData && trendData.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <Sparkline data={trendData} width={120} height={24} color={color} />
        </div>
      )}
    </div>
  );
}

export function RiskGauge({ level = 0, max = 100, label = 'Risk Level', thresholds = [
  { value: 30, color: 'var(--accent-green)', label: 'Low' },
  { value: 70, color: 'var(--accent-yellow)', label: 'Medium' },
  { value: 100, color: 'var(--accent-red)', label: 'High' },
]}: RiskGaugeProps) {
  const percentage = Math.min(100, Math.max(0, (level / max) * 100));
  const activeThreshold = thresholds.find((t) => level <= t.value) ?? thresholds[thresholds.length - 1];
  const color = activeThreshold?.color ?? 'var(--accent-green)';

  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const arcLength = circumference * 0.75;
  const offset = arcLength - (percentage / 100) * arcLength;

  return (
    <div className="risk-gauge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-135deg)' }}>
        <defs>
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle stroke="var(--bg-panel-alt)" fill="transparent" strokeWidth={strokeWidth}
          r={normalizedRadius} cx={radius} cy={radius}
          strokeDasharray={`${arcLength} ${circumference}`} />
        <circle stroke="url(#gauge-gradient)" fill="transparent" strokeWidth={strokeWidth}
          strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius}
          strokeDasharray={`${arcLength} ${circumference}`} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div style={{ position: 'relative', marginTop: `${-(radius + 10)}px`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{level}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {activeThreshold ? activeThreshold.label : label}
        </div>
      </div>
    </div>
  );
}

export function RegimeVisual({ regime = {} }: RegimeVisualProps) {
  const state = regime.state ?? regime.hmmState ?? 'UNKNOWN';
  const probability = regime.probability ?? regime.confidence ?? 0;
  const volatility = regime.volatility ?? regime.volCluster ?? 'normal';
  const trend = regime.trend ?? regime.trendStrength ?? 'neutral';

  const stateColors: Record<string, string> = {
    'BULL': 'var(--accent-green)',
    'BULLISH': 'var(--accent-green)',
    'BEAR': 'var(--accent-red)',
    'BEARISH': 'var(--accent-red)',
    'NEUTRAL': 'var(--accent-yellow)',
    'SIDEWAYS': 'var(--accent-yellow)',
    'RANGING': 'var(--accent-yellow)',
    'TRENDING': 'var(--accent-blue)',
    'VOLATILE': 'var(--accent-red)',
    'UNKNOWN': 'var(--text-muted)',
  };

  const color = stateColors[state.toUpperCase()] ?? stateColors['UNKNOWN'];

  return (
    <div className="regime-visual" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="regime-indicator" style={{
          width: '12px', height: '12px', borderRadius: '50%',
          background: color, boxShadow: `0 0 12px ${color}60`,
          animation: 'regime-pulse 2s ease-in-out infinite',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{state}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{volatility} volatility • {trend} trend</div>
        </div>
      </div>
      {probability > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '4px', background: 'var(--bg-panel-alt)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${probability * 100}%`, height: '100%', background: color,
              borderRadius: '2px', transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {(probability * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

export function AgentStatusCard({ name, role, status, lastAction, icon }: AgentStatusCardProps) {
  const statusColors: Record<string, string> = {
    'active': 'var(--accent-green)',
    'idle': 'var(--accent-yellow)',
    'error': 'var(--accent-red)',
    'offline': 'var(--text-muted)',
  };

  const statusKey = status ? status.toLowerCase() : 'offline';
  const color = statusColors[statusKey] ?? statusColors['offline'];

  return (
    <div className="agent-status-card" style={{
      padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)',
      display: 'flex', alignItems: 'center', gap: '10px',
      transition: 'background 0.2s ease', cursor: 'default', marginBottom: '8px',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
        background: `${color}15`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '16px', flexShrink: 0,
      }}>{icon ?? '🤖'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '2px' }}>{name}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lastAction ?? 'Idle'}
        </div>
      </div>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: color, boxShadow: `0 0 8px ${color}60`, flexShrink: 0,
      }} />
    </div>
  );
}

export function SignalFeedItem({ signal, onClick }: SignalFeedItemProps) {
  const age = signal?.ts ? Date.now() - new Date(signal.ts).getTime() : Infinity;
  const fresh = age < 60000;
  const stale = age > 300000;

  const direction = (signal?.direction ?? signal?.side ?? 'NEUTRAL').toUpperCase();
  const dirColor = direction === 'LONG' || direction === 'BUY' ? 'var(--accent-green)' : direction === 'SHORT' || direction === 'SELL' ? 'var(--accent-red)' : 'var(--text-secondary)';

  return (
    <div
      className="signal-feed-item"
      onClick={onClick}
      style={{
        padding: '10px 12px',
        background: fresh ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
        border: fresh ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.2s ease, border 0.2s ease',
        display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px',
      }}
    >
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: fresh ? 'var(--accent-blue)' : stale ? 'var(--text-muted)' : 'var(--accent-yellow)',
        boxShadow: fresh ? '0 0 8px var(--glow-blue)' : 'none', flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
            {signal?.symbol ?? signal?.asset ?? '???'}
          </span>
          <span style={{
            padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
            fontFamily: 'var(--font-mono)', background: `${dirColor}18`, color: dirColor,
          }}>{direction}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
          <span>{signal?.strategy ?? signal?.source ?? 'Unknown'}</span>
          <span>{fresh ? 'just now' : (stale ? 'stale' : `${Math.floor(age / 60000)}m ago`)}</span>
        </div>
      </div>
      {signal?.confidence != null && (
        <span style={{
          fontSize: '10px', fontFamily: 'var(--font-mono)',
          color: signal.confidence > 0.7 ? 'var(--accent-green)' : 'var(--text-muted)',
        }}>{(signal.confidence * 100).toFixed(0)}%</span>
      )}
    </div>
  );
}

// Sparkline used within BentoMetric
interface SparklineSvgProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

function Sparkline({ data, width = 60, height = 20, color = '#10B981' }: SparklineSvgProps) {
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} className="sparkline sparkline-empty">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2,2" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const normalized = data.map((v) => (v - min) / range);
  const xStep = width / (normalized.length - 1 || 1);

  const points = normalized.map((v, i) => {
    const x = i * xStep;
    const y = height - (v * height * 0.8) - (height * 0.1);
    return `${x},${y}`;
  });

  const path = `M ${points.join(' L ')}`;
  const lastX = (normalized.length - 1) * xStep;
  const fillPath = `${path} L ${lastX},${height} L 0,${height} Z`;
  const gradientId = `sparkline-gradient-${color.replace('#', '')}`;
  const lastY = height - (normalized[normalized.length - 1] * height * 0.8) - (height * 0.1);

  return (
    <svg width={width} height={height} className="sparkline" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.1} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill={color} className="sparkline-dot" />
    </svg>
  );
}