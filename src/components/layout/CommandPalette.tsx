import { useState, useEffect, useRef, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboard';

interface Command {
  id: string;
  label: string;
  icon: string;
  category: string;
  action: () => void;
}

export default function CommandPalette() {
  const setView = useDashboardStore((s: any) => s.setView as ((view: string) => void)) ?? (() => {});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => {
    const allCommands: Command[] = [
      { id: 'nav-overview', label: 'Go to Overview', icon: '📋', category: 'Navigation', action: () => { setView('mc-overview'); } },
      { id: 'nav-signals', label: 'Go to Market Feed', icon: '📡', category: 'Navigation', action: () => { setView('mc-signals'); } },
      { id: 'nav-execution', label: 'Go to Live Monitor', icon: '⚡', category: 'Navigation', action: () => { setView('mc-execution'); } },
      { id: 'nav-portfolio', label: 'Go to Portfolio', icon: '💰', category: 'Navigation', action: () => { setView('mc-portfolio'); } },
      { id: 'nav-factory', label: 'Go to Strategy Generator', icon: '🏭', category: 'Navigation', action: () => { setView('factory'); } },
      { id: 'nav-backtester', label: 'Go to Backtester', icon: '🧪', category: 'Navigation', action: () => { setView('mc-backtester'); } },
      { id: 'nav-library', label: 'Go to Strategy Library', icon: '💾', category: 'Navigation', action: () => { setView('mc-library'); } },
      { id: 'nav-risk', label: 'Go to Risk Gate', icon: '🛡️', category: 'Navigation', action: () => { setView('mc-risk'); } },
      { id: 'nav-truth', label: 'Go to Truth History', icon: '⚖️', category: 'Navigation', action: () => { setView('mc-truth'); } },
      { id: 'nav-activation', label: 'Go to Live Activation', icon: '🚀', category: 'Navigation', action: () => { setView('live-activation'); } },
      { id: 'nav-models', label: 'Go to Model Manager', icon: '✨', category: 'Navigation', action: () => { setView('model-manager'); } },
      { id: 'action-generate', label: 'Generate New Strategy', icon: '🔬', category: 'Actions', action: () => { setView('factory'); } },
      { id: 'action-backtest', label: 'Run Backtest', icon: '▶️', category: 'Actions', action: () => { setView('mc-backtester'); } },
      { id: 'action-export', label: 'Export Strategy JSON', icon: '📤', category: 'Actions', action: () => { console.log('Export TBD'); } },
      { id: 'action-refresh', label: 'Refresh State', icon: '🔄', category: 'Actions', action: () => { window.location.reload(); } },
    ];

    if (!query) return allCommands;

    const q = query.toLowerCase();
    return allCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.id.toLowerCase().includes(q)
    );
  }, [query, setView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
        return;
      }

      if (open) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, commands.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && commands[selectedIndex]) {
          e.preventDefault();
          commands[selectedIndex].action();
          setOpen(false);
          setQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, commands, selectedIndex]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleExecute = (cmd: Command) => {
    cmd.action();
    setOpen(false);
    setQuery('');
  };

  if (!open) return null;

  const categories = ['Navigation', 'Actions'];

  return (
    <div className="command-palette-overlay" onClick={() => { setOpen(false); setQuery(''); }}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-header">
          <span className="command-palette-icon">⌘</span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commands[selectedIndex]) {
                handleExecute(commands[selectedIndex]);
              }
            }}
          />
          <span className="command-palette-hint">ESC to close</span>
        </div>

        <div className="command-palette-results">
          {commands.length === 0 && (
            <div className="command-palette-empty">
              {`No commands found for "${query}"`}
            </div>
          )}

          {commands.length > 0 && categories.map((category) => {
            const categoryCommands = commands.filter((c) => c.category === category);
            if (categoryCommands.length === 0) return null;

            return (
              <div key={category} className="command-palette-category">
                <div className="command-palette-category-label">{category}</div>
                {categoryCommands.map((cmd) => {
                  const globalIndex = commands.indexOf(cmd);
                  return (
                    <div
                      key={cmd.id}
                      className={`command-palette-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                      onClick={() => handleExecute(cmd)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <span className="command-palette-item-icon">{cmd.icon}</span>
                      <span className="command-palette-item-label">{cmd.label}</span>
                      {globalIndex === selectedIndex && (
                        <span className="command-palette-item-hint">Enter to select</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="command-palette-footer">
          <span className="command-palette-shortcut">
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </span>
          <span className="command-palette-shortcut">
            <kbd>Enter</kbd> to select
          </span>
        </div>
      </div>
    </div>
  );
}