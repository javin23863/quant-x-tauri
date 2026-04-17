import { useDashboardStore } from '../../store/dashboard';
import FactoryShell from './FactoryShell';

interface FactoryViewProps {
  [key: string]: unknown;
}

export default function FactoryView(props: FactoryViewProps) {
  return <FactoryShell {...(props || {})} />;
}