import { withAutoReconnect } from '@/lib/auto-reconnect';
import type { ColumnInfo, ColumnKeyInfo, TableSchema } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { Key, Link } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ---- layout constants ----
const NODE_WIDTH = 230;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 25;
const NODE_PADDING = 6;

function nodeHeight(columns: ColumnInfo[]) {
  return HEADER_HEIGHT + columns.length * ROW_HEIGHT + NODE_PADDING;
}

// ---- custom node ----
interface TableNodeData {
  tableName: string;
  columns: ColumnInfo[];
  keys: ColumnKeyInfo[];
  [key: string]: unknown;
}

function TableNode({ data }: NodeProps<Node<TableNodeData>>) {
  const pkCols = new Set(
    data.keys.filter((k) => k.isPrimary).map((k) => k.columnName),
  );
  const fkCols = new Set(
    data.keys.filter((k) => k.fkRefTable).map((k) => k.columnName),
  );

  return (
    <div
      className="bg-card border border-border rounded-md overflow-hidden shadow-sm text-xs"
      style={{ width: NODE_WIDTH }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="bg-muted-foreground! w-2! h-2!"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="bg-muted-foreground! w-2! h-2!"
      />

      {/* Header */}
      <div className="bg-muted px-3 py-2 font-semibold text-foreground border-b border-border truncate">
        {data.tableName}
      </div>

      {/* Columns */}
      {data.columns.map((col) => (
        <div
          key={col.name}
          className="flex items-center gap-1.5 px-3 border-b border-border/40 last:border-b-0"
          style={{ height: ROW_HEIGHT }}
        >
          {pkCols.has(col.name) ? (
            <Key size={10} className="shrink-0 text-yellow-500" />
          ) : fkCols.has(col.name) ? (
            <Link size={10} className="shrink-0 text-blue-400" />
          ) : (
            <span className="w-2.5 shrink-0" />
          )}
          <span className="flex-1 truncate text-foreground">{col.name}</span>
          <span className="text-muted-foreground/60 shrink-0 truncate max-w-20">
            {col.dataType}
          </span>
        </div>
      ))}
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

// ---- layout persistence ----
type SavedPositions = Record<string, { x: number; y: number }>;

function layoutKey(connectionName: string, database: string) {
  return `schema-layout::${connectionName}::${database}`;
}

function loadSavedPositions(
  connectionName: string,
  database: string,
): SavedPositions | null {
  try {
    const raw = localStorage.getItem(layoutKey(connectionName, database));
    return raw ? (JSON.parse(raw) as SavedPositions) : null;
  } catch {
    return null;
  }
}

function savePositions(
  connectionName: string,
  database: string,
  nodes: Node[],
) {
  const positions: SavedPositions = {};
  for (const n of nodes) positions[n.id] = n.position;
  localStorage.setItem(
    layoutKey(connectionName, database),
    JSON.stringify(positions),
  );
}

// ---- ELK layout ----
const elk = new ELK();

async function computeLayout(
  schemas: TableSchema[],
  savedPositions: SavedPositions | null,
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const rawNodes: Node<TableNodeData>[] = schemas.map((s) => ({
    id: s.tableName,
    type: 'tableNode',
    position: { x: 0, y: 0 },
    data: { tableName: s.tableName, columns: s.columns, keys: s.keys },
  }));

  // Build edges from FK relationships
  const edgeSet = new Map<string, Edge>();
  for (const s of schemas) {
    for (const key of s.keys) {
      if (key.fkRefTable) {
        const edgeId = `${s.tableName}->${key.fkRefTable}::${key.columnName}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.set(edgeId, {
            id: edgeId,
            source: s.tableName,
            target: key.fkRefTable,
            label: key.columnName,
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
            style: { strokeWidth: 1.5 },
            labelStyle: { fontSize: 10, fill: 'var(--muted-foreground)' },
            labelBgStyle: { fill: 'var(--card)' },
          });
        }
      }
    }
  }
  const rawEdges = Array.from(edgeSet.values());

  // Use saved positions if every table has one, otherwise run ELK
  const allSaved =
    savedPositions && rawNodes.every((n) => savedPositions[n.id]);

  let positionedNodes: Node<TableNodeData>[];

  if (allSaved) {
    positionedNodes = rawNodes.map((n) => ({
      ...n,
      position: savedPositions[n.id],
      style: { width: NODE_WIDTH, height: nodeHeight(n.data.columns) },
    }));
  } else {
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '60',
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      },
      children: rawNodes.map((n) => ({
        id: n.id,
        width: NODE_WIDTH,
        height: nodeHeight(n.data.columns),
      })),
      edges: rawEdges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    const layout = await elk.layout(graph);
    positionedNodes = rawNodes.map((n) => {
      const elkNode = layout.children?.find((c) => c.id === n.id);
      return {
        ...n,
        position: { x: elkNode?.x ?? 0, y: elkNode?.y ?? 0 },
        style: { width: NODE_WIDTH, height: nodeHeight(n.data.columns) },
      };
    });
  }

  return { nodes: positionedNodes, edges: rawEdges };
}

// ---- main component ----
interface Props {
  connectionName: string;
  database: string;
  refreshKey?: number;
}

export default function SchemaTab({
  connectionName,
  database,
  refreshKey,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchSchema = () =>
      withAutoReconnect(connectionName, database, () =>
        invoke<TableSchema[]>('get_schema', {
          connection: connectionName,
          database,
        }),
      );

    const saved = loadSavedPositions(connectionName, database);

    fetchSchema()
      .then((schemas) => computeLayout(schemas, saved))
      .then(({ nodes: n, edges: e }) => {
        if (!cancelled) {
          setNodes(n as Node<TableNodeData>[]);
          setEdges(e);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectionName, database, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const tableCount = useMemo(() => nodes.length, [nodes]);

  const handleNodeDragStop = useCallback(() => {
    setNodes((current) => {
      savePositions(connectionName, database, current);
      return current;
    });
  }, [connectionName, database, setNodes]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b bg-background text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {connectionName} / {database} · Schema
        </span>
        {!loading && !error && (
          <span>
            {tableCount} table{tableCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Loading schema…
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive px-8 text-center">
            {error}
          </div>
        ) : nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No tables found
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable
            nodesConnectable={false}
            onNodeDragStop={handleNodeDragStop}
            deleteKeyCode={null}
            style={
              {
                '--xy-controls-button-background-color': 'var(--card)',
                '--xy-controls-button-background-color-hover': 'var(--accent)',
                '--xy-controls-button-color': 'var(--foreground)',
                '--xy-controls-button-color-hover': 'var(--accent-foreground)',
                '--xy-controls-button-border-color': 'var(--border)',
                '--xy-minimap-background-color': 'var(--card)',
                '--xy-minimap-mask-background-color': 'rgba(0,0,0,0.55)',
              } as React.CSSProperties
            }
          >
            <Background />
            <Controls />
            <MiniMap
              nodeStrokeWidth={2}
              zoomable
              pannable
              nodeColor="rgba(120,120,120,0.5)"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
