import { EditorLayout } from './components/layout/EditorLayout';
import { WorkflowCanvas } from './components/workflow/WorkflowCanvas';
import { NodeLibrary } from './components/workflow/NodeLibrary';
import { GlobalSettings } from './components/inspector/GlobalSettings';
import { CopilotPanel } from './components/inspector/CopilotPanel';
import { AgentCanvas } from './components/agent/AgentCanvas';
import { SimulationView } from './components/simulation/SimulationView';
import { SettingsView } from './components/layout/SettingsView';
import { GettingStarted } from './components/layout/GettingStarted';
import { CallsView } from './components/calls/CallsView';
import { HomeChatPage } from './components/layout/HomeChatPage';
import { AgentHistoryView } from './components/layout/AgentHistoryView';
import { ToastHost } from './components/ui/ToastHost';
import { TestCallModal } from './components/modals/TestCallModal';
import { FeedbackModal, PublishModal, ShareModal } from './components/modals/AppModals';
import { useEffect, useRef, useState } from 'react';
import { useUiStore } from './store/uiStore';
import { useWorkflowStore } from './store/workflowStore';
import { agentIdFromPath, agentPathFor } from './lib/agentRoute';
import { readApiResponse } from './lib/api';

function RightPanels() {
  const copilotOpen = useUiStore((s) => s.copilotOpen);
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);

  if (!copilotOpen && !inspectorOpen) return null;

  return (
    <div className="flex gap-3 h-full pointer-events-auto">
      {inspectorOpen && (
        <div className="w-[300px] panel-card flex flex-col overflow-hidden">
          <GlobalSettings />
        </div>
      )}
      {copilotOpen && (
        <div className="w-[300px] panel-card flex flex-col overflow-hidden">
          <CopilotPanel />
        </div>
      )}
    </div>
  );
}

function App() {
  const activeView = useUiStore((s) => s.activeView);
  const libraryOpen = useUiStore((s) => s.libraryOpen);
  const selectedAgentId = useUiStore((s) => s.selectedAgentId);
  const agentSettings = useUiStore((s) => s.agentSettings);
  const markAgentSaved = useUiStore((s) => s.markAgentSaved);
  const addToast = useUiStore((s) => s.addToast);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setSelectedAgentId = useUiStore((s) => s.setSelectedAgentId);
  const updateAgentSettings = useUiStore((s) => s.updateAgentSettings);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const saveFailed = useRef(false);
  const routeTarget = useRef<string | null>(null);
  const [routeReady, setRouteReady] = useState(false);

  useEffect(() => {
    let active = true;
    const openPath = async (pathname: string) => {
      const agentId = agentIdFromPath(pathname);
      if (!agentId) {
        if (pathname !== '/') window.history.replaceState({}, '', '/');
        if (active) {
          routeTarget.current = '/';
          setSelectedAgentId(null);
          setActiveView('home');
          setRouteReady(true);
        }
        return;
      }

      try {
        const [agentResponse, workflowResponse] = await Promise.all([
          fetch(`/api/agents/${agentId}`),
          fetch(`/api/agents/${agentId}/workflow`),
        ]);
        const agent = await readApiResponse(agentResponse);
        const workflow = await readApiResponse(workflowResponse);
        if (!agentResponse.ok || !workflowResponse.ok) throw new Error(agent.detail || workflow.detail || 'Agent link is invalid.');
        if (!active) return;

        const parsedNodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes || '[]') : workflow.nodes || [];
        const parsedEdges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges || '[]') : workflow.edges || [];
        if (!Array.isArray(parsedNodes) || !Array.isArray(parsedEdges)) throw new Error('This agent has an unreadable call flow.');
        useWorkflowStore.getState().loadWorkflow(parsedNodes, parsedEdges);
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
        routeTarget.current = pathname;
        setSelectedAgentId(agentId);
        setActiveView('agent');
        setRouteReady(true);
      } catch (error) {
        if (!active) return;
        routeTarget.current = '/';
        window.history.replaceState({}, '', '/');
        setSelectedAgentId(null);
        setActiveView('home');
        setRouteReady(true);
        addToast({ title: 'Agent link could not be opened', description: error instanceof Error ? error.message : 'The saved agent could not be loaded.', type: 'error' });
      }
    };

    const handlePopState = () => {
      routeTarget.current = window.location.pathname;
      void openPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    void openPath(window.location.pathname);
    return () => {
      active = false;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [addToast, setActiveView, setSelectedAgentId, updateAgentSettings]);

  useEffect(() => {
    if (!routeReady) return;
    const isAgentView = activeView === 'agent' || activeView === 'workflow';
    const nextPath = isAgentView && selectedAgentId
      ? agentPathFor(agentSettings.name, selectedAgentId)
      : '/';

    if (routeTarget.current) {
      if (routeTarget.current === nextPath) routeTarget.current = null;
      else return;
    }
    if (window.location.pathname !== nextPath) {
      if (selectedAgentId && agentIdFromPath(window.location.pathname) === selectedAgentId) {
        window.history.replaceState({}, '', nextPath);
      } else {
        window.history.pushState({}, '', nextPath);
      }
    }
  }, [routeReady, activeView, selectedAgentId, agentSettings.name]);

  useEffect(() => {
    if (!selectedAgentId) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/agents/${selectedAgentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: agentSettings.name,
            description: agentSettings.description,
            greeting: agentSettings.greeting,
            system_prompt: agentSettings.systemPrompt,
            voice: agentSettings.voice,
            language: agentSettings.language === 'English (US)' ? 'en-US' : agentSettings.language,
            temperature: agentSettings.temperature,
            max_duration_minutes: agentSettings.maxCallDuration,
            workflow_nodes: JSON.stringify(nodes),
            workflow_edges: JSON.stringify(edges),
          }),
        });
        if (!response.ok) throw new Error('Agent changes could not be saved.');
        saveFailed.current = false;
        markAgentSaved();
      } catch {
        if (!saveFailed.current) {
          addToast({ title: 'Changes are not saved', description: 'Check that the backend is running, then try again.', type: 'error' });
        }
        saveFailed.current = true;
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [selectedAgentId, agentSettings, nodes, edges, markAgentSaved, addToast]);

  const leftPanel = activeView === 'agent' && libraryOpen ? <NodeLibrary /> : undefined;
  const rightPanel = (activeView === 'agent' || activeView === 'workflow') ? <RightPanels /> : undefined;

  return (
    <>
      <EditorLayout leftPanel={leftPanel} rightPanel={rightPanel}>
        {activeView === 'home' && <HomeChatPage />}
        {activeView === 'agents' && <AgentHistoryView />}
        {activeView === 'agent' && (
          <>
            <WorkflowCanvas />
            <GettingStarted />
          </>
        )}
        {activeView === 'workflow' && <AgentCanvas />}
        {activeView === 'simulation' && <SimulationView />}
        {activeView === 'calls' && <CallsView />}
        {activeView === 'settings' && <SettingsView />}
      </EditorLayout>
      <ToastHost />
      <TestCallModal />
      <PublishModal />
      <FeedbackModal />
      <ShareModal />
    </>
  );
}

export default App;
