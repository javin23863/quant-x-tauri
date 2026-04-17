import React, { useState, useCallback } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

interface ValidationErrors {
  [key: string]: string[] | undefined;
  submit?: string[];
}

interface FormData {
  strategyType: string;
  preset: string | null;
  universe: {
    type: string;
    symbols: string[];
    sectors: string[];
  };
  timeframe: {
    start: string;
    end: string;
  };
  params: {
    lookback: number;
    threshold: number;
    stopLoss: number;
    takeProfit: number;
    positionSize: number;
    maxPositions: number;
  };
}

const templates: Record<string, { name: string; description: string; templateId: string; params: string[] }> = {
  momentum: {
    name: 'Momentum',
    description: 'Trend pullback template tuned for directional continuation',
    templateId: 'trend_pullback_safe',
    params: ['lookback', 'threshold', 'stopLoss', 'takeProfit'],
  },
  meanReversion: {
    name: 'Mean Reversion',
    description: 'Low-frequency mean reversion template for range regimes',
    templateId: 'mean_reversion_low_frequency',
    params: ['lookback', 'threshold', 'stopLoss'],
  },
  regime: {
    name: 'Regime-Based',
    description: 'Opening-range breakout template for stronger directional regimes',
    templateId: 'orb_conservative',
    params: ['lookback', 'maxPositions'],
  },
  pairs: {
    name: 'Pairs Trading',
    description: 'Mean-reversion style proxy template for relative-value testing',
    templateId: 'mean_reversion_low_frequency',
    params: ['threshold', 'positionSize'],
  },
};

const presets: Record<string, { name: string; description: string; params: Record<string, number> }> = {
  conservative: {
    name: 'Conservative',
    description: 'Lower risk, smaller positions',
    params: { lookback: 30, threshold: 0.03, stopLoss: 0.03, takeProfit: 0.06, positionSize: 0.02, maxPositions: 3 },
  },
  balanced: {
    name: 'Balanced',
    description: 'Standard risk/reward profile',
    params: { lookback: 20, threshold: 0.02, stopLoss: 0.05, takeProfit: 0.10, positionSize: 0.05, maxPositions: 5 },
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Higher risk, larger positions',
    params: { lookback: 10, threshold: 0.01, stopLoss: 0.08, takeProfit: 0.15, positionSize: 0.10, maxPositions: 8 },
  },
};

const sectors = [
  { id: 'tech', name: 'Technology', symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL'] },
  { id: 'finance', name: 'Financials', symbols: ['JPM', 'BAC', 'GS', 'MS'] },
  { id: 'healthcare', name: 'Healthcare', symbols: ['JNJ', 'PFE', 'UNH', 'ABBV'] },
  { id: 'energy', name: 'Energy', symbols: ['XOM', 'CVX', 'COP', 'SLB'] },
  { id: 'consumer', name: 'Consumer', symbols: ['AMZN', 'TSLA', 'WMT', 'HD'] },
];

export default function FactoryStrategyPanel() {
  const state = useDashboardStore() as any;

  const [strategyType, setStrategyType] = useState<string>('momentum');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState<FormData>({
    strategyType: 'momentum',
    preset: null,
    universe: { type: 'symbols', symbols: ['SPY', 'QQQ', 'IWM'], sectors: [] },
    timeframe: { start: '', end: '' },
    params: { lookback: 20, threshold: 0.02, stopLoss: 0.05, takeProfit: 0.10, positionSize: 0.05, maxPositions: 5 },
  });

  const validateField = (field: string, value: any): string[] | null => {
    const errors: string[] = [];
    if (field === 'lookback') {
      if (!value || value < 1) errors.push('Minimum: 1');
      if (value > 200) errors.push('Maximum: 200');
    }
    if (field === 'threshold' || field === 'stopLoss' || field === 'takeProfit' || field === 'positionSize') {
      if (value < 0 || value > 1) errors.push('Must be between 0 and 1');
      if (isNaN(parseFloat(value))) errors.push('Invalid number');
    }
    if (field === 'maxPositions') {
      if (!value || value < 1) errors.push('Minimum: 1');
      if (value > 20) errors.push('Maximum: 20');
    }
    if (field === 'timeframe') {
      if (value.start && value.end && new Date(value.start) >= new Date(value.end)) {
        errors.push('End date must be after start date');
      }
    }
    if (field === 'universe') {
      if (value.type === 'symbols' && (!value.symbols || value.symbols.length === 0)) {
        errors.push('Select at least one symbol');
      }
      if (value.type === 'sectors' && (!value.sectors || value.sectors.length === 0)) {
        errors.push('Select at least one sector');
      }
    }
    return errors.length > 0 ? errors : null;
  };

  const validateAll = (): boolean => {
    const errors: ValidationErrors = {};
    const lookbackErr = validateField('lookback', formData.params.lookback);
    if (lookbackErr) errors.lookback = lookbackErr;
    const thresholdErr = validateField('threshold', formData.params.threshold);
    if (thresholdErr) errors.threshold = thresholdErr;
    const stopLossErr = validateField('stopLoss', formData.params.stopLoss);
    if (stopLossErr) errors.stopLoss = stopLossErr;
    const positionSizeErr = validateField('positionSize', formData.params.positionSize);
    if (positionSizeErr) errors.positionSize = positionSizeErr;
    const maxPositionsErr = validateField('maxPositions', formData.params.maxPositions);
    if (maxPositionsErr) errors.maxPositions = maxPositionsErr;
    const universeErr = validateField('universe', formData.universe);
    if (universeErr) errors.universe = universeErr;
    const timeframeErr = validateField('timeframe', formData.timeframe);
    if (timeframeErr) errors.timeframe = timeframeErr;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleParamChange = (key: string, value: string) => {
    const parsed = parseFloat(value);
    setFormData((prev) => ({ ...prev, params: { ...prev.params, [key]: isNaN(parsed) ? value : parsed } }));
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const handleUniverseChange = (type: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      universe: { ...prev.universe, type, [type === 'symbols' ? 'symbols' : 'sectors']: value },
    }));
    setTouched((prev) => ({ ...prev, universe: true }));
  };

  const handleTimeframeChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, timeframe: { ...prev.timeframe, [key]: value } }));
    setTouched((prev) => ({ ...prev, timeframe: true }));
  };

  const handlePresetChange = (presetKey: string) => {
    if (presetKey && presets[presetKey]) {
      setFormData((prev) => ({ ...prev, preset: presetKey, params: { ...prev.params, ...presets[presetKey].params } }));
    } else {
      setFormData((prev) => ({ ...prev, preset: null }));
    }
  };

  const handleGenerateStrategy = async () => {
    if (!validateAll()) return;
    setLoading(true);
    setValidationErrors({});
    useDashboardStore.setState({ factoryStatus: { stage: 'strategy', status: 'running', message: 'Generating strategy...' } } as any);
    try {
      const result = await invoke('factory_strategy_generate', {
        type: strategyType,
        params: formData.params,
        universe: formData.universe,
        timeframe: formData.timeframe,
      }) as any;
      if (result && result.ok === false) throw new Error(result.error || 'Generation failed');
      useDashboardStore.setState({
        generatedStrategy: result.strategy || result,
        factoryResults: [result.strategy || result, ...(state.factoryResults || [])],
        factoryStatus: { stage: 'strategy', status: 'completed', message: 'Strategy generated' },
      } as any);
    } catch (err: any) {
      setValidationErrors({ submit: ['Generation failed: ' + (err.message || String(err))] });
      useDashboardStore.setState({ factoryStatus: { stage: 'strategy', status: 'failed', message: err.message || String(err) } } as any);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    const isValid = validateAll();
    try {
      const result = await invoke('factory_strategy_validate', {
        type: strategyType,
        params: formData.params,
        universe: formData.universe,
        timeframe: formData.timeframe,
      }) as any;
      useDashboardStore.setState({
        factoryValidationResult: { isValid: result.valid, errors: result.errors || [], warnings: result.warnings || [] },
      } as any);
      if (!result.valid && result.errors && result.errors.length > 0) {
        const errs: ValidationErrors = {};
        result.errors.forEach((e: string) => {
          if (e.indexOf('Lookback') !== -1) errs.lookback = [e];
          else if (e.indexOf('Threshold') !== -1) errs.threshold = [e];
          else if (e.indexOf('Stop loss') !== -1) errs.stopLoss = [e];
          else if (e.indexOf('Position') !== -1) errs.positionSize = [e];
        });
        setValidationErrors(errs);
      }
    } catch {
      useDashboardStore.setState({ factoryValidationResult: { isValid, errors: validationErrors } } as any);
    }
  };

  const getInputClassName = (field: string): string => {
    let classes = 'factory-input';
    if (validationErrors[field] && touched[field]) classes += ' factory-input-error';
    return classes;
  };

  const renderError = (field: string): React.ReactNode => {
    if (validationErrors[field] && touched[field]) {
      return <div className="factory-error-message">{validationErrors[field]!.map((err, i) => <span key={i}>{err}</span>)}</div>;
    }
    return null;
  };

  return (
    <div className="factory-template-panel">
      <div className="factory-template-header">
        <div className="factory-template-title">STRATEGY GENERATOR</div>
        <div className="factory-template-subtitle">Select template and configure parameters</div>
      </div>

      <div className="factory-template-grid">
        <div className="factory-template-sidebar">
          <div className="factory-section-label">Strategy Type</div>
          <div className="factory-template-list">
            {Object.entries(templates).map(([key, t]) => (
              <div
                key={key}
                className={`factory-template-item ${strategyType === key ? 'factory-template-active' : ''}`}
                onClick={() => setStrategyType(key)}
              >
                <div className="factory-template-name">{t.name}</div>
                <div className="factory-template-desc">{t.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="factory-template-main">
          <div className="factory-param-grid">
            <div className="factory-param-group">
              <div className="factory-param-header">Universe Selection<span className="factory-required">*</span></div>
              <div className="factory-param-row">
                <div className="factory-radio-group">
                  <label className="factory-radio-label">
                    <input type="radio" name="universeType" checked={formData.universe.type === 'symbols'} onChange={() => handleUniverseChange('symbols', [])} />
                    Symbols
                  </label>
                  <label className="factory-radio-label">
                    <input type="radio" name="universeType" checked={formData.universe.type === 'sectors'} onChange={() => handleUniverseChange('sectors', [])} />
                    Sectors
                  </label>
                </div>
              </div>
              {formData.universe.type === 'symbols' && (
                <div className="factory-param-row">
                  <label className="factory-input-label" htmlFor="symbols">Symbols (comma-separated)</label>
                  <input
                    id="symbols"
                    className={getInputClassName('symbols')}
                    type="text"
                    value={formData.universe.symbols.join(', ')}
                    onChange={(e) => handleUniverseChange('symbols', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="SPY, QQQ, IWM..."
                  />
                  {renderError('symbols')}
                </div>
              )}
              {formData.universe.type === 'sectors' && (
                <div className="factory-param-row">
                  <label className="factory-input-label">Sectors</label>
                  <div className="factory-checkbox-grid">
                    {sectors.map((sector) => (
                      <label key={sector.id} className="factory-checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.universe.sectors.includes(sector.id)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...formData.universe.sectors, sector.id]
                              : formData.universe.sectors.filter((s) => s !== sector.id);
                            handleUniverseChange('sectors', updated);
                          }}
                        />
                        {sector.name}
                      </label>
                    ))}
                  </div>
                  {renderError('sectors')}
                </div>
              )}
            </div>

            <div className="factory-param-group">
              <div className="factory-param-header">Time Frame<span className="factory-required">*</span></div>
              <div className="factory-param-row">
                <label className="factory-input-label" htmlFor="startDate">Start Date</label>
                <input id="startDate" className={getInputClassName('timeframe')} type="date" value={formData.timeframe.start} onChange={(e) => handleTimeframeChange('start', e.target.value)} />
              </div>
              <div className="factory-param-row">
                <label className="factory-input-label" htmlFor="endDate">End Date</label>
                <input id="endDate" className={getInputClassName('timeframe')} type="date" value={formData.timeframe.end} onChange={(e) => handleTimeframeChange('end', e.target.value)} />
                {renderError('timeframe')}
              </div>
            </div>

            <div className="factory-param-group">
              <div className="factory-param-header">Template Presets</div>
              <div className="factory-param-row">
                <select className="factory-select" value={formData.preset || ''} onChange={(e) => handlePresetChange(e.target.value || '')}>
                  <option value="">Custom</option>
                  {Object.entries(presets).map(([key, p]) => <option key={key} value={key}>{p.name}</option>)}
                </select>
              </div>
              {formData.preset && presets[formData.preset] && (
                <div className="factory-preset-desc">{presets[formData.preset].description}</div>
              )}
            </div>

            <div className="factory-param-group">
              <div className="factory-param-header">Signal Parameters</div>
              <div className="factory-param-row">
                <label className="factory-input-label" htmlFor="lookback">Lookback Period<span className="factory-required">*</span></label>
                <input id="lookback" className={getInputClassName('lookback')} type="number" value={formData.params.lookback} onChange={(e) => handleParamChange('lookback', e.target.value)} min={1} max={200} />
                {renderError('lookback')}
              </div>
              <div className="factory-param-row">
                <label className="factory-input-label" htmlFor="threshold">Signal Threshold<span className="factory-required">*</span></label>
                <input id="threshold" className={getInputClassName('threshold')} type="number" value={formData.params.threshold} onChange={(e) => handleParamChange('threshold', e.target.value)} step={0.01} min={0} max={1} />
                {renderError('threshold')}
              </div>
            </div>

            <div className="factory-param-group">
              <div className="factory-param-header">Risk Parameters</div>
              <div className="factory-param-row">
                <label className="factory-input-label" htmlFor="stopLoss">Stop Loss (%)<span className="factory-required">*</span></label>
                <input id="stopLoss" className={getInputClassName('stopLoss')} type="number" value={formData.params.stopLoss} onChange={(e) => handleParamChange('stopLoss', e.target.value)} step={0.01} min={0} max={1} />
                {renderError('stopLoss')}
              </div>
              <div className="factory-param-row">
                <label className="factory-input-label" htmlFor="takeProfit">Take Profit (%)</label>
                <input id="takeProfit" className={getInputClassName('takeProfit')} type="number" value={formData.params.takeProfit} onChange={(e) => handleParamChange('takeProfit', e.target.value)} step={0.01} min={0} max={1} />
                {renderError('takeProfit')}
              </div>
              <div className="factory-param-row">
                <label className="factory-input-label" htmlFor="positionSize">Position Size (%)<span className="factory-required">*</span></label>
                <input id="positionSize" className={getInputClassName('positionSize')} type="number" value={formData.params.positionSize} onChange={(e) => handleParamChange('positionSize', e.target.value)} step={0.01} min={0} max={1} />
                {renderError('positionSize')}
              </div>
              <div className="factory-param-row">
                <label className="factory-input-label" htmlFor="maxPositions">Max Positions<span className="factory-required">*</span></label>
                <input id="maxPositions" className={getInputClassName('maxPositions')} type="number" value={formData.params.maxPositions} onChange={(e) => handleParamChange('maxPositions', e.target.value)} min={1} max={20} />
                {renderError('maxPositions')}
              </div>
            </div>
          </div>

          {validationErrors.submit && <div className="factory-error-banner">{validationErrors.submit[0]}</div>}

          <div className="factory-template-actions">
            <button
              className={`factory-btn factory-btn-primary ${loading ? 'factory-btn-loading' : ''}`}
              onClick={handleGenerateStrategy}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Strategy'}
            </button>
            <button className="factory-btn" onClick={handleValidate}>Validate Parameters</button>
          </div>
        </div>
      </div>
    </div>
  );
}