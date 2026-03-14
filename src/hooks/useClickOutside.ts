import { type RefObject, useEffect } from "react";

export function useClickOutside(
  refs: RefObject<Element | null>[],
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (refs.some((ref) => ref.current?.contains(e.target as Node))) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
