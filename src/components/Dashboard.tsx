import { useDashboardStore } from "../store/dashboard";
import Header from "./layout/Header";
import Sidebar from "./layout/Sidebar";
import PositionTable from "./trading/PositionTable";
import OrderTable from "./trading/OrderTable";
import SignalFeed from "./trading/SignalFeed";
import RiskPanel from "./risk/RiskPanel";
import RegimePanel from "./regime/RegimePanel";
import ChartPanel from "./charts/ChartPanel";
import StrategyPanel from "./strategy/StrategyPanel";
import NotificationStack from "./notifications/NotificationStack";
import AccountSummary from "./account/AccountSummary";
import KillSwitch from "./controls/KillSwitch";

export default function Dashboard() {
  const { notifications, removeNotification } = useDashboardStore();

  return (
    <div className="h-screen flex flex-col bg-[#0f1729] text-slate-200 overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12">
              <AccountSummary />
            </div>
            <div className="col-span-8">
              <ChartPanel />
            </div>
            <div className="col-span-4">
              <RiskPanel />
            </div>
            <div className="col-span-4">
              <RegimePanel />
            </div>
            <div className="col-span-4">
              <StrategyPanel />
            </div>
            <div className="col-span-4">
              <SignalFeed />
            </div>
            <div className="col-span-6">
              <PositionTable />
            </div>
            <div className="col-span-6">
              <OrderTable />
            </div>
          </div>
        </main>
      </div>
      <KillSwitch />
      <NotificationStack
        notifications={notifications}
        onDismiss={removeNotification}
      />
    </div>
  );
}