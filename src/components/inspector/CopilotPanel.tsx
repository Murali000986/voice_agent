import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, ArrowUp, RefreshCcw, Bot,
  Check, Undo2, Loader2, Globe, Wrench,
  MessageSquare, Layers, Zap, ChevronRight
} from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useWorkflowStore } from '@/store/workflowStore';
import { WebsiteBuildProgress } from '@/components/ui/WebsiteBuildProgress';

// Map of aiActionState keywords → icon component + label
const ACTION_ICONS: Record<string, { icon: React.ElementType; label: string }> = {
  'Analyzing website':      { icon: Globe,        label: 'Scanning website…' },
  'Research complete':      { icon: Zap,          label: 'Research complete' },
  'Finalizing agent':       { icon: Bot,          label: 'Finalizing profile…' },
  'Designing node':         { icon: Layers,       label: 'Designing workflow…' },
  'Analyzing inputs':       { icon: MessageSquare,label: 'Thinking…' },
};

function getActionMeta(state: string | null) {
  if (!state) return { icon: Loader2, label: 'Thinking…' };
  for (const key of Object.keys(ACTION_ICONS)) {
    if (state.startsWith(key)) return ACTION_ICONS[key];
  }
  return { icon: Wrench, label: state };
}

const SUGGESTIONS = [
  { icon: MessageSquare, label: 'Review this agent' },
  { icon: Zap,           label: 'Improve using failures' },
  { icon: Layers,        label: 'Build a new agent for my business' },
  { icon: Wrench,        label: 'Delete the last node' },
];

export function CopilotPanel() {
  const {
    copilotMessages, copilotLoading, sendCopilotMessage,
    resetCopilot, pendingWorkflow, clearPendingWorkflow, aiActionState, aiProgress, researchWebsiteUrl
  } = useUiStore();
  const { replaceWorkflow, undoReplace, previousWorkflow } = useWorkflowStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages, copilotLoading]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || copilotLoading) return;
    sendCopilotMessage(value);
    setInput('');
  };

  const handleApply = () => {
    if (!pendingWorkflow) return;
    replaceWorkflow(pendingWorkflow.nodes, pendingWorkflow.edges);
    clearPendingWorkflow();
  };

  const { icon: ActionIcon, label: actionLabel } = getActionMeta(aiActionState);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
            <Sparkles size={13} />
          </span>
          <div>
            <h2 className="font-semibold text-[13px] text-gray-900 leading-tight">Conductor</h2>
            <p className="text-[10px] text-gray-400 font-medium tracking-wide">⌘K to toggle</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="Start new chat" onClick={resetCopilot} title="New chat" className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700">
            <RefreshCcw size={13} />
          </button>
        </div>
      </div>

      {/* Chat body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {copilotMessages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <div className="w-14 h-14 mb-4 rounded-2xl bg-gray-900 flex items-center justify-center shadow-md">
              <Bot size={26} className="text-white" />
            </div>
            <h3 className="font-bold text-[15px] text-gray-900 mb-1">How can I help?</h3>
            <p className="text-[12px] text-gray-400 mb-6 max-w-[200px]">
              Chat, build a new agent, or edit the workflow — just type it.
            </p>
            <div className="w-full space-y-2">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest text-left mb-2">Suggestions</p>
              {SUGGESTIONS.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => send(label)}
                  className="w-full text-left px-3 py-2.5 text-[12px] text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-400 flex items-center gap-2.5 font-medium transition-all group"
                >
                  <Icon size={13} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={11} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {copilotMessages.map((m) => (
              <div key={m.id} className="flex flex-col">
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-5 h-5 rounded-md bg-gray-900 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                      <Bot size={10} className="text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-gray-900 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm border border-gray-200'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>

                {/* Discovery suggestion chips — monochromatic */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pl-7">
                    {m.suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => send(s)}
                        className="px-2.5 py-1 text-[11px] bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all font-medium"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Pending Workflow Draft card */}
            {pendingWorkflow && (
              <div className="border-2 border-dashed border-gray-300 bg-gray-50 p-4 rounded-xl flex flex-col gap-3">
                <p className="text-[12px] font-semibold text-gray-800 flex items-center gap-2">
                  <Layers size={13} className="text-gray-600" />
                  Workflow Draft Ready — {pendingWorkflow.nodes?.length} nodes
                </p>
                <div className="flex gap-2">
                  <button onClick={handleApply} className="bg-gray-900 text-white flex-1 py-2 text-[12px] font-medium rounded-lg hover:bg-black flex items-center justify-center gap-1.5 transition-colors">
                    <Check size={13} /> Apply to Canvas
                  </button>
                  <button onClick={clearPendingWorkflow} className="bg-white border border-gray-300 text-gray-600 flex-1 py-2 text-[12px] font-medium rounded-lg hover:bg-gray-100 transition-colors">
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Undo Banner */}
            {previousWorkflow && !pendingWorkflow && (
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex items-center gap-2">
                <Layers size={12} className="text-gray-500 shrink-0" />
                <p className="text-[11px] text-gray-600 flex-1">Workflow was replaced</p>
                <button onClick={undoReplace} className="text-[11px] font-semibold text-gray-900 hover:underline flex items-center gap-1">
                  <Undo2 size={11} /> Undo
                </button>
              </div>
            )}

            {/* Loading Banner with dynamic action state */}
            {copilotLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5 pl-7">
                  {aiActionState ? <WebsiteBuildProgress phase={aiActionState} progress={aiProgress} websiteUrl={researchWebsiteUrl} /> : <div className="bg-gray-100 border border-gray-200 rounded-2xl px-3.5 py-2.5 flex items-center gap-2 shadow-sm"><ActionIcon size={13} className="text-gray-600 animate-spin" style={{ animationDuration: ActionIcon === Loader2 ? '1s' : '2s' }} /><span className="text-[12px] font-medium text-gray-700">{actionLabel}</span></div>}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-3 shrink-0">
        <div className="relative flex flex-col border border-gray-200 rounded-2xl bg-white focus-within:border-gray-900 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all shadow-sm">
          <textarea
            placeholder="Chat, build a new agent, or edit the workflow…"
            className="w-full bg-transparent px-3.5 py-3 text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none resize-none min-h-[60px]"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <div className="flex items-center justify-between px-2.5 pb-2">
            <div className="flex items-center gap-1">
              <span className="py-1 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg flex items-center gap-1 px-2 ml-1 text-[10px] font-bold tracking-wide">
                AI
              </span>
            </div>
            <button
              aria-label="Send message to Conductor"
              onClick={() => send(input)}
              disabled={copilotLoading}
              className={`p-[7px] rounded-lg transition-all duration-150 ${
                input.trim() && !copilotLoading
                  ? 'bg-gray-900 text-white hover:bg-black shadow-sm hover:-translate-y-[1px]'
                  : 'text-gray-300 bg-gray-100'
              }`}
            >
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-2">Conductor understands build, edit, and chat requests</p>
      </div>
    </div>
  );
}
