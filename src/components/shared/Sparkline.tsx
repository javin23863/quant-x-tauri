import { useEffect, useRef, useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  showDot?: boolean;
  animate?: boolean;
  className?: string;
}

export default function Sparkline({
  data,
  width = 60,
  height = 20,
  color = '#10B981',
  fillOpacity = 0.1,
  showDot = false,
  animate = true,
  className = '',
}: SparklineProps) {
  const pathRef = useRef<SVGPathElement | null>(null);

  const normalized = useMemo(() => {
    if (!data || data.length === 0) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data.map((val) => (val - min) / range);
  }, [data]);

  const path = useMemo(() => {
    if (normalized.length === 0) return '';
    const xStep = width / (normalized.length - 1 || 1);
    const points = normalized.map((val, i) => {
      const x = i * xStep;
      const y = height - (val * height * 0.8) - (height * 0.1);
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }, [normalized, width, height]);

  const fillPath = useMemo(() => {
    if (path === '' || normalized.length === 0) return '';
    const xStep = width / (normalized.length - 1 || 1);
    const lastX = (normalized.length - 1) * xStep;
    return `${path} L ${lastX},${height} L 0,${height} Z`;
  }, [path, normalized, width, height]);

  const lastPoint = useMemo(() => {
    if (normalized.length === 0 || !showDot) return null;
    const xStep = width / (normalized.length - 1 || 1);
    const lastX = (normalized.length - 1) * xStep;
    const lastY = height - (normalized[normalized.length - 1] * height * 0.8) - (height * 0.1);
    return { x: lastX, y: lastY };
  }, [normalized, width, height, showDot]);

  useEffect(() => {
    if (animate && pathRef.current) {
      const length = typeof pathRef.current.getTotalLength === 'function' ? pathRef.current.getTotalLength() : 100;
      pathRef.current.style.strokeDasharray = String(length);
      pathRef.current.style.strokeDashoffset = String(length);
      pathRef.current.getBoundingClientRect();
      pathRef.current.style.transition = 'stroke-dashoffset 0.5s ease-out';
      pathRef.current.style.strokeDashoffset = '0';
    }
  }, [data, animate]);

  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} className={`sparkline sparkline-empty ${className}`}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2,2" />
      </svg>
    );
  }

  const gradientId = `sparkline-gradient-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className={`sparkline ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={fillPath} fill={`url(#${gradientId})`} />

      <path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r="2" fill={color} className="sparkline-dot" />
      )}
    </svg>
  );
}

export function sparklineFromTrend(trendStr: string, options: Partial<SparklineProps> = {}) {
  const movements = trendStr.split('').map((c) => {
    if (c === '+') return 1;
    if (c === '-') return -1;
    return 0;
  });

  const values = [0];
  movements.forEach((m) => {
    values.push(values[values.length - 1] + m);
  });

  return <Sparkline data={values} {...options} />;
}

export function sparklinePnL(data: number[], options: Partial<SparklineProps> = {}) {
  const lastValue = data[data.length - 1] ?? 0;
  const firstValue = data[0] ?? 0;
  const change = lastValue - firstValue;
  const color = change >= 0 ? '#10B981' : '#EF4444';

  return <Sparkline data={data} color={color} {...options} />;
}

interface SparklineCellProps {
  value?: number;
  data?: number[];
  trend?: string;
  width?: number;
  height?: number;
}

export function SparklineCell({ value, data, trend, width = 60, height = 16 }: SparklineCellProps) {
  let sparkline: React.ReactNode = null;

  if (data) {
    sparkline = <Sparkline data={data} width={width} height={height} />;
  } else if (trend) {
    const movements = trend.split('').map((c) => {
      if (c === '+') return 1;
      if (c === '-') return -1;
      return 0;
    });
    const values = [0];
    movements.forEach((m) => { values.push(values[values.length - 1] + m); });
    sparkline = <Sparkline data={values} width={width} height={height} />;
  }

  return (
    <div className="sparkline-cell">
      {sparkline}
      {value !== undefined && (
        <span className="sparkline-cell-value">{value}</span>
      )}
    </div>
  );
}