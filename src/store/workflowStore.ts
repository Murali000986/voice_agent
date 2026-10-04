import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import { initialEdges, initialNodes } from '@/data/demoWorkflow';
import { getNodeMeta } from '@/data/nodeCatalog';

export type AppNode = Node;

export type WorkflowState = {
  nodes: AppNode[];
  edges: Edge[];
  previousWorkflow: { nodes: AppNode[]; edges: Edge[] } | null;
  selectedNodeId: string | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  replaceWorkflow: (nodes: AppNode[], edges: Edge[]) => void;
  loadWorkflow: (nodes: AppNode[], edges: Edge[]) => void;
  undoReplace: () => void;
  setSelectedNodeId: (id: string | null) => void;
  addNode: (type: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, data: Record<string, unknown>) => void;
  updateSelectedNode: (data: Record<string, unknown>) => void;
  getSelectedNode: () => AppNode | undefined;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  previousWorkflow: null,
  selectedNodeId: null,
  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge({ ...connection, type: 'smoothstep' }, get().edges),
    });
  },
  setNodes: (nodes: AppNode[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),
  replaceWorkflow: (nodes, edges) => set({ previousWorkflow: { nodes: get().nodes, edges: get().edges }, nodes, edges, selectedNodeId: null }),
  loadWorkflow: (nodes, edges) => set({ nodes, edges, previousWorkflow: null, selectedNodeId: null }),
  undoReplace: () => {
    const prev = get().previousWorkflow;
    if (prev) {
      set({ nodes: prev.nodes, edges: prev.edges, previousWorkflow: null, selectedNodeId: null });
    }
  },
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  addNode: (type, position) => {
    const meta = getNodeMeta(type);
    const id = `${type}-${Date.now()}`;
    const node: AppNode = {
      id,
      type,
      position,
      data: {
        label: meta.label,
        prompt: type === 'conversation' ? 'Write what the agent should say and ask.' : '',
        description: `Configure this ${meta.label.toLowerCase()} step.`,
        transition: 'When this step is complete',
        conditions: type === 'logicSplit' ? ['Yes', 'No'] : ['When this step is complete'],
      },
    };
    set({ nodes: [...get().nodes, node], selectedNodeId: id });
  },
  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },
  updateNode: (id, data) => {
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    });
  },
  updateSelectedNode: (data) => {
    const id = get().selectedNodeId;
    if (!id) return;
    get().updateNode(id, data);
  },
  getSelectedNode: () => get().nodes.find((n) => n.id === get().selectedNodeId),
}));
