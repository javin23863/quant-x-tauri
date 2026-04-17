interface FactoryModuleRailProps {
  modules?: Array<{ id: string; label: string; icon: string; badge?: string | number }>;
  activeModule?: string;
  onSelect?: (moduleId: string) => void;
  onModuleChange?: (moduleId: string) => void;
}

export default function FactoryModuleRail(props: FactoryModuleRailProps) {
  const modules = props.modules || [];
  const activeModule = props.activeModule || 'builder';
  const onSelect = typeof props.onSelect === 'function' ? props.onSelect : () => {};
  const onModuleChange = typeof props.onModuleChange === 'function' ? props.onModuleChange : onSelect;

  return (
    <aside className="factory-module-rail" aria-label="Factory modules">
      {modules.map((moduleItem) => {
        const active = activeModule === moduleItem.id;
        return (
          <button
            key={moduleItem.id}
            className={`factory-module-btn ${active ? 'active' : ''}`}
            onClick={() => onModuleChange(moduleItem.id)}
            type="button"
            title={moduleItem.label}
            aria-pressed={active ? 'true' : 'false'}
          >
            <span className="factory-module-icon">{moduleItem.icon}</span>
            <span className="factory-module-label">{moduleItem.label}</span>
          </button>
        );
      })}
    </aside>
  );
}