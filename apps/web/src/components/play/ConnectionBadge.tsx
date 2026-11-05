import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { ConnectionStatus } from '@/stores/playerStore';

/** תג מצב חיבור – במסכים צרים מוצג אייקון בלבד (הטקסט נשאר לקוראי מסך) */
export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return (
      <Badge color="green" icon={<Wifi className="size-4" />} className="px-2 sm:px-3">
        <span className="sr-only sm:not-sr-only">מְחוּבָּר</span>
      </Badge>
    );
  }
  if (status === 'reconnecting' || status === 'connecting') {
    return (
      <Badge color="orange" icon={<RefreshCw className="size-4 animate-spin" />} role="status" className="px-2 sm:px-3">
        <span className="sr-only sm:not-sr-only">{status === 'connecting' ? 'מִתְחַבֵּר…' : 'מִתְחַבֵּר מֵחָדָשׁ…'}</span>
      </Badge>
    );
  }
  return (
    <Badge color="slate" icon={<WifiOff className="size-4" />} role="status" className="px-2 sm:px-3">
      <span className="sr-only sm:not-sr-only">לֹא מְחוּבָּר</span>
    </Badge>
  );
}
