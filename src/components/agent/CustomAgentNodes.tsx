import { Handle, Position } from '@xyflow/react';
import { Settings, ShieldAlert, Bot, Plus } from 'lucide-react';

export function TriggerNode() {
  return (
    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm px-2">
      <span className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
        <ShieldAlert size={15} />
      </span>
      Dial in/out
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
}

export function ActionNode({ data }: any) {
  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm min-w-[280px] overflow-hidden ${data.colorClass || 'border-red-200'}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-slate-300" />
      <div className={`px-4 py-3 border-b flex items-center justify-between ${data.headerBg || 'border-red-50 bg-red-50/10'}`}>
        <div className={`flex items-center gap-2 ${data.textClass || 'text-red-700'}`}>
          <data.icon size={16} strokeWidth={2.5} />
          <span className="font-semibold text-sm">{data.label}</span>
        </div>
        <div className="text-slate-400 rotate-90 scale-75">⋯</div>
      </div>
      <div className="p-4 text-[13px] text-slate-600 leading-relaxed">
        {data.description}
        <button className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50">
          <Plus size={14} /> Add
        </button>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-slate-300" />
    </div>
  );
}

export function AgentCenterNode() {
  return (
    <div className="bg-[#FCFBE5] border-2 border-[#E5E3B8] rounded-[24px] px-8 py-3 shadow-md flex items-center justify-center gap-2 text-[#9A8B28] font-bold">
      <Handle type="target" position={Position.Left} className="w-2 h-2 opacity-50" />
      <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 opacity-50" />
      <Handle type="target" position={Position.Bottom} id="bot" className="w-2 h-2 opacity-50" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-slate-300" />
      <Bot size={18} />
      Agent
    </div>
  );
}

export function FloatingAddNode({ data }: any) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-medium text-slate-600">
      <data.icon size={16} className="text-slate-400" />
      {data.label}
      <Handle type="source" position={data.position || Position.Bottom} className="opacity-0" />
    </div>
  );
}

export function ExtractionNode({ data }: any) {
  const fields = [
    'Call Summary',
    'Call Successful',
    'User Sentiment',
    'business_industry',
    'website_url',
    'current_marketing_channels',
    'current_marketing_spend',
    'growth_goal',
    'budget_range',
    'timeline',
    'recommended_services',
  ];

  return (
    <div className="bg-white border-2 border-emerald-200 rounded-2xl shadow-sm min-w-[280px] overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-slate-300" />
      <div className="px-4 py-3 border-b flex items-center justify-between border-emerald-50 bg-emerald-50/30">
        <div className="flex items-center gap-2 text-emerald-700">
          <Settings size={16} strokeWidth={2.5} />
          <span className="font-semibold text-sm">{data?.label ?? 'Post Call Extraction'}</span>
        </div>
      </div>
      <div className="p-3 bg-white flex flex-col gap-2">
        {fields.map((field, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-2 border border-slate-100 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <span className="text-slate-400 font-serif mr-1">T</span>
            {field}
          </div>
        ))}
        <div className="flex items-center justify-between mt-1 px-1">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50">
            <Plus size={14} /> Add
          </button>
          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <Bot size={10} /> GPT-4.1
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-slate-300" />
    </div>
  );
}
