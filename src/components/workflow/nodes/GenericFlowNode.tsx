import { Handle, Position } from '@xyflow/react';
import {
  GitBranch,
  Plus,
  MessageSquare,
  Bot,
  Code,
  Headphones,
  Hash,
  ArrowRightLeft,
  MessageCircle,
  Braces,
  Code2,
  Blocks,
  Percent,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNodeMeta } from '@/data/nodeCatalog';
import { useWorkflowStore } from '@/store/workflowStore';

const iconMap: Record<string, typeof GitBranch> = {
  conversation: MessageSquare,
  subagent: Bot,
  function: Code,
  callTransfer: Headphones,
  pressDigit: Hash,
  logicSplit: GitBranch,
  agentTransfer: ArrowRightLeft,
  inCallSms: MessageCircle,
  extractVariable: Braces,
  code: Code2,
  mcp: Blocks,
  ending: Percent,
  note: StickyNote,
};

export function GenericFlowNode({
  id,
  data,
  selected,
  type,
}: {
  id: string;
  data: any;
  selected?: boolean;
  type?: string;
}) {
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const meta = getNodeMeta(type ?? 'function');
  const isSplit = type === 'logicSplit';
  const isNote = type === 'note';
  const Icon = iconMap[type ?? 'function'] ?? GitBranch;
  const conditions: string[] = Array.isArray(data.conditions) ? data.conditions : [];

  if (isNote) {
    return (
      <div
        className={cn(
          'min-w-[220px] max-w-[280px] rounded-xl border bg-amber-50 px-4 py-3 shadow-sm',
          selected ? 'border-amber-400 ring-4 ring-amber-100' : 'border-amber-200'
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">Note</p>
        <p className="text-[13px] text-amber-950 leading-relaxed">{data.label || data.description}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-[18px] border min-w-[268px] max-w-[300px] overflow-hidden transition-shadow',
        selected ? 'shadow-[0_12px_36px_-16px_rgba(15,23,42,0.45)] ring-4 ring-black/5' : 'shadow-sm hover:shadow-md',
        meta.border
      )}
      style={selected ? { borderColor: meta.accent } : undefined}
    >
      <div className={cn('px-3.5 py-2.5 border-b border-black/5 flex items-center justify-between', meta.header)}>
        <div className={cn('flex items-center gap-2 font-semibold text-[13px] min-w-0', meta.color)}>
          <span className={cn('h-6 w-6 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
            <Icon size={13} strokeWidth={2.5} />
          </span>
          <span className="truncate">{data.label || meta.label}</span>
        </div>
        <span className="text-[10px] font-medium text-slate-400 shrink-0 ml-2">{meta.label}</span>
      </div>
      <div className="px-3.5 py-3 text-[12.5px] text-slate-600 leading-relaxed line-clamp-3">
        {data.description || data.prompt || `Configure ${meta.label.toLowerCase()} behavior.`}
      </div>
      {isSplit ? (
        <div className="px-3.5 pb-3 flex gap-2">
          <span className="flex-1 text-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg py-1.5">Yes</span>
          <span className="flex-1 text-center text-[11px] font-semibold text-rose-700 bg-rose-50 rounded-lg py-1.5">No</span>
        </div>
      ) : (
        <div className="px-3.5 pb-3 space-y-1.5">
          {conditions.map((c, i) => (
            <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
              {c}
            </div>
          ))}
          <button
            className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 nodrag"
            onClick={(e) => {
              e.stopPropagation();
              updateNode(id, { conditions: [...conditions, 'New condition'] });
            }}
          >
            <Plus size={12} /> Add condition
          </button>
        </div>
      )}
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white" />
      {isSplit ? (
        <>
          <Handle type="source" id="yes" position={Position.Right} style={{ top: '38%' }} className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-white" />
          <Handle type="source" id="no" position={Position.Right} style={{ top: '62%' }} className="!w-2.5 !h-2.5 !bg-rose-500 !border-2 !border-white" />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white" />
      )}
    </div>
  );
}
