import { Button } from '@/components/ui/button';
import ModalOverlay from './ModalOverlay';

interface Props {
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({ title, message, onConfirm, onCancel }: Props) {
  return (
    <ModalOverlay>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </ModalOverlay>
  );
}
