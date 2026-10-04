import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Play, MoreHorizontal, Share2, MessageSquare, ChevronDown, Sparkles, PanelRight, PanelLeft, Check, History, RotateCcw, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/store/uiStore';
import { useWorkflowStore } from '@/store/workflowStore';
import { Modal } from '@/components/ui/modal';
import { readApiResponse } from '@/lib/api';

type WorkflowRevision = { id: string; created_at: string; label: string; node_count: number; edge_count: number };

function Menu({
  open,
  onClose,
  children,
  align = 'left',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute top-full mt-1.5 min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 animate-modal-in ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {children}
    </div>
  );
}

const envTone: Record<string, string> = {
  Development: 'bg-amber-400',
  Staging: 'bg-sky-500',
  Production: 'bg-emerald-500',
};

export function TopToolbar() {
  const {
    copilotOpen,
    toggleCopilot,
    agentSettings,
    environment,
    setEnvironment,
    version,
    setVersion,
    setTestCallOpen,
    setPublishOpen,
    setFeedbackOpen,
    setShareOpen,
    addToast,
    lastSaved,
    inspectorOpen,
    setInspectorOpen,
    libraryOpen,
    setLibraryOpen,
    activeView,
    selectedAgentId,
    setSelectedAgentId,
    updateAgentSettings,
    setActiveView,
  } = useUiStore();

  const [envOpen, setEnvOpen] = useState(false);
  const [verOpen, setVerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<WorkflowRevision[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCopilot();
      }
      if (meta && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        setTestCallOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTestCallOpen, toggleCopilot]);

  const showInspectorToggle = activeView === 'agent' || activeView === 'workflow';
  const viewTitle: Record<string, string> = {
    home: 'Bask Voice Studio',
    agents: 'Saved agents',
    agent: agentSettings.name,
    workflow: `${agentSettings.name} · Call flow`,
    simulation: 'Test scenarios',
    calls: 'Call history',
    settings: 'Workspace settings',
  };

  const duplicateAgent = async () => {
    const { nodes, edges } = useWorkflowStore.getState();
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${agentSettings.name} copy`,
          description: agentSettings.description,
          greeting: agentSettings.greeting,
          system_prompt: agentSettings.systemPrompt,
          voice: agentSettings.voice,
          language: agentSettings.language.toLowerCase().includes('english') ? 'en-US' : agentSettings.language,
          temperature: agentSettings.temperature,
          max_duration_minutes: agentSettings.maxCallDuration,
          workflow_nodes: JSON.stringify(nodes),
          workflow_edges: JSON.stringify(edges),
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Could not duplicate this agent.');
      setSelectedAgentId(data.id);
      updateAgentSettings({ name: data.name });
      setActiveView('agent');
      addToast({ title: 'Agent duplicated', description: 'The copy is saved as a separate draft.', type: 'success' });
    } catch (error) {
      addToast({ title: 'Agent could not be duplicated', description: error instanceof Error ? error.message : 'Backend unavailable.', type: 'error' });
    }
  };

  const exportAgent = () => {
    const { nodes, edges } = useWorkflowStore.getState();
    const json = JSON.stringify({ agent: agentSettings, workflow: { nodes, edges } }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
      link.download = `${agentSettings.name.trim().replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'voice-agent'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({ title: 'Agent configuration exported', description: 'The JSON file includes the current settings and workflow.', type: 'success' });
  };

  const validateWorkflow = async () => {
    const { nodes, edges } = useWorkflowStore.getState();
    try {
      const response = await fetch('/api/workflows/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.detail || 'Workflow check is unavailable.');
      const issues = [...(result.errors || []), ...(result.warnings || [])];
      addToast({
        title: result.valid ? (issues.length ? 'Flow checked with suggestions' : 'Flow is ready') : 'Flow needs attention',
        description: issues.slice(0, 3).join(' ') || `${result.node_count} steps and ${result.edge_count} connections checked.`,
        type: result.valid ? (issues.length ? 'info' : 'success') : 'error',
      });
    } catch (error) {
      addToast({ title: 'Flow check unavailable', description: error instanceof Error ? error.message : 'Backend unavailable.', type: 'error' });
    }
  };

  const openVersions = async () => {
    setMoreOpen(false);
    setVersionsOpen(true);
    setVersionsLoading(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgentId}/workflow/revisions`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Saved versions could not be loaded.');
      setVersions(data.revisions || []);
    } catch (error) {
      addToast({ title: 'Versions unavailable', description: error instanceof Error ? error.message : 'Backend unavailable.', type: 'error' });
      setVersionsOpen(false);
    } finally { setVersionsLoading(false); }
  };

  const restoreVersion = async (revisionId: string) => {
    setRestoreId(revisionId);
    try {
      const response = await fetch(`/api/agents/${selectedAgentId}/workflow/revisions/${revisionId}/restore`, { method: 'POST' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'This version could not be restored.');
      useWorkflowStore.getState().loadWorkflow(JSON.parse(data.nodes || '[]'), JSON.parse(data.edges || '[]'));
      setVersionsOpen(false);
      addToast({ title: 'Workflow version restored', description: 'The restored flow is now saved to this agent.', type: 'success' });
    } catch (error) {
      addToast({ title: 'Could not restore version', description: error instanceof Error ? error.message : 'Backend unavailable.', type: 'error' });
    } finally { setRestoreId(null); }
  };

  return (
    <div className="z-40 flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 md:gap-4 md:px-5">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0">
          <h1 className="font-semibold text-slate-900 text-[15px] truncate leading-tight">{viewTitle[activeView] || 'Bask Voice Studio'}</h1>
          <p className="text-[11px] font-medium text-slate-400">{selectedAgentId ? `Saved ${lastSaved}` : activeView === 'home' ? 'Bask Digital Agency workspace' : 'Draft agent'}</p>
        </div>
        {showInspectorToggle && <div className="relative">
          <button
            aria-label="Choose environment"
            onClick={() => setEnvOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${envTone[environment] ?? 'bg-slate-400'}`} />
            {environment}
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          <Menu open={envOpen} onClose={() => setEnvOpen(false)}>
            {['Development', 'Staging', 'Production'].map((e) => (
              <button
                key={e}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                onClick={() => {
                  setEnvironment(e);
                  setEnvOpen(false);
                }}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${envTone[e]}`} />
                  {e}
                </span>
                {environment === e && <Check size={14} className="text-blue-600" />}
              </button>
            ))}
          </Menu>
        </div>}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-9 gap-1.5 rounded-full px-3 font-medium text-slate-600 xl:inline-flex"
          onClick={() => setFeedbackOpen(true)}
        >
          <MessageSquare size={14} />
          Feedback
        </Button>

        <div className="relative">
          <Button aria-label="More agent actions" variant="outline" size="icon" className="h-9 w-9 text-slate-500" onClick={() => setMoreOpen((v) => !v)}>
            <MoreHorizontal size={14} />
          </Button>
          <Menu open={moreOpen} onClose={() => setMoreOpen(false)} align="right">
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setMoreOpen(false); void duplicateAgent(); }}>
              Duplicate
            </button>
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setMoreOpen(false); exportAgent(); }}>
              Export JSON
            </button>
            {selectedAgentId && <button className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => void openVersions()}><History size={14} /> Workflow versions</button>}
          </Menu>
        </div>

        <Button aria-label="Share agent" variant="outline" size="icon" className="hidden h-9 w-9 text-slate-500 sm:inline-flex" onClick={() => setShareOpen(true)}>
          <Share2 size={14} />
        </Button>

        <div className="relative">
          <Button variant="outline" size="sm" className="h-9 bg-white font-medium text-slate-700 px-3" onClick={() => setVerOpen((v) => !v)}>
            {version} <ChevronDown size={12} className="ml-1 text-slate-400" />
          </Button>
          <Menu open={verOpen} onClose={() => setVerOpen(false)} align="right">
            {['V0', 'V1 draft', 'V1 published'].map((v) => (
              <button
                key={v}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                onClick={() => {
                  setVersion(v);
                  setVerOpen(false);
                }}
              >
                {v}
                {version === v && <Check size={14} className="text-blue-600" />}
              </button>
            ))}
          </Menu>
        </div>

        {activeView === 'agent' && (
          <Button
            variant={libraryOpen ? 'secondary' : 'outline'}
            size="icon"
            className="h-9 w-9 text-slate-500"
            aria-label="Toggle node library"
            title="Toggle node library"
            onClick={() => setLibraryOpen(!libraryOpen)}
          >
            <PanelLeft size={14} />
          </Button>
        )}
        {showInspectorToggle && (
          <Button
            variant={inspectorOpen ? 'secondary' : 'outline'}
            size="icon"
            className="h-9 w-9 text-slate-500"
            aria-label="Toggle inspector"
            title="Toggle inspector"
            onClick={() => setInspectorOpen(!inspectorOpen)}
          >
            <PanelRight size={14} />
          </Button>
        )}

        {showInspectorToggle && <Button variant="outline" size="sm" className="hidden h-9 gap-1.5 font-medium px-3 lg:inline-flex" onClick={() => void validateWorkflow()}><ShieldCheck size={14} />Check flow</Button>}
        <Button variant="outline" size="sm" className="h-9 gap-1.5 font-medium px-4" onClick={() => setTestCallOpen(true)}>
          <Play size={14} className="text-emerald-600" fill="currentColor" />
          Test
          <kbd className="hidden xl:inline ml-1 text-[10px] text-slate-400 font-medium">⌘↵</kbd>
        </Button>

        <Button
          variant={copilotOpen ? 'default' : 'outline'}
          size="sm"
          aria-label="Open Conductor"
          className={`h-9 gap-1.5 px-2 font-medium sm:px-3 ${
            copilotOpen
              ? 'border border-blue-200 bg-blue-50 text-blue-700 shadow-none hover:bg-blue-50'
              : 'bg-white text-slate-700'
          }`}
          onClick={toggleCopilot}
        >
          <Sparkles size={14} />
          <span className="hidden md:inline">Conductor</span>
        </Button>

        <Button aria-label="Publish agent" size="sm" className="ml-1 h-9 px-3 sm:px-5" onClick={() => setPublishOpen(true)}>
          Publish
        </Button>
      </div>
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Workflow versions" subtitle="Restore a previous saved call flow. Your current flow is kept as a version first." width="max-w-xl">
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100">
          {versionsLoading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 size={15} className="animate-spin" /> Loading saved versions…</div> : versions.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No workflow versions have been saved yet.</p> : versions.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{item.label}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()} · {item.node_count} steps · {item.edge_count} connections</p></div><Button size="sm" variant="outline" disabled={Boolean(restoreId)} onClick={() => void restoreVersion(item.id)}>{restoreId === item.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}<span className="ml-1">Restore</span></Button></div>)}
        </div>
      </Modal>
    </div>
  );
}
