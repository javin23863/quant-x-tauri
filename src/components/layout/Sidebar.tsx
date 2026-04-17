import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { label: "Dashboard", icon: "⊞", action: null },
    { label: "Positions", icon: "⊞", action: null },
    { label: "Orders", icon: "⊞", action: null },
    { label: "Signals", icon: "⊞", action: null },
    { label: "Risk", icon: "⊞", action: null },
    { label: "Strategy", icon: "⊞", action: null },
    {
      label: "Start Trading",
      icon: "▶",
      action: async () => {
        try { await invoke("start_trading", { mode: "paper" }); } catch (e) { console.error(e); }
      },
    },
    {
      label: "Stop Trading",
      icon: "■",
      action: async () => {
        try { await invoke("stop_trading"); } catch (e) { console.error(e); }
      },
    },
  ];

  return (
    <aside
      className={`bg-[#1a2332] border-r border-slate-700 transition-all duration-200 ${
        collapsed ? "w-12" : "w-48"
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full p-2 text-slate-400 hover:text-slate-200 text-sm"
      >
        {collapsed ? "»" : "«"}
      </button>
      <nav className="flex flex-col gap-1 p-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action || undefined}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700/50 transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <span>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}