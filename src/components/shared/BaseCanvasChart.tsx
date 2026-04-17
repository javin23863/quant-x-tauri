import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

function asNumber(value: any, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface SeriesEntry {
  id: string;
  label: string;
  data: { x: number; y: number }[];
  color?: string;
  lineWidth: number;
  opacity: number;
}

interface DataPoint {
  time?: number | string;
  timestamp?: number | string;
  value?: number;
  equity?: number;
  close?: number;
}

interface BaseCanvasChartProps {
  data?: DataPoint[];
  series?: { id?: string; label?: string; data?: DataPoint[]; color?: string; lineWidth?: number; opacity?: number }[];
  width?: string | number;
  height?: number;
  className?: string;
  label?: string;
  color?: string;
  lineWidth?: number;
  opacity?: number;
  downsample?: boolean | { maxPoints?: number };
  onHover?: (info: { seriesId: string; seriesLabel: string; point: { x: number; y: number } } | null) => void;
}

function toPoint(row: any, index: number): { x: number; y: number } {
  if (typeof row === 'number') return { x: index, y: row };
  if (!row || typeof row !== 'object') return { x: index, y: 0 };
  const xRaw = row.time !== undefined ? row.time : (row.timestamp !== undefined ? row.timestamp : index);
  const yRaw = row.value !== undefined ? row.value : (row.equity !== undefined ? row.equity : row.close);
  const x = typeof xRaw === 'string' ? asNumber(Date.parse(xRaw), index) : asNumber(xRaw, index);
  const y = asNumber(yRaw, 0);
  return { x, y };
}

function normalizeSeriesInput(props: BaseCanvasChartProps): SeriesEntry[] {
  if (Array.isArray(props.series) && props.series.length > 0) {
    return props.series.map((entry, index) => ({
      id: entry.id || `series-${index}`,
      label: entry.label || `Series ${index + 1}`,
      data: (Array.isArray(entry.data) ? entry.data : []).map(toPoint),
      color: entry.color,
      lineWidth: asNumber(entry.lineWidth, 1.5),
      opacity: asNumber(entry.opacity, 0.45),
    }));
  }
  const points = (Array.isArray(props.data) ? props.data : []).map(toPoint);
  return [{
    id: 'series-0',
    label: props.label || 'Series',
    data: points,
    color: props.color,
    lineWidth: asNumber(props.lineWidth, 2),
    opacity: asNumber(props.opacity, 0.85),
  }];
}

function getBounds(series: SeriesEntry[]) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  (series || []).forEach(entry => {
    (entry.data || []).forEach(point => {
      xMin = Math.min(xMin, point.x);
      xMax = Math.max(xMax, point.x);
      yMin = Math.min(yMin, point.y);
      yMax = Math.max(yMax, point.y);
    });
  });
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  }
  if (xMin === xMax) xMax += 1;
  if (yMin === yMax) yMax += 1;
  return { xMin, xMax, yMin, yMax };
}

export default function BaseCanvasChart(props: BaseCanvasChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ seriesId: string; seriesLabel: string; point: { x: number; y: number } } | null>(null);

  const width = props.width || '100%';
  const height = props.height || 320;

  const sourceSeries = useMemo(() => normalizeSeriesInput(props), [props.data, props.label, props.lineWidth, props.opacity, props.series]);

  const series = useMemo(() => {
    const maxPoints = typeof props.downsample === 'object'
      ? Math.max(100, asNumber(props.downsample.maxPoints, 4000))
      : 4000;
    if (!props.downsample) return sourceSeries;
    return sourceSeries.map(entry => {
      if (!entry.data || entry.data.length <= maxPoints) return entry;
      const step = Math.ceil(entry.data.length / maxPoints);
      const reduced = entry.data.filter((_, i) => i % step === 0);
      return { ...entry, data: reduced };
    });
  }, [props.downsample, sourceSeries]);

  const bounds = useMemo(() => getBounds(series), [series]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const rect = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawWidth = rect.width;
    const drawHeight = rect.height;
    const padding = { top: 12, right: 12, bottom: 18, left: 12 };
    const chartWidth = Math.max(1, drawWidth - padding.left - padding.right);
    const chartHeight = Math.max(1, drawHeight - padding.top - padding.bottom);

    const background = '#0a1424';
    const grid = 'rgba(255,255,255,0.06)';
    const accent = 'rgba(80,160,255,1)';

    ctx.clearRect(0, 0, drawWidth, drawHeight);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + ((chartHeight / 4) * i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }

    const xScale = (x: number) => padding.left + ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * chartWidth;
    const yScale = (y: number) => padding.top + (1 - ((y - bounds.yMin) / (bounds.yMax - bounds.yMin))) * chartHeight;

    (series || []).forEach((entry, index) => {
      const lineColor = entry.color || (index === 0 ? accent : 'rgba(210,220,235,0.5)');
      const alpha = index === 0 ? 0.95 : entry.opacity;

      ctx.beginPath();
      ctx.lineWidth = entry.lineWidth;
      ctx.strokeStyle = lineColor;
      ctx.globalAlpha = alpha;

      (entry.data || []).forEach((point, pointIndex) => {
        const px = xScale(point.x);
        const py = yScale(point.y);
        if (pointIndex === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
  }, [bounds, series]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!props.onHover || !hostRef.current) return;
    const rect = hostRef.current.getBoundingClientRect();
    const xPx = event.clientX - rect.left;
    const xRange = bounds.xMax - bounds.xMin;
    const xData = bounds.xMin + ((xPx / Math.max(rect.width, 1)) * xRange);

    let best: { score: number; seriesId: string; seriesLabel: string; point: { x: number; y: number } } | null = null;
    (series || []).forEach(entry => {
      const data = entry.data || [];
      if (!data.length) return;
      let left = 0, right = data.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (data[mid].x < xData) left = mid + 1;
        else if (data[mid].x > xData) right = mid - 1;
        else { best = { score: 0, seriesId: entry.id, seriesLabel: entry.label, point: data[mid] }; return; }
      }
      const a = data[Math.max(0, right)] || data[0];
      const b = data[Math.min(data.length - 1, left)] || data[data.length - 1];
      const candidate = Math.abs((a.x || 0) - xData) <= Math.abs((b.x || 0) - xData) ? a : b;
      const score = Math.abs(candidate.x - xData);
      if (!best || score < best.score) {
        best = { score, seriesId: entry.id, seriesLabel: entry.label, point: candidate };
      }
    });

    setHoverInfo(best);
    props.onHover(best);
  }, [bounds, props.onHover, series]);

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
    if (props.onHover) props.onHover(null);
  }, [props.onHover]);

  return (
    <div className={`factory-canvas-chart ${props.className || ''}`} style={{ width, height: `${height}px`, position: 'relative' }} ref={hostRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <canvas ref={canvasRef} />
      {hoverInfo && (
        <div className="factory-canvas-tooltip">
          <div className="factory-canvas-tooltip-label">{hoverInfo.seriesLabel}</div>
          <div className="factory-canvas-tooltip-value">Value: {hoverInfo.point.y.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}