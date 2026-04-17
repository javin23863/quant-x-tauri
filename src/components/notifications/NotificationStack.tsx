import { useDashboardStore } from "../../store/dashboard";
import type { Notification } from "../../types";

interface Props {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

const typeStyles: Record<string, string> = {
  info: "bg-blue-500/20 border-blue-500/50 text-blue-300",
  warning: "bg-yellow-500/20 border-yellow-500/50 text-yellow-300",
  error: "bg-red-500/20 border-red-500/50 text-red-300",
  success: "bg-green-500/20 border-green-500/50 text-green-300",
};

const typeIcons: Record<string, string> = {
  info: "\u2139",
  warning: "\u26A0",
  error: "\u2715",
  success: "\u2713",
};

export default function NotificationStack({ notifications, onDismiss }: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.slice(0, 5).map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-2 p-3 rounded-lg border ${typeStyles[n.type] || typeStyles.info} text-sm`}
        >
          <span className="text-base">{typeIcons[n.type] || typeIcons.info}</span>
          <div className="flex-1">
            <p className="font-semibold">{n.title}</p>
            <p className="text-xs opacity-80">{n.message}</p>
          </div>
          <button onClick={() => onDismiss(n.id)} className="text-xs opacity-60 hover:opacity-100">
            {"\u2715"}
          </button>
        </div>
      ))}
    </div>
  );
}