interface FactoryControlBarProps {
  tabs?: Array<{ id: string; label: string; icon?: string }>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  onTabSelect?: (tabId: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  onPause?: () => void;
  startDisabled?: boolean;
  stopDisabled?: boolean;
  pauseDisabled?: boolean;
  pauseLabel?: string;
  statusText?: string;
}

export default function FactoryControlBar(props: FactoryControlBarProps) {
  const tabs = props.tabs || [];
  const activeTab = props.activeTab || 'progress';
  const statusText = props.statusText || '';

  const onStart = typeof props.onStart === 'function' ? props.onStart : () => {};
  const onStop = typeof props.onStop === 'function' ? props.onStop : () => {};
  const onPause = typeof props.onPause === 'function' ? props.onPause : () => {};
  const onTabSelect = typeof props.onTabSelect === 'function' ? props.onTabSelect : () => {};

  const startDisabled = Boolean(props.startDisabled);
  const stopDisabled = Boolean(props.stopDisabled);
  const pauseDisabled = Boolean(props.pauseDisabled);
  const pauseLabel = props.pauseLabel || 'Pause';

  return (
    <div className="factory-control-bar">
      <div className="factory-control-actions">
        <button type="button" className="factory-btn factory-control-btn" onClick={onStop} disabled={stopDisabled}>
          Stop
        </button>
        <button type="button" className="factory-btn factory-control-btn" onClick={onPause} disabled={pauseDisabled}>
          {pauseLabel}
        </button>
        <button type="button" className="factory-btn factory-control-btn factory-control-btn-start" onClick={onStart} disabled={startDisabled}>
          Start
        </button>
      </div>
      <div className="factory-control-tabs">
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`factory-control-tab ${selected ? 'active' : ''}`}
              onClick={() => onTabSelect(tab.id)}
              aria-pressed={selected ? 'true' : 'false'}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="factory-control-status">{statusText}</div>
    </div>
  );
}