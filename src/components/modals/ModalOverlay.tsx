interface Props {
  children: React.ReactNode;
  size?: 'sm' | 'lg';
}

export default function ModalOverlay({ children, size = 'sm' }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`w-full ${size === 'sm' ? 'max-w-sm' : 'max-w-lg'} bg-card rounded-xl border shadow-lg p-6 space-y-4`}>
        {children}
      </div>
    </div>
  );
}
