import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  ArrowUp, Sparkles, Plus, Bot,
  MessageSquare, BarChart2, Users, Phone,
  Globe, Zap, ExternalLink, CheckCircle2,
  Loader2, ChevronRight, Trash2, RefreshCw,
  Layers, Check, Undo2, Wrench, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore, type ChatMessage } from '@/store/uiStore';
import { useWorkflowStore } from '@/store/workflowStore';
import { WebsiteBuildProgress } from '@/components/ui/WebsiteBuildProgress';
import { readApiResponse } from '@/lib/api';

// ── Suggested prompts ──────────────────────────────────────────────────────────
// ── Conversation list item type ────────────────────────────────────────────────
type ConvSummary = { id: string; title: string; ts: number; sessionId: string | null; stage?: string; messages: ChatMessage[] };
type DashboardOverview = { agents: number; calls: number; average_duration_seconds: number };

function conversationStageLabel(stage?: string) {
  if (stage === 'COMPLETED') return 'Agent ready';
  if (stage === 'CONFIRM_PROFILE') return 'Plan review';
  if (stage === 'GENERATE') return 'Building agent';
  if (stage === 'RESEARCH_WEBSITE') return 'Researching website';
  return 'Agent planning';
}

// ── Agent-created confirmation card ───────────────────────────────────────────
function AgentCreatedCard({
  agent,
  onOpenBuilder,
  onContinue,
}: {
  agent: { agentId: string; name: string; description: string };
  onOpenBuilder: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="mt-1 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
        <p className="font-bold text-[14px] text-gray-900">Agent created successfully!</p>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 shadow-sm">
        <p className="font-semibold text-[14px] text-gray-900 mb-0.5">{agent.name}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Draft</span>
        <p className="text-[12px] text-gray-500 leading-relaxed mt-2">{agent.description}</p>
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={onOpenBuilder}
          className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-black transition-colors"
        >
          <ExternalLink size={13} /> Open Agent
        </button>
        <button
          onClick={onContinue}
          className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-[13px] font-semibold hover:bg-gray-50 transition-colors"
        >
          <Sparkles size={13} /> Continue Editing
        </button>
      </div>
    </div>
  );
}

// ── Agent Plan Card ─────────────────────────────────────────────────────────────
function AgentPlanCard({
  plan,
  onApprove,
  onRevise,
}: {
  plan: any;
  onApprove: () => void;
  onRevise: (feedback: string) => void;
}) {
  const [revision, setRevision] = useState('');
  const [showRevision, setShowRevision] = useState(false);
  if (!plan) return null;
  const asLines = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
  };
  const outline = asLines(plan.workflow_outline);
  const criteria = asLines(plan.qualification_criteria);
  const scenarios = asLines(plan.test_scenarios);
  const assumptions = asLines(plan.assumptions);
  const integrations = asLines(plan.required_integrations);
  return (
    <section aria-labelledby="agent-plan-title" className="border border-slate-200 bg-white p-5 rounded-xl flex flex-col gap-4 mt-2 w-full max-w-xl shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
        <h3 id="agent-plan-title" className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-blue-500" />
          {plan.agent_name || 'Proposed Agent Plan'}
        </h3>
        <p className="text-[12px] text-slate-500 font-medium">Review what the agent will handle before building its call flow.</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PlanDetail label="Goal" value={plan.business_objective} icon={<Layers size={13} />} />
        <PlanDetail label="Audience" value={plan.target_audience} icon={<Users size={13} />} />
        <PlanDetail label="Call direction" value={plan.call_direction} icon={<Phone size={13} />} />
        <PlanDetail label="Qualification criteria" value={criteria.length ? criteria : plan.qualification_criteria} icon={<Check size={13} />} />
      </div>

      {outline.length > 0 && <PlanList title="Call flow" items={outline} />}
      {scenarios.length > 0 && <PlanList title="Test scenarios" items={scenarios} />}
      {assumptions.length > 0 && <PlanList title="Assumptions" items={assumptions} />}
      {integrations.length > 0 && <PlanList title="Integrations" items={integrations} />}

      <div className="flex gap-2 pt-2 mt-2 border-t border-slate-100">
        <button onClick={onApprove} className="bg-[var(--retell-primary)] hover:bg-[var(--retell-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 text-white flex-1 py-2 text-[12px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors">
          <Sparkles size={13} /> Approve and Build
        </button>
        <button onClick={() => setShowRevision((open) => !open)} className="bg-white border border-slate-200 text-slate-600 flex-1 py-2 text-[12px] font-bold rounded-lg hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors">
          Suggest changes
        </button>
      </div>
      {showRevision && (
        <form
          className="flex flex-col gap-2 border-t border-slate-100 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!revision.trim()) return;
            onRevise(revision.trim());
          }}
        >
          <label htmlFor="agent-plan-revision" className="text-[12px] font-medium text-slate-700">What should change?</label>
          <textarea
            id="agent-plan-revision"
            value={revision}
            onChange={(event) => setRevision(event.target.value)}
            placeholder="Add or change qualification criteria, call steps, or integrations…"
            className="ui-input min-h-20 resize-y text-[13px]"
          />
          <button type="submit" disabled={!revision.trim()} className="self-end rounded-lg bg-[var(--retell-primary)] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[var(--retell-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">
            Update plan
          </button>
        </form>
      )}
    </section>
  );
}

function PlanDetail({ label, value, icon }: { label: string; value: unknown; icon: ReactNode }) {
  const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : typeof value === 'string' ? value : '';
  if (!text) return null;
  return (
    <div className="min-w-0 flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
      <span className="mt-0.5 shrink-0 text-slate-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-[13px] leading-snug text-slate-800">{text}</p>
      </div>
    </div>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ol className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[12px] leading-snug text-slate-700">
            <span className="shrink-0 font-semibold text-slate-400">{String(index + 1).padStart(2, '0')}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onSend,
  onOpenBuilder,
  pendingWorkflow,
  onApplyDraft,
  onDiscardDraft,
  prevWorkflow,
  onUndo,
  isLast,
}: {
  msg: ReturnType<typeof useUiStore.getState>['copilotMessages'][0];
  onSend: (t: string) => void;
  onOpenBuilder: (agentId: string) => void;
  pendingWorkflow: { nodes: unknown[]; edges: unknown[] } | null;
  onApplyDraft: () => void;
  onDiscardDraft: () => void;
  prevWorkflow: unknown;
  onUndo: () => void;
  isLast: boolean;
}) {
  const isUser = msg.role === 'user';
  const [localInput, setLocalInput] = useState('');
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1 w-full`}>
      {!isUser && (
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-6 h-6 rounded-md bg-transparent flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-blue-600" />
          </div>
          <span className="text-[12px] font-medium text-slate-500">Conductor</span>
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-[#f2f4f7] text-[#14151a] self-end rounded-br-sm"
            : "bg-transparent text-[#14151a] p-0 max-w-full"
        )}
      >
        {msg.content}
      </div>

      {/* Suggestion chips */}
      {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
        <div className="flex flex-col gap-3 mt-3 w-full">
          <div className="flex flex-wrap gap-2 pl-0">
            {msg.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSend(s)}
                className="px-3 py-1.5 text-[13px] bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all font-medium whitespace-nowrap text-left shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>

          {isLast && (
            <div className="flex items-center gap-2 pr-2">
              <input
                type="text"
                placeholder="Type your own answer..."
                value={localInput}
                onChange={e => setLocalInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && localInput.trim()) {
                    onSend(localInput);
                    setLocalInput('');
                  }
                }}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 shadow-sm transition-all"
              />
              <button
                onClick={() => {
                  if (localInput.trim()) {
                    onSend(localInput);
                    setLocalInput('');
                  }
                }}
                disabled={!localInput.trim()}
                className="bg-[#14151a] text-white px-4 py-2 rounded-xl text-[13px] font-medium hover:bg-black disabled:opacity-50 transition-all whitespace-nowrap shadow-sm"
              >
                Continue <ChevronRight size={14} className="inline ml-0.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Agent Plan preview — only show on the last assistant message if plan exists */}
      {!isUser && msg.agentPlan && isLast && !msg.agentCreated && (
        <AgentPlanCard
          plan={msg.agentPlan}
          onApprove={() => onSend('__AUTO_GENERATE__')}
          onRevise={(feedback) => onSend(`Please revise the plan based on this feedback: ${feedback}`)}
        />
      )}

      {/* Agent created card */}
      {!isUser && msg.agentCreated && (
        <AgentCreatedCard
          agent={msg.agentCreated}
          onOpenBuilder={() => onOpenBuilder(msg.agentCreated!.agentId)}
          onContinue={() => onSend('Continue editing the agent')}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function HomeChatPage() {
  const {
    copilotMessages,
    copilotLoading,
    aiActionState,
    aiProgress,
    researchWebsiteUrl,
    sendCopilotMessage,
    resetCopilot,
    restoreCopilot,
    pendingWorkflow,
    clearPendingWorkflow,
    setActiveView,
    sessionId,
    updateAgentSettings,
    setSelectedAgentId,
    conductorStage,
  } = useUiStore();
  const { replaceWorkflow, loadWorkflow, undoReplace, previousWorkflow } = useWorkflowStore();

  const [input, setInput] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [conversations, setConversations] = useState<ConvSummary[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('bask-voice-conversations') || '[]');
      // Older builds wrote placeholder sessions before the first message existed.
      // Keep only real conversations so they do not appear as blank history rows.
      return Array.isArray(saved) ? saved.filter((item) => Array.isArray(item?.messages) && item.messages.length > 0) : [];
    } catch { return []; }
  });
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoOpenedAgentId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard/overview')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Dashboard overview unavailable')))
      .then((data) => { if (active) setOverview(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/conductor/sessions?limit=30')
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Conversation history unavailable');
        return data;
      })
      .then((data) => {
        if (!active || !Array.isArray(data.sessions)) return;
        setConversations((local) => {
          const bySession = new Map(local.filter((item) => item.sessionId).map((item) => [item.sessionId!, item]));
          const saved: ConvSummary[] = data.sessions.map((item: ConvSummary) => {
            const older = bySession.get(item.sessionId || item.id);
            return { ...item, messages: item.messages?.length ? item.messages : older?.messages || [] };
          });
          const savedIds = new Set(saved.map((item) => item.sessionId || item.id));
          const olderLocal = local.filter((item) => item.messages?.length > 0 && (!item.sessionId || !savedIds.has(item.sessionId)));
          return [...saved, ...olderLocal].sort((a, b) => b.ts - a.ts).slice(0, 30);
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [input]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages, copilotLoading]);

  // ── Save conversation history in this browser ──
  useEffect(() => {
    if (!copilotMessages.length) return;
    const firstUserMessage = copilotMessages.find((message) => message.role === 'user');
    if (!firstUserMessage) return;
    const id = activeConvId || `local-${firstUserMessage.id}`;
    const title = firstUserMessage.content.slice(0, 52) + (firstUserMessage.content.length > 52 ? '…' : '');
    if (!activeConvId) setActiveConvId(id);
    setConversations((previous) => {
      const existing = previous.find((conversation) => conversation.id === id);
      const entry: ConvSummary = {
        id,
        title,
        ts: existing?.ts || Date.now(),
        sessionId: sessionId || existing?.sessionId || null,
        stage: conductorStage,
        messages: copilotMessages,
      };
      return [entry, ...previous.filter((conversation) => conversation.id !== id)].slice(0, 30);
    });
  }, [copilotMessages, sessionId, activeConvId, conductorStage]);

  useEffect(() => {
    try { window.localStorage.setItem('bask-voice-conversations', JSON.stringify(conversations)); } catch { /* Local history is optional when storage is unavailable. */ }
  }, [conversations]);

  const send = (text: string) => {
    const v = text.trim();
    if (!v || copilotLoading) return;
    sendCopilotMessage(v);
    setInput('');
  };

  const startNewChat = () => {
    resetCopilot();
    setActiveConvId(null);
    setInput('');
  };

  const openConversation = (conversation: ConvSummary) => {
    setActiveConvId(conversation.id);
    autoOpenedAgentId.current = [...(conversation.messages || [])].reverse().find((message) => message.agentCreated?.agentId)?.agentCreated?.agentId || null;
    restoreCopilot(conversation.messages || [], conversation.sessionId || null, conversation.stage);
    setInput('');
  };

  const filteredConversations = conversations.filter((conversation) => conversation.messages?.length > 0 && conversation.title.toLowerCase().includes(historyQuery.toLowerCase()));

  const openInBuilder = async (agentId: string) => {
    setSelectedAgentId(null);
    try {
      const [agentResponse, workflowResponse] = await Promise.all([
        fetch(`/api/agents/${agentId}`),
        fetch(`/api/agents/${agentId}/workflow`),
      ]);
      if (!agentResponse.ok || !workflowResponse.ok) throw new Error('Could not load this agent.');
      const agent = await readApiResponse(agentResponse);
      const workflow = await readApiResponse(workflowResponse);
      if (workflow.nodes) {
        const nodes = JSON.parse(workflow.nodes);
        const edges = JSON.parse(workflow.edges);
        loadWorkflow(nodes, edges);
      }
      updateAgentSettings({
        name: agent.name,
        description: agent.description || '',
        greeting: agent.greeting,
        systemPrompt: agent.system_prompt,
        voice: agent.voice,
        language: agent.language === 'en-US' ? 'English (US)' : agent.language,
        temperature: agent.temperature,
      });
      setSelectedAgentId(agentId);
    } catch (error) {
      useUiStore.getState().addToast({
        title: 'Agent could not be loaded',
        description: error instanceof Error ? error.message : 'Backend unavailable.',
        type: 'error',
      });
    }
    // Switch this tab to agent view without opening a new tab
    setActiveView('agent');
  };

  useEffect(() => {
    const created = [...copilotMessages].reverse().find((message) => message.agentCreated?.agentId);
    const agentId = created?.agentCreated?.agentId;
    if (!agentId || autoOpenedAgentId.current === agentId) return;
    autoOpenedAgentId.current = agentId;
    void openInBuilder(agentId);
  }, [copilotMessages]);

  const handleApplyDraft = () => {
    if (!pendingWorkflow) return;
    replaceWorkflow(pendingWorkflow.nodes as Parameters<typeof replaceWorkflow>[0], pendingWorkflow.edges as Parameters<typeof replaceWorkflow>[1]);
    clearPendingWorkflow();
  };

  const isEmpty = copilotMessages.length === 0;

  return (
    <div className="flex flex-1 h-full bg-[#fcfcfd]">
      
      {/* ── Middle Pane: Conductor History ── */}
      <aside className="hidden h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white md:flex">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 shrink-0">
          <Sparkles size={16} className="text-slate-800" />
          <span className="font-semibold text-[15px] text-slate-800 tracking-tight">Conversations</span>
        </div>

        {/* Search & New Chat */}
        <div className="px-4 pb-4 flex flex-col gap-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search conversations" 
              className="w-full pl-9 pr-4 py-2 border border-[#e8eaed] rounded-xl text-[13px] focus:outline-none focus:border-slate-300 placeholder:text-slate-400"
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
            />
          </div>
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#e8eaed] text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm font-semibold text-[13px]"
          >
            <Plus size={14} /> New chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
          {filteredConversations.map(c => (
            <button
              key={c.id}
              onClick={() => openConversation(c)}
              className={cn(
                "w-full flex flex-col text-left px-3 py-2.5 rounded-lg transition-colors group",
                activeConvId === c.id ? "bg-[#f2f4f7]" : "hover:bg-slate-50"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className={cn("text-[13px] font-medium truncate", activeConvId === c.id ? "text-slate-900" : "text-slate-600")}>
                  {c.title || "New Voice Agent..."}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0">{new Date(c.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Bot size={10} /> {conversationStageLabel(c.stage)}
                </div>
              </div>
            </button>
          ))}
          
          {filteredConversations.length === 0 && <p className="px-3 py-4 text-xs leading-relaxed text-slate-400">{historyQuery ? 'No conversations match your search.' : 'Your recent agent planning chats will appear here.'}</p>}
        </div>
      </aside>

      {/* ── Main content (Conductor Chat) ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
        <div className="px-6 py-4 flex items-center gap-2 shrink-0">
          <Sparkles size={16} className="text-blue-600" />
          <span className="font-bold text-slate-800">Bask Voice Studio</span>
        </div>

        {isEmpty ? (
          <div className="flex-1 overflow-y-auto px-8 lg:px-10 py-8 flex flex-col items-center">
            <div className="w-full max-w-4xl flex flex-col gap-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase text-blue-700">Workspace overview</p>
                  <h1 className="text-balance text-2xl font-semibold text-slate-900">Build voice agents for any business</h1>
                  <p className="mt-1 max-w-xl text-pretty text-sm text-slate-500">Create, test, and manage client-ready voice agents from your Bask workspace.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Agents', value: overview?.agents ?? '—', note: 'Saved in this workspace', icon: Bot },
                  { label: 'Test and phone calls', value: overview?.calls ?? '—', note: 'Completed call sessions', icon: Phone },
                  { label: 'Average call length', value: overview ? `${Math.floor(overview.average_duration_seconds / 60)}m ${String(overview.average_duration_seconds % 60).padStart(2, '0')}s` : '—', note: 'Across saved calls', icon: BarChart2 },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{metric.label}</span><metric.icon size={15} className="text-slate-400" /></div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{metric.value}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{metric.note}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveView('agent')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Open agent builder</button>
                <button onClick={() => setActiveView('simulation')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Test scenarios</button>
                <button onClick={() => setActiveView('calls')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">View call history</button>
              </div>

              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Create or improve an agent</h2>
                <p className="mb-3 text-xs text-slate-500">Paste any public business website or describe what you need the agent to do.</p>
              <div className="w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors focus-within:border-blue-400">
                <textarea
                  ref={textareaRef}
                  placeholder="Paste a website or describe your agent…"
                  className="w-full bg-transparent px-2 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none"
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
                  }}
                />
                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Globe size={13} /> Website research supported</span>
                  </div>
                  <button
                    aria-label="Send message to Conductor"
                    onClick={() => send(input)}
                    disabled={!input.trim() || copilotLoading}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      input.trim() && !copilotLoading ? "text-slate-800 hover:bg-slate-100" : "text-slate-300"
                    )}
                  >
                    <ArrowUp size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Threaded messages */}
            <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-6 pt-6 sm:px-8 lg:px-10">
              <div className="w-full max-w-3xl flex flex-col gap-6">
                {copilotMessages.map((msg, idx) => {
                  const isLast = idx === copilotMessages.length - 1;
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      onSend={send}
                      onOpenBuilder={openInBuilder}
                      pendingWorkflow={isLast && !msg.agentCreated ? pendingWorkflow : null}
                      onApplyDraft={handleApplyDraft}
                      onDiscardDraft={clearPendingWorkflow}
                      prevWorkflow={previousWorkflow}
                      onUndo={undoReplace}
                      isLast={isLast}
                    />
                  );
                })}

                {/* Loading indicator */}
                {copilotLoading && (
                  <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 mt-1">
                      <Sparkles size={16} className="text-blue-600" />
                    </div>
                    <div className="flex w-full items-center gap-3">
                      {aiActionState ? <WebsiteBuildProgress phase={aiActionState} progress={aiProgress} websiteUrl={researchWebsiteUrl} /> : <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                      </div>}
                    </div>
                  </div>
                )}
                
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Bottom Input Field */}
            <div className="flex shrink-0 flex-col items-center border-t border-slate-200 bg-white px-4 pb-6 pt-2 sm:px-8 lg:px-10">
              <div className="w-full max-w-3xl">
                <div className="w-full border border-[#e8eaed] rounded-2xl bg-white shadow-sm focus-within:border-slate-300 transition-all p-3">
                  <textarea
                    ref={textareaRef}
                    placeholder="Reply to Conductor or paste another business website..."
                    className="w-full bg-transparent px-2 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none"
                    rows={1}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
                    }}
                  />
                  <div className="flex items-center justify-between mt-2 px-1">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Sparkles size={13} /> Ask for changes or paste another business website</span>
                    </div>
                    <button
                      aria-label="Send message to Conductor"
                      onClick={() => send(input)}
                      disabled={!input.trim() || copilotLoading}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        input.trim() && !copilotLoading ? "text-slate-800 hover:bg-slate-100" : "text-slate-300"
                      )}
                    >
                      <ArrowUp size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
