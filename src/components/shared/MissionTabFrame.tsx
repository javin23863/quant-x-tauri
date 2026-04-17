import React from 'react';

interface MissionTabFrameProps {
  number: number;
  title: string;
  subtitle?: string;
  indicators?: Array<{ label: string; value: string; detail?: string; status?: string }>;
  notes?: string[];
  children?: React.ReactNode;
}

export default function MissionTabFrame({ number, title, subtitle, indicators, notes, children }: MissionTabFrameProps) {
  return (
    <div className="mission-tab-frame">
      <div className="view-header mission-tab-header">
        <div>
          <div className="mission-tab-kicker">Tab {String(number).padStart(2, '0')}</div>
          <div className="view-title">{title}</div>
          {subtitle && <div className="view-subtitle">{subtitle}</div>}
        </div>
      </div>

      {Array.isArray(indicators) && indicators.length > 0 && (
        <div className="mission-tab-indicators">
          {indicators.map((indicator) => (
            <div key={indicator.label} className="mission-indicator-card">
              <div className="mission-indicator-topline">
                <span className={`mission-indicator-dot ${indicator.status ?? 'neutral'}`}></span>
                <span className="mission-indicator-label">{indicator.label}</span>
              </div>
              <div className="mission-indicator-value">{indicator.value}</div>
              {indicator.detail && <div className="mission-indicator-detail">{indicator.detail}</div>}
            </div>
          ))}
        </div>
      )}

      {Array.isArray(notes) && notes.length > 0 && (
        <div className="mission-tab-notes panel">
          <div className="mission-tab-notes-title">Implementation Notes</div>
          <div className="mission-tab-notes-list">
            {notes.map((note, index) => (
              <div key={`${index}-${note}`} className="mission-tab-note-item">{note}</div>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}