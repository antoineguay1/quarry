import type { SidebarPanel } from '@/types';
import { STORAGE_KEYS } from '@/lib/storage';
import { useEffect, useState } from 'react';

const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 480;
const DEFAULT_SIDEBAR = 224;
const STORAGE_KEY = STORAGE_KEYS.SIDEBAR;

function loadSidebarState(): { width: number; panel: SidebarPanel | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { width: DEFAULT_SIDEBAR, panel: 'connections' };
}

export function useSidebar() {
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSidebarState().width);
  const [activePanel, setActivePanel] = useState<SidebarPanel | null>(
    () => loadSidebarState().panel
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width: sidebarWidth, panel: activePanel }));
  }, [sidebarWidth, activePanel]);

  function togglePanel(panel: SidebarPanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onMouseMove(ev: MouseEvent) {
      const next = Math.max(
        MIN_SIDEBAR,
        Math.min(MAX_SIDEBAR, startWidth + ev.clientX - startX)
      );
      setSidebarWidth(next);
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  return { sidebarWidth, activePanel, setActivePanel, togglePanel, handleResizeStart };
}
