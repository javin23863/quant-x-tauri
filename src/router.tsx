import { createContext, useContext, useCallback, type ReactNode } from "react";

export type ViewId =
  | "dashboard"
  | "positions"
  | "orders"
  | "signals"
  | "risk"
  | "regime"
  | "strategy"
  | "paper"
  | "portfolio"
  | "propfirm"
  | "monitoring"
  | "settings";

export const VALID_VIEWS: ViewId[] = [
  "dashboard",
  "positions",
  "orders",
  "signals",
  "risk",
  "regime",
  "strategy",
  "paper",
  "portfolio",
  "propfirm",
  "monitoring",
  "settings",
];

interface RouterState {
  activeView: ViewId;
}

interface RouterActions {
  navigate: (view: ViewId) => void;
}

const RouterContext = createContext<(RouterState & RouterActions) | null>(null);

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}

import { useState } from "react";

export function RouterProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<ViewId>(() => {
    const hash = window.location.hash.slice(1);
    return VALID_VIEWS.includes(hash as ViewId) ? (hash as ViewId) : "dashboard";
  });

  const navigate = useCallback((view: ViewId) => {
    if (!VALID_VIEWS.includes(view)) return;
    window.location.hash = view;
    setActiveView(view);
  }, []);

  return (
    <RouterContext.Provider value={{ activeView, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}