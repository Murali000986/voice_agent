import { useCallback, type DragEvent } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUiStore } from '@/store/uiStore';
import { ConversationNode } from './nodes/ConversationNode';
import { GenericFlowNode } from './nodes/GenericFlowNode';
import { NODE_CATALOG } from '@/data/nodeCatalog';

const nodeTypes = Object.fromEntries([
  ['conversation', ConversationNode],
  ...NODE_CATALOG.filter((n) => n.type !== 'conversation').map((n) => [n.type, GenericFlowNode]),
]);

function CanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNodeId } = useWorkflowStore();
  const setInspectorTab = useUiStore((s) => s.setInspectorTab);
  const setInspectorOpen = useUiStore((s) => s.setInspectorOpen);
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);
  const copilotOpen = useUiStore((s) => s.copilotOpen);
  const lastSaved = useUiStore((s) => s.lastSaved);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type, position);
      setInspectorTab('node');
      setInspectorOpen(true);
    },
    [addNode, screenToFlowPosition, setInspectorOpen, setInspectorTab]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      const id = selected[0]?.id ?? null;
      setSelectedNodeId(id);
      if (id) {
        setInspectorTab('node');
        setInspectorOpen(true);
      }
    },
    [setInspectorOpen, setInspectorTab, setSelectedNodeId]
  );

  return (
    <div className="h-full w-full bg-slate-50">
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
        Saved {lastSaved}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-slate-50"
        defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 2 } }}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cdd5e0" gap={22} size={1} />
        <Controls className="!bg-white !border-slate-200 !shadow-md !rounded-xl overflow-hidden !mb-24 !ml-3" showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) => (n.type === 'conversation' ? '#93c5fd' : '#cbd5e1')}
          maskColor="rgba(248,250,252,0.78)"
          className={`!border !border-slate-200 !rounded-xl !shadow-md !mb-5 ${
            inspectorOpen && copilotOpen ? '!mr-[632px]' : inspectorOpen || copilotOpen ? '!mr-[328px]' : '!mr-4'
          }`}
        />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
