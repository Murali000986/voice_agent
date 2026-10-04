import { Handle, Position } from '@xyflow/react';
import { MessageSquare, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '@/store/workflowStore';

export function ConversationNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const conditions: string[] = Array.isArray(data.conditions)
    ? data.conditions
    : data.transition
      ? [String(data.transition)]
      : [];

  return (
    <div
      className={cn(
        'min-w-[300px] max-w-[340px] overflow-hidden rounded-xl border bg-white transition-shadow duration-150',
        selected
          ? 'border-blue-500 shadow-md ring-2 ring-blue-100'
          : 'border-slate-200 shadow-sm hover:border-blue-300'
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <MessageSquare size={13} strokeWidth={2.5} />
          </span>
          <div className="truncate text-[13px] font-semibold text-slate-900">{data.label || 'Conversation'}</div>
        </div>
        <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Speak</span>
      </div>

      <div className="px-3.5 py-3 text-[12.5px] text-slate-600 leading-relaxed max-h-[132px] overflow-hidden">
        {data.prompt ? (
          <p className="line-clamp-5 whitespace-pre-wrap">{String(data.prompt)}</p>
        ) : (
          <p className="text-slate-400 italic">Ask about the caller’s business to understand their context…</p>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] font-semibold text-slate-600">Transition</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {conditions.map((c, i) => (
            <div key={i} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] leading-snug text-slate-600">
              {c}
            </div>
          ))}
          <button
            className="nodrag flex items-center gap-1 px-0.5 py-0.5 text-[11px] font-medium text-blue-700 hover:text-blue-800"
            onClick={(e) => {
              e.stopPropagation();
              updateNode(id, { conditions: [...conditions, 'New condition'] });
            }}
          >
            <Plus size={12} /> Add condition
          </button>
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-white !bg-blue-500" />
      <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-white !bg-blue-500" />
    </div>
  );
}
