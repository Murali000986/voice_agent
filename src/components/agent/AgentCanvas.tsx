import { ReactFlow, Background, BackgroundVariant, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { agentEdges, agentNodes } from '@/data/agentWorkflow';
import { ActionNode, AgentCenterNode, ExtractionNode, FloatingAddNode, TriggerNode } from './CustomAgentNodes';
import { useUiStore } from '@/store/uiStore';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  agentCenter: AgentCenterNode,
  floatingAdd: FloatingAddNode,
  extraction: ExtractionNode,
};

export function AgentCanvas() {
  const lastSaved = useUiStore((s) => s.lastSaved);

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-slate-500 font-medium text-xs px-4 py-1.5 bg-white/85 backdrop-blur rounded-full border border-slate-200 shadow-sm">
        Auto saved {lastSaved}
      </div>
      <ReactFlow
        defaultNodes={agentNodes}
        defaultEdges={agentEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        className="bg-[#fcfcfd]"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!mb-4 !ml-4 !bg-white !border-gray-200 !rounded-xl overflow-hidden" />
      </ReactFlow>
    </div>
  );
}
