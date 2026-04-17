import { useDashboardStore } from "../../store/dashboard";

const statusColor: Record<string, string> = {
  filled: "text-green-400",
  partially_filled: "text-yellow-400",
  new: "text-blue-400",
  pending_new: "text-blue-400",
  canceled: "text-slate-500",
  rejected: "text-red-400",
};

export default function OrderTable() {
  const { orders } = useDashboardStore();

  if (orders.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">Orders</h3>
        <p className="text-slate-500 text-xs">No recent orders</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">Orders ({orders.length})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700">
              <th className="text-left pb-2">Symbol</th>
              <th className="text-right pb-2">Side</th>
              <th className="text-right pb-2">Type</th>
              <th className="text-right pb-2">Qty</th>
              <th className="text-right pb-2">Filled</th>
              <th className="text-right pb-2">Limit</th>
              <th className="text-right pb-2">Status</th>
              <th className="text-right pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 20).map((order) => (
              <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-2 font-mono text-slate-200">{order.symbol}</td>
                <td className={`py-2 text-right ${order.side === "buy" ? "text-green-400" : "text-red-400"}`}>
                  {order.side}
                </td>
                <td className="py-2 text-right font-mono">{order.type}</td>
                <td className="py-2 text-right font-mono">{order.qty}</td>
                <td className="py-2 text-right font-mono">{order.filled_qty}</td>
                <td className="py-2 text-right font-mono">
                  {order.limit_price ? `$${order.limit_price.toFixed(2)}` : "-"}
                </td>
                <td className={`py-2 text-right ${statusColor[order.status] || "text-slate-400"}`}>
                  {order.status}
                </td>
                <td className="py-2 text-right font-mono text-slate-500">
                  {new Date(order.submitted_at).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}