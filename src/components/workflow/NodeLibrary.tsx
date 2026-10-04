import { useMemo, useState, type DragEvent } from 'react';
import {
  MessageSquare,
  Bot,
  Code,
  Headphones,
  Hash,
  GitBranch,
  ArrowRightLeft,
  MessageCircle,
  Braces,
  Code2,
  Blocks,
  Percent,
  StickyNote,
  Search,
  Layers,
  PanelLeftClose,
} from 'lucide-react';
import { NODE_CATALOG } from '@/data/nodeCatalog';
import { useUiStore } from '@/store/uiStore';

const iconMap = {
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
} as const;

const hints: Record<string, string> = {
  conversation: 'Talk with the caller',
  subagent: 'Delegate to a specialist',
  function: 'Call an API or tool',
  callTransfer: 'Hand off to a number',
  pressDigit: 'Collect keypad input',
  logicSplit: 'Branch on a condition',
  agentTransfer: 'Route to another agent',
  inCallSms: 'Send a text mid-call',
  extractVariable: 'Capture a field',
  code: 'Run custom logic',
  mcp: 'Connect an MCP tool',
  ending: 'Hang up cleanly',
  note: 'Annotate the canvas',
};

const subflows = [
  { id: 'sf-1', name: 'Qualify inbound', nodes: 5 },
  { id: 'sf-2', name: 'Callback booking', nodes: 3 },
];

export function NodeLibrary() {
  const { libraryTab, setLibraryTab, addToast, setLibraryOpen } = useUiStore();
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => NODE_CATALOG.filter((n) => n.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-[240px] h-full panel-card flex flex-col pointer-events-auto overflow-hidden">
      <div className="flex items-center gap-1 px-2 pt-2 shrink-0">
        <div className="flex flex-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setLibraryTab('node')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              libraryTab === 'node' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Nodes
          </button>
          <button
            onClick={() => setLibraryTab('subflows')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              libraryTab === 'subflows' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Subflows
          </button>
        </div>
        <button
          onClick={() => setLibraryOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Hide library"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {libraryTab === 'node' ? (
        <>
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus-within:border-blue-300 focus-within:bg-white">
              <Search size={13} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search nodes"
                className="bg-transparent text-xs w-full outline-none text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {filtered.map((node) => {
              const Icon = iconMap[node.type];
              return (
                <div
                  key={node.type}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-slate-50 cursor-grab active:cursor-grabbing group"
                  draggable
                  onDragStart={(e) => onDragStart(e, node.type)}
                >
                  <div className={`h-8 w-8 rounded-xl ${node.bg} flex items-center justify-center ring-1 ring-black/5`}>
                    <Icon size={14} className={node.color} strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-800 leading-tight">{node.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">{hints[node.type]}</div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">No nodes match “{query}”</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
          <p className="text-[11px] text-slate-400 mb-3 px-1">Reusable slices of this conversation.</p>
          {subflows.map((sf) => (
            <button
              key={sf.id}
              className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl border border-slate-100 hover:bg-slate-50 mb-2 transition-colors"
            >
              <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers size={15} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-slate-800">{sf.name}</div>
                <div className="text-[11px] text-slate-400">{sf.nodes} nodes</div>
              </div>
            </button>
          ))}
          <button
            onClick={() => addToast({ title: 'Subflow created from selection', type: 'info' })}
            className="w-full mt-1 py-2 text-xs font-semibold rounded-xl border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
          >
            + New subflow
          </button>
        </div>
      )}
    </div>
  );
}
