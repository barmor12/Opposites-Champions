import { useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  variant = 'danger',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const Icon = variant === 'danger' ? AlertTriangle : HelpCircle;

  return (
    <Modal open={open} onClose={onClose} dismissible={!busy} title={title} size="sm">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-lg',
              variant === 'danger' ? 'bg-linear-to-br from-rose-400 to-red-600 shadow-rose-500/40' : 'bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-violet-500/40',
            )}
          >
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="text-sm leading-6 text-slate-600">{description}</div>
        </div>
        <div className="flex justify-start gap-2">
          <Button variant={variant} size="md" onClick={handleConfirm} loading={busy} disabled={busy}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
