import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

function asNumber(value: any, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPercent(value: any) {
  return (asNumber(value, 0) * 100).toFixed(2) + '%';
}

function toChartSeries(rows: any[]) {
  const source = Array.isArray(rows) ? rows : [];
  return source.map(function(point: any, index: number) {
    return {
      time: point && point.time !== undefined ? point.time : point && point.timestamp !== undefined ? point.timestamp : (index + 1),
      value: asNumber(point && point.value, 0),
    };
  });
}

function ensureDrawdownSeries(backtest: any, equity: any[]) {
  if (Array.isArray(backtest && backtest.drawdown) && backtest.drawdown.length > 0) {
    return toChartSeries(backtest.drawdown);
  }
  return [];
}

function BaseCanvasChartFallback(props: any) {
  return <div className="factory-backtester-empty">Chart renderer unavailable</div>;
}

import BaseCanvasChart from '../shared/BaseCanvasChart';
import BaseTimeSeriesChart from '../shared/BaseTimeSeriesChart';

interface FactoryEquityChartProps {
  backtest?: any;
  height?: number;
}

export default function FactoryEquityChart(props: FactoryEquityChartProps) {
  const backtest = props.backtest || null;
  const height = props.height || 260;
  const store = useDashboardStore();

  const [fetchedBacktest, setFetchedBacktest] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [activeSeries, setActiveSeries] = useState('equity');

  const backtestResults: any[] = (store as any).backtestResults || [];
  const latestBacktest = backtest || backtestResults[0] || fetchedBacktest;

  useEffect(() => {
    if (backtest || backtestResults.length > 0) return;
    let cancelled = false;
    invoke('factory_backtest_results', { limit: 1 })
      .then((result: any) => {
        if (!cancelled && result && result.latest) {
          setFetchedBacktest(result.latest);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [backtest, backtestResults.length]);

  useEffect(() => {
    if (!latestBacktest || !latestBacktest.id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    invoke('factory_backtest_equity', { id: latestBacktest.id })
      .then((result: any) => {
        if (!cancelled && result) {
          setDetail(result);
        }
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => { cancelled = true; };
  }, [latestBacktest && latestBacktest.id]);

  const equityCurve = toChartSeries((detail && detail.equity) || (latestBacktest && latestBacktest.equityCurve) || []);
  const drawdownCurve = ensureDrawdownSeries(latestBacktest, equityCurve);
  const volumeCurve = toChartSeries((detail && detail.volume) || (latestBacktest && latestBacktest.volume) || []);

  if (!latestBacktest || equityCurve.length === 0) {
    return <div className="factory-backtester-empty" style={{ height: height + 'px' }}>Equity curve will appear after the first backtest run.</div>;
  }

  const values = equityCurve.map((point: any) => asNumber(point.value, 0));
  const latestValue = values[values.length - 1];
  const firstValue = values[0];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const pnlPct = firstValue !== 0 ? ((latestValue - firstValue) / firstValue) : 0;

  const drawdownMin = drawdownCurve.reduce((min: number, point: any) => {
    return Math.min(min, asNumber(point.value, 0));
  }, 0);

  const hasVolume = volumeCurve.length > 0;
  const seriesOptions = [
    { id: 'equity', label: 'Equity', data: equityCurve, lineColor: 'var(--chart-equity-line)', areaColor: 'var(--chart-equity-fill)' },
    { id: 'drawdown', label: 'Drawdown', data: drawdownCurve, lineColor: 'var(--danger-color)', areaColor: 'var(--chart-drawdown-fill)' },
  ];
  if (hasVolume) {
    seriesOptions.push({ id: 'volume', label: 'Volume', data: volumeCurve, lineColor: 'var(--chart-volume-bar)', areaColor: 'color-mix(in srgb, var(--chart-volume-bar) 35%, transparent)' });
  }

  const selectedSeries = seriesOptions.find((item: any) => item.id === activeSeries) || seriesOptions[0];

  return (
    <div className="factory-equity-card" style={{ height: height + 'px' }}>
      <div className="factory-equity-head">
        <div className="factory-equity-title-wrap">
          <div className="factory-backtester-card-head">Equity Curve</div>
          <div className="factory-equity-sub">{(latestBacktest.symbol || 'N/A') + ' • ' + (latestBacktest.strategyType || 'strategy')}</div>
        </div>
        <div className="factory-equity-stats">
          <div className="factory-equity-stat-value">${latestValue.toFixed(2)}</div>
          <div className={`factory-equity-stat-pct ${pnlPct >= 0 ? 'positive' : 'negative'}`}>{(pnlPct >= 0 ? '+' : '') + (pnlPct * 100).toFixed(2)}%</div>
        </div>
      </div>
      <div className="factory-equity-tabs">
        {seriesOptions.map((option: any) => (
          <button
            key={option.id}
            className={`factory-btn factory-btn-sm ${option.id === selectedSeries.id ? 'factory-btn-primary' : ''}`}
            type="button"
            onClick={() => setActiveSeries(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div
        className="factory-equity-timeseries"
        style={{ height: Math.max(120, height - 124), background: '#1a2332', borderRadius: 4, position: 'relative' as const }}
      >
        <div style={{ position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'flex-end' as const, padding: 8 }}>
          {selectedSeries.data.slice(-60).map((point: any, i: number) => {
            const values = selectedSeries.data.map((p: any) => p?.value ?? 0);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min || 1;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${((point?.value ?? 0) - min) / range * 100}%`,
                  background: selectedSeries.areaColor || selectedSeries.lineColor || '#3b82f6',
                  minHeight: 1,
                  opacity: 0.7,
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="factory-equity-footer">
        <span>Min ${minValue.toFixed(2)}</span>
        <span>{String(latestBacktest.tradeCount || (latestBacktest.metrics ? latestBacktest.metrics.totalTrades : 0) || 0)} trades</span>
        <span>Max ${maxValue.toFixed(2)}</span>
        <span>Max DD {toPercent(Math.abs(drawdownMin) / Math.max(maxValue, 1))}</span>
      </div>
    </div>
  );
}