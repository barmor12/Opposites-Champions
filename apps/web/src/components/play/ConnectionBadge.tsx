import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { ConnectionStatus } from '@/stores/playerStore';

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return (
      <Badge color="green" icon={<Wifi className="size-4" />}>מחובר</Badge>
    );
  }
  if (status === 'reconnecting' || status === 'connecting') {
    return (
      <Badge color="orange" icon={<RefreshCw className="size-4 animate-spin" />} role="status">
        {status === 'connecting' ? 'מתחבר…' : 'מתחבר מחדש…'}
      </Badge>
    );
  }
  return (
    <Badge color="slate" icon={<WifiOff className="size-4" />} role="status">לא מחובר</Badge>
  );
}
