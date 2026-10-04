import { useCallback, useEffect, useState } from 'react';

async function readApiResponse(response: Response): Promise<Record<string, any>> {
  const body = await response.text();
  if (!body.trim()) {
    if (!response.ok) throw new Error(`Server returned an empty response (${response.status}). Is the backend running?`);
    return {};
  }
  try {
    return JSON.parse(body);
  } catch {
    if (!response.ok) throw new Error(`Server error (${response.status}). Try again in a moment.`);
    throw new Error('The server returned an unreadable response. Check that the backend is running.');
  }
}
import { Archive, Bot, Clock3, Edit3, Link2, Loader2, PhoneCall, RotateCcw, Search } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useWorkflowStore } from '@/store/workflowStore';
import { agentPathFor } from '@/lib/agentRoute';

type SavedAgent = {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  language?: string;
  voice?: string;
  status?: string;
  published_version?: string;
};

export function AgentHistoryView() {
  const { setActiveView, setSelectedAgentId, updateAgentSettings, addToast } = useUiStore();
  const { loadWorkflow } = useWorkflowStore();
  const [agents, setAgents] = useState<SavedAgent[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agents');
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Saved agents could not be loaded.');
      setAgents(Array.isArray(data.agents) ? data.agents : []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backend unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

  const openAgent = async (agentId: string) => {
    setOpeningId(agentId);
    try {
      const [agentResponse, workflowResponse] = await Promise.all([
        fetch(`/api/agents/${agentId}`),
        fetch(`/api/agents/${agentId}/workflow`),
      ]);
      const agent = await readApiResponse(agentResponse);
      const workflow = await readApiResponse(workflowResponse);
      if (!agentResponse.ok || !workflowResponse.ok) throw new Error(agent.detail || workflow.detail || 'Agent could not be opened.');
      const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes || '[]') : workflow.nodes || [];
      const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges || '[]') : workflow.edges || [];
      loadWorkflow(nodes, edges);
      updateAgentSettings({
        name: agent.name,
        description: agent.description || '',
        greeting: agent.greeting || '',
        systemPrompt: agent.system_prompt || '',
        voice: agent.voice || '',
        language: agent.language === 'en-US' ? 'English (US)' : agent.language || 'English (US)',
        temperature: agent.temperature ?? 0.4,
        maxCallDuration: agent.max_duration_minutes ?? 12,
      });
      setSelectedAgentId(agentId);
      setActiveView('agent');
    } catch (cause) {
      addToast({ title: 'Agent could not be opened', description: cause instanceof Error ? cause.message : 'Backend unavailable.', type: 'error' });
    } finally {
      setOpeningId(null);
    }
  };

  const copyAgentLink = async (agent: SavedAgent) => {
    const url = new URL(agentPathFor(agent.name, agent.id), window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      addToast({ title: 'Agent link copied', description: url, type: 'success' });
    } catch {
      addToast({ title: 'Could not copy agent link', description: 'Open the agent to see its address in the browser bar.', type: 'error' });
    }
  };

  const changeArchiveState = async (agent: SavedAgent) => {
    const archived = agent.status === 'archived';
    try {
      const response = await fetch(`/api/agents/${agent.id}/${archived ? 'restore' : 'archive'}`, { method: 'POST' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Agent state could not be updated.');
      await loadAgents();
      addToast({ title: archived ? 'Agent restored' : 'Agent archived', type: 'success' });
    } catch (cause) {
      addToast({ title: 'Agent could not be updated', description: cause instanceof Error ? cause.message : 'Backend unavailable.', type: 'error' });
    }
  };

  const visible = agents.filter((agent) => `${agent.name} ${agent.description || ''}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--retell-bg)]">
      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">Workspace library</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Saved agents</h2>
            <p className="mt-1 text-sm text-slate-500">Reopen an agent to edit its voice settings and call flow. Changes save automatically.</p>
          </div>
          <div className="text-xs font-medium text-slate-500">{agents.length} saved</div>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <Search size={15} className="text-slate-400" />
          <input aria-label="Search saved agents" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search by agent name or purpose" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="divide-y divide-slate-100" aria-label="Loading saved agents">
              {[0, 1, 2].map((item) => <div key={item} className="flex items-center gap-4 px-5 py-5"><div className="size-10 animate-pulse rounded-lg bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" /><div className="h-2.5 w-2/3 animate-pulse rounded bg-slate-50" /></div><div className="h-8 w-24 animate-pulse rounded-md bg-slate-100" /></div>)}
            </div>
          ) : error ? (
            <div role="alert" className="px-6 py-12 text-center text-sm text-rose-700">{error}</div>
          ) : visible.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Bot size={24} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-800">{query ? 'No agents match that search.' : 'No saved agents yet.'}</p>
              <p className="mt-1 text-xs text-slate-500">Create an agent with Conductor and it will appear here.</p>
              {!query && <button onClick={() => setActiveView('home')} className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black">Create an agent</button>}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((agent) => (
                <li key={agent.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-50/70">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Bot size={19} /></div>
                  <div className="min-w-[180px] flex-1">
                    <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{agent.description || 'Voice agent'}</p>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${agent.status === 'published' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : agent.status === 'archived' ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>{agent.status || 'draft'}{agent.published_version ? ` · ${agent.published_version}` : ''}</span>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Clock3 size={11} />Created {agent.created_at ? new Date(agent.created_at).toLocaleString() : 'date unavailable'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void copyAgentLink(agent)} aria-label={`Copy link for ${agent.name}`} title="Copy direct agent link" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 hover:bg-slate-50"><Link2 size={14} /></button>
                    <button onClick={() => void openAgent(agent.id)} disabled={openingId === agent.id} className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                      {openingId === agent.id ? <Loader2 size={13} className="animate-spin" /> : <Edit3 size={13} />}Edit agent
                    </button>
                    <button onClick={() => { setSelectedAgentId(agent.id); setActiveView('calls'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><PhoneCall size={13} />Calls</button>
                    <button onClick={() => void changeArchiveState(agent)} aria-label={agent.status === 'archived' ? `Restore ${agent.name}` : `Archive ${agent.name}`} title={agent.status === 'archived' ? 'Restore agent' : 'Archive agent'} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 hover:bg-slate-50">{agent.status === 'archived' ? <RotateCcw size={14} /> : <Archive size={14} />}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
