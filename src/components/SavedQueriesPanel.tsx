import { useState, useEffect, useRef, memo } from "react";
import { Trash2, ScrollText, Pencil } from "lucide-react";
import type { SavedConnection, SavedQuery } from "@/types";

interface Props {
  queries: SavedQuery[];
  activeQueryId: string | null;
  onOpen: (query: SavedQuery, preview?: boolean) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  pendingRenameId?: string | null;
  onRenameStarted?: () => void;
  savedConnections: SavedConnection[];
}

export default memo(function SavedQueriesPanel({ queries, activeQueryId, onOpen, onDelete, onRename, pendingRenameId, onRenameStarted, savedConnections }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [search, setSearch] = useState("");
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!editingId) return;
    itemRefs.current.get(editingId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [editingId]);

  useEffect(() => {
    if (!pendingRenameId) return;
    const q = queries.find((q) => q.id === pendingRenameId);
    if (q) {
      setEditingId(pendingRenameId);
      setEditingName(q.name);
      onRenameStarted?.();
    }
  }, [pendingRenameId, queries]);

  function startEdit(query: SavedQuery, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(query.id);
    setEditingName(query.name);
  }

  function commitEdit() {
    if (editingId && editingName.trim()) {
      onRename(editingId, editingName.trim());
    }
    setEditingId(null);
  }

  const visible = search.trim()
    ? queries.filter(
        (q) =>
          q.name.toLowerCase().includes(search.toLowerCase()) ||
          q.connectionName.toLowerCase().includes(search.toLowerCase())
      )
    : queries;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {queries.length > 0 && (
        <div className="px-2 pt-1.5 pb-1 shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-1">
      {queries.length === 0 && (
        <p className="px-3 py-4 text-xs text-muted-foreground text-center">
          No queries yet.<br />Click + to create one.
        </p>
      )}
      {visible.map((q) => {
        const isActive = activeQueryId === q.id;
        return (
          <div
            key={q.id}
            ref={(el) => {
              if (el) itemRefs.current.set(q.id, el);
              else itemRefs.current.delete(q.id);
            }}
            className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer group transition-colors ${
              isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent"
            }`}
            onClick={() => editingId !== q.id && onOpen(q, true)}
            onDoubleClick={() => editingId !== q.id && onOpen(q, false)}
          >
            <ScrollText size={13} className="shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              {editingId === q.id ? (
                <input
                  className="text-sm bg-transparent outline-none border-b border-primary w-full font-medium"
                  value={editingName}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditingId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <p className="text-sm truncate font-medium">{q.name}</p>
              )}
              <p
                className={`text-[10px] truncate ${savedConnections.some((c) => c.name === q.connectionName) ? "text-muted-foreground" : "text-destructive/70"}`}
                title={savedConnections.some((c) => c.name === q.connectionName) ? undefined : "Connection no longer exists"}
              >
                {q.connectionName}
              </p>
            </div>
            <button
              type="button"
              className={`shrink-0 transition-opacity text-muted-foreground hover:text-foreground ${editingId === q.id ? "invisible" : "opacity-0 group-hover:opacity-100"}`}
              onClick={(e) => startEdit(q, e)}
              title="Rename"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              className={`text-muted-foreground hover:text-destructive shrink-0 transition-opacity ${editingId === q.id ? "invisible" : "opacity-0 group-hover:opacity-100"}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(q.id);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
});
