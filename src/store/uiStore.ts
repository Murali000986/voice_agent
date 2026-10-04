import { create } from 'zustand';
import { useWorkflowStore } from './workflowStore';
import { readApiResponse } from '@/lib/api';

export type AppView = 'home' | 'agents' | 'agent' | 'workflow' | 'simulation' | 'calls' | 'settings';
export type TestStatus = 'passed' | 'failed' | 'pending' | 'running';

export type TranscriptTurn = {
  id: string;
  speaker: 'Agent' | 'Caller';
  text: string;
  ts: string;
};

export type TestCase = {
  id: string;
  name: string;
  persona: string;
  script: string;
  expectedOutcome: string;
  status: TestStatus;
  lastRun?: string;
  duration?: string;
  transcript?: TranscriptTurn[];
  reason?: string;
};

export type BatchRun = {
  id: string;
  name: string;
  ranAt: string;
  passed: number;
  failed: number;
  total: number;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  agentCreated?: { agentId: string; name: string; description: string; test_results?: any };
  agentPlan?: Record<string, any>;
};

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'info' | 'error';
};

export type AgentSettings = {
  name: string;
  description: string;
  language: string;
  voice: string;
  model: string;
  temperature: number;
  greeting: string;
  systemPrompt: string;
  interruptionSensitivity: number;
  silenceTimeout: number;
  maxCallDuration: number;
  transcribeProvider: string;
  webhookUrl: string;
  webhookEvents: string[];
  hipaa: boolean;
  fallbackMessage: string;
  knowledgeBases: { id: string; name: string; docs: number; files: string[] }[];
  extractionFields: string[];
  phoneNumber: string | null;
};

const defaultSettings: AgentSettings = {
  name: 'New voice agent',
  description: '',
  language: 'English (US)',
  voice: 'Cimo — Warm professional',
  model: 'GPT-4.1',
  temperature: 0.4,
  greeting: 'Hello, thanks for calling. How can I help you today?',
  systemPrompt: 'You are a helpful voice assistant for this business. Understand the caller’s needs, ask one question at a time, and follow the configured call flow. Never invent prices, availability, services, or business details. Respect do-not-contact requests immediately.',
  interruptionSensitivity: 0.7,
  silenceTimeout: 10,
  maxCallDuration: 12,
  transcribeProvider: 'Deepgram Nova-3',
  webhookUrl: '',
  webhookEvents: ['call.started', 'call.ended', 'transcript.ready'],
  hipaa: false,
  fallbackMessage: "I'm having trouble connecting. Please try again in a moment, or leave a callback number.",
  knowledgeBases: [],
  phoneNumber: null,
  extractionFields: [
    'Call Summary',
    'User Sentiment',
    'business_industry',
    'website_url',
    'growth_goal',
    'budget_range',
  ],
};

const defaultTests: TestCase[] = [
  {
    id: 'tc-1',
    name: 'Inbound — enterprise growth need',
    persona: 'Marketing leader at a mid-market software company',
    script: 'Calls about improving the sales pipeline. Has a specific problem with lead quality and is evaluating agencies.',
    expectedOutcome: 'Identify the caller’s role and pain point, ask about budget and timeline without inventing details, and offer a sales introduction when appropriate.',
    status: 'pending',
  },
  {
    id: 'tc-2',
    name: 'Outbound — wrong contact',
    persona: 'Operations manager who is not the marketing decision maker',
    script: 'Explains that another executive owns agency decisions and is willing to share their role, but not personal contact details.',
    expectedOutcome: 'Do not treat the caller as the decision maker. Ask whether they can introduce the right person and capture only volunteered details.',
    status: 'pending',
  },
  {
    id: 'tc-3',
    name: 'Opt-out — stop outreach',
    persona: 'Prospect who does not want another sales call',
    script: 'Clearly asks the agent not to call again.',
    expectedOutcome: 'Acknowledge the request, end politely, and do not continue qualification.',
    status: 'pending',
  },
  {
    id: 'tc-4',
    name: 'Interested — budget not confirmed',
    persona: 'Enterprise prospect interested in a follow-up',
    script: 'Describes a marketing pain point and asks for an introduction, but is not ready to share budget or a start date.',
    expectedOutcome: 'Record what the caller volunteered, do not assume qualification, and offer a low-pressure follow-up.',
    status: 'pending',
  },
];

// Removed static copilotReply

type UiState = {
  activeView: AppView;
  setActiveView: (v: AppView) => void;
  copilotOpen: boolean;
  toggleCopilot: () => void;
  testCallOpen: boolean;
  setTestCallOpen: (v: boolean) => void;
  publishOpen: boolean;
  setPublishOpen: (v: boolean) => void;
  feedbackOpen: boolean;
  setFeedbackOpen: (v: boolean) => void;
  shareOpen: boolean;
  setShareOpen: (v: boolean) => void;
  environment: string;
  setEnvironment: (v: string) => void;
  version: string;
  setVersion: (v: string) => void;
  gettingStartedOpen: boolean;
  toggleGettingStarted: () => void;
  completedSteps: string[];
  completeStep: (id: string) => void;
  toasts: ToastItem[];
  addToast: (t: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  testCases: TestCase[];
  setTestCases: (cases: TestCase[]) => void;
  addTestCase: (t: Omit<TestCase, 'id' | 'status'>) => Promise<void>;
  runTest: (id: string, quiet?: boolean) => Promise<void>;
  runAllTests: () => Promise<void>;
  addKbDoc: (kbId: string, fileName: string) => void;
  removeKbDoc: (kbId: string, fileName: string) => void;
  setPhoneNumber: (n: string | null) => void;
  simulationTab: 'cases' | 'history';
  setSimulationTab: (t: 'cases' | 'history') => void;
  selectedTestId: string | null;
  setSelectedTestId: (id: string | null) => void;
  batchRuns: BatchRun[];
  copilotMessages: ChatMessage[];
  copilotLoading: boolean;
  conductorMode: 'normal' | 'build' | 'edit';
  conductorStage: string;
  sessionId: string | null;
  pendingWorkflow: { nodes: any[], edges: any[] } | null;
  aiActionState: string | null;
  aiProgress: number | null;
  researchWebsiteUrl: string | null;
  setConductorMode: (mode: 'normal' | 'build' | 'edit') => void;
  pollResearch: () => Promise<void>;
  sendCopilotMessage: (content: string, researchProfile?: Record<string, any>) => Promise<void>;
  resetCopilot: () => void;
  restoreCopilot: (messages: ChatMessage[], sessionId: string | null, stage?: string) => void;
  clearPendingWorkflow: () => void;
  agentCreated: { agentId: string; name: string; description: string } | null;
  setAgentCreated: (v: { agentId: string; name: string; description: string } | null) => void;
  agentSettings: AgentSettings;
  updateAgentSettings: (p: Partial<AgentSettings>) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  markAgentSaved: () => void;
  inspectorTab: 'global' | 'node';
  setInspectorTab: (t: 'global' | 'node') => void;
  libraryTab: 'node' | 'subflows';
  setLibraryTab: (t: 'node' | 'subflows') => void;
  libraryOpen: boolean;
  setLibraryOpen: (v: boolean) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (v: boolean) => void;
  lastSaved: string;
};

export const useUiStore = create<UiState>((set, get) => ({
  activeView: 'home',
  setActiveView: (activeView) => set({ activeView }),
  copilotOpen: false,
  toggleCopilot: () => set({ copilotOpen: !get().copilotOpen }),
  testCallOpen: false,
  setTestCallOpen: (testCallOpen) => set({ testCallOpen }),
  publishOpen: false,
  setPublishOpen: (publishOpen) => set({ publishOpen }),
  feedbackOpen: false,
  setFeedbackOpen: (feedbackOpen) => set({ feedbackOpen }),
  shareOpen: false,
  setShareOpen: (shareOpen) => set({ shareOpen }),
  environment: 'Staging',
  setEnvironment: (environment) => set({ environment }),
  version: 'V0',
  setVersion: (version) => set({ version }),
  gettingStartedOpen: false,
  toggleGettingStarted: () => set({ gettingStartedOpen: !get().gettingStartedOpen }),
  completedSteps: ['name', 'voice'],
  completeStep: (id) => {
    const current = get().completedSteps;
    if (current.includes(id)) return;
    set({ completedSteps: [...current, id] });
  },
  toasts: [],
  addToast: (t) => {
    const id = `toast-${Date.now()}`;
    set({ toasts: [...get().toasts, { ...t, id }] });
    window.setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  testCases: defaultTests,
  setTestCases: (testCases) => set({ testCases }),
  addTestCase: async (t) => {
    const agentId = get().selectedAgentId;
    if (agentId) {
      try {
        const response = await fetch(`/api/agents/${agentId}/scenarios`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: t.name, persona: t.persona, script: t.script, expected_outcome: t.expectedOutcome }),
        });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Test case could not be saved.');
        const scenario: TestCase = { id: data.id, name: data.name, persona: data.persona, script: data.script, expectedOutcome: data.expected_outcome, status: 'pending' };
        set({ testCases: [scenario, ...get().testCases] });
        get().addToast({ title: 'Test case saved', description: 'This scenario is stored with your agent.', type: 'success' });
        return;
      } catch (error) {
        get().addToast({ title: 'Test case could not be saved', description: error instanceof Error ? error.message : 'Backend unavailable.', type: 'error' });
        return;
      }
    }
    const id = `tc-${Date.now()}`;
    set({ testCases: [{ ...t, id, status: 'pending' }, ...get().testCases] });
    get().addToast({ title: 'Test case added', description: 'Save an agent to keep this test case between sessions.', type: 'info' });
  },
  runTest: async (id, quiet = false) => {
    const testCase = get().testCases.find((test) => test.id === id);
    if (!testCase) return;
    const startedAt = performance.now();
    set({ testCases: get().testCases.map((test) => test.id === id ? { ...test, status: 'running', transcript: [], reason: undefined } : test) });
    try {
      const { nodes, edges } = useWorkflowStore.getState();
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: testCase.persona,
          script: testCase.script,
          expected_outcome: testCase.expectedOutcome,
          agent_system_prompt: get().agentSettings.systemPrompt,
          agent_settings: get().agentSettings,
          nodes,
          edges,
          max_turns: 8,
          agent_id: get().selectedAgentId || '',
          scenario_id: id,
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Simulation could not run.');
      const turns: TranscriptTurn[] = (data.turns || []).map((turn: { id?: string; speaker: string; text: string; ts?: string }, index: number) => ({
        id: turn.id || String(index + 1),
        speaker: turn.speaker === 'Agent' ? 'Agent' : 'Caller',
        text: turn.text,
        ts: turn.ts || '',
      }));
      const elapsed = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
      set({ testCases: get().testCases.map((test) => test.id === id ? {
        ...test,
        status: data.passed ? 'passed' : 'failed',
        transcript: turns,
        lastRun: new Date().toLocaleString(),
        duration: `${Math.floor(elapsed / 60)}m ${String(elapsed % 60).padStart(2, '0')}s`,
        reason: data.reason || '',
      } : test) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The simulation service is unavailable.';
      set({ testCases: get().testCases.map((test) => test.id === id ? { ...test, status: 'failed', reason: message, lastRun: new Date().toLocaleString() } : test) });
      if (!quiet) get().addToast({ title: 'Test could not complete', description: message, type: 'error' });
    }
  },
  runAllTests: async () => {
    const cases = get().testCases;
    if (!cases.length) return;
    set({ testCases: cases.map((test) => ({ ...test, status: 'running', transcript: [], reason: undefined })) });
    for (const test of cases) await get().runTest(test.id, true);
    const finished = get().testCases;
    const passed = finished.filter((test) => test.status === 'passed').length;
    const failed = finished.filter((test) => test.status === 'failed').length;
    set({ batchRuns: [{ id: `batch-${Date.now()}`, name: 'Scenario run', ranAt: new Date().toLocaleString(), passed, failed, total: finished.length }, ...get().batchRuns] });
    get().addToast({ title: `${passed} passed · ${failed} failed`, description: 'Results are based on the current agent and call flow.', type: failed ? 'info' : 'success' });
  },
  addKbDoc: (kbId, fileName) => {
    set({
      agentSettings: {
        ...get().agentSettings,
        knowledgeBases: get().agentSettings.knowledgeBases.map((kb) =>
          kb.id === kbId
            ? { ...kb, docs: kb.docs + 1, files: [...kb.files, fileName] }
            : kb
        ),
      },
    });
  },
  removeKbDoc: (kbId, fileName) => {
    set({
      agentSettings: {
        ...get().agentSettings,
        knowledgeBases: get().agentSettings.knowledgeBases.map((kb) =>
          kb.id === kbId
            ? { ...kb, docs: Math.max(0, kb.docs - 1), files: kb.files.filter((f) => f !== fileName) }
            : kb
        ),
      },
    });
  },
  setPhoneNumber: (phoneNumber) => set({ agentSettings: { ...get().agentSettings, phoneNumber } } as never),
  simulationTab: 'cases',
  setSimulationTab: (simulationTab) => set({ simulationTab }),
  selectedTestId: 'tc-1',
  setSelectedTestId: (selectedTestId) => set({ selectedTestId }),
  batchRuns: [],
  copilotMessages: [],
  copilotLoading: false,
  conductorMode: 'normal',
  conductorStage: 'UNDERSTAND',
  sessionId: null,
  pendingWorkflow: null,
  aiActionState: null,
  aiProgress: null,
  researchWebsiteUrl: null,
  setConductorMode: (mode) => set({ conductorMode: mode, copilotMessages: [] }),
  
  pollResearch: async () => {
    const sid = get().sessionId;
    if (!sid) return;
    set({ aiActionState: 'Checking that the website is safe to open…', aiProgress: 4 });
    const fail = (message: string) => {
      set({
        conductorStage: 'UNDERSTAND',
        copilotLoading: false,
        aiActionState: null,
        aiProgress: null,
        researchWebsiteUrl: null,
        copilotMessages: [...get().copilotMessages, {
          id: `m-${Date.now()}-research-error`, role: 'assistant', content: message,
        }],
      });
    };
    try {
      for (let attempt = 0; attempt < 90; attempt += 1) {
        const res = await fetch(`/api/conductor/research/${sid}`);
        const body = await res.text();
        let data: Record<string, any>;
        try { data = body ? JSON.parse(body) : {}; }
        catch { throw new Error(`Conductor returned an unreadable response (${res.status}).`); }
        if (!res.ok) throw new Error(data.detail || `Conductor request failed (${res.status}).`);
        if (data.status === 'done') {
          if (!data.profile?.website_facts) {
            fail("I couldn't extract readable information from that website. Check that it's public, or paste the business details here and I'll build the agent from those.");
            return;
          }
          set({ aiActionState: 'Research complete! Preparing your agent plan...', aiProgress: 88 });
          await get().sendCopilotMessage("Research complete. Continue to next step.", data.profile);
          return;
        }
        if (data.status === 'failed') {
          fail(`I couldn't read that website: ${data.error || 'the site did not return readable pages'}. Check the URL is public, or paste the business details here.`);
          return;
        }
        if (data.status === 'researching' && data.phase) {
          set({ aiActionState: data.phase, aiProgress: Number.isFinite(data.progress) ? data.progress : get().aiProgress });
        }
        await new Promise((resolve) => setTimeout(resolve, data.status === 'not_found' ? 750 : 1500));
      }
      fail("Website research took too long. Try the link again, or paste the business details here.");
    } catch (e) {
      fail(`Website research couldn't finish: ${e instanceof Error ? e.message : 'please try again'}.`);
    }
  },

  sendCopilotMessage: async (content, researchProfile) => {
    const user: ChatMessage = { id: `m-${Date.now()}`, role: 'user', content };
    // Don't show the hidden research complete trigger in chat
    if (content !== "Research complete. Continue to next step." && content !== "__AUTO_GENERATE__") {
        set({ copilotMessages: [...get().copilotMessages, user], copilotLoading: true, aiActionState: 'Analyzing inputs...', aiProgress: 12 });
    } else {
        set({ copilotLoading: true, aiActionState: content === '__AUTO_GENERATE__' ? 'Building your agent call flow…' : 'Preparing your agent plan…', aiProgress: content === '__AUTO_GENERATE__' ? 91 : 86 });
    }
    
    try {
      // Route ALL messages through unified conductor endpoint
      if (content !== '__AUTO_GENERATE__' && get().conductorStage === 'CONFIRM_PROFILE') {
          set({ aiActionState: 'Designing node graph architecture...', aiProgress: 89 });
      }
      const res = await fetch('/api/conductor/chat', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ message: content, session_id: get().sessionId, agent_id: get().selectedAgentId, research_profile: researchProfile }),
      });
      const body = await res.text();
      let data: Record<string, any>;
      try { data = body ? JSON.parse(body) : {}; }
      catch { throw new Error(`Conductor returned an unreadable response (${res.status}).`); }
      if (!res.ok) throw new Error(data.detail || `Conductor request failed (${res.status}).`);

      if (data.session_id) set({ sessionId: data.session_id });
      if (data.stage) set({ conductorStage: data.stage });

      // The approval request advances the session to GENERATE; the next request builds the flow.
      if (data.stage === 'GENERATE' && !data.agent_created) {
          setTimeout(() => get().sendCopilotMessage('__AUTO_GENERATE__'), 500);
      }

      if (data.trigger_research) {
          set({ researchWebsiteUrl: data.trigger_research, aiActionState: 'Opening the website homepage…', aiProgress: 8 });
          const researchRes = await fetch('/api/conductor/research', {
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ url: data.trigger_research, session_id: data.session_id })
          });
          if (!researchRes.ok) throw new Error(`Website research could not start (${researchRes.status}).`);
          await get().pollResearch();
      }

      if (data.agent_updated) {
          const agent = data.agent_updated;
          get().updateAgentSettings({
            name: agent.name,
            description: agent.description || '',
            greeting: agent.greeting,
            systemPrompt: agent.system_prompt,
            voice: agent.voice,
            language: agent.language === 'en-US' ? 'English (US)' : agent.language,
            temperature: agent.temperature,
            maxCallDuration: agent.max_duration_minutes,
          });
      }
      if (data.workflow_draft) {
          if (data.agent_created || data.agent_updated) {
              useWorkflowStore.getState().loadWorkflow(data.workflow_draft.nodes || [], data.workflow_draft.edges || []);
              set({ pendingWorkflow: null });
          } else {
              set({ pendingWorkflow: data.workflow_draft });
          }
      }

      // Apply workflow_update actions from Conductor to the canvas store
      if (data.workflow_update) {
          const wfStore = useWorkflowStore.getState();
          const acts: Array<{op: string; id?: string; type?: string; label?: string; prompt?: string}> =
              Array.isArray(data.workflow_update) ? data.workflow_update : [data.workflow_update];
          for (const act of acts) {
              if (act.op === 'add') {
                  const maxX = wfStore.nodes.reduce((m: number, n) => Math.max(m, n.position.x), 0);
                  wfStore.addNode(act.type || 'conversation', { x: maxX + 440, y: 200 });
                  if (act.label) {
                      const updated = useWorkflowStore.getState().nodes;
                      const newest = updated[updated.length - 1];
                      if (newest) wfStore.updateNode(newest.id, { label: act.label, prompt: act.prompt || '' });
                  }
              } else if (act.op === 'remove' && act.id) {
                  wfStore.removeNode(act.id);
              } else if (act.op === 'update' && act.id) {
                  wfStore.updateNode(act.id, { label: act.label, prompt: act.prompt });
              }
          }
      }

      const assistant: ChatMessage = {
        id: `m-${Date.now()}-a`, role: 'assistant', content: data.reply || "Error",
        suggestions: data.suggestions,
        ...(data.agent_created ? {
          agentCreated: {
            ...data.agent_created,
            agentId: data.agent_created.agent_id ?? data.agent_created.agentId,
          },
        } : {}),
        ...((data.agent_plan || data.agentPlan)
          ? { agentPlan: data.agent_plan || data.agentPlan }
          : ((get().conductorStage === 'CONFIRM_PROFILE' || data.stage === 'CONFIRM_PROFILE') && data.workflow_draft
            ? { agentPlan: data.workflow_draft }
            : {}))
      };

      set({ copilotMessages: [...get().copilotMessages, assistant], copilotLoading: false, aiActionState: null, aiProgress: null });
      return;



    } catch (e) {
      console.error(e);
      const detail = e instanceof Error ? e.message : 'Check that the backend is running and try again.';
      const err: ChatMessage = {
        id: `m-${Date.now()}-e`, role: 'assistant', content: `Conductor could not complete that request: ${detail}`,
      };
      set({ copilotMessages: [...get().copilotMessages, err], copilotLoading: false, aiActionState: null, aiProgress: null });
    }
  },
  resetCopilot: () => set({ copilotMessages: [], copilotLoading: false, pendingWorkflow: null, aiActionState: null, aiProgress: null, researchWebsiteUrl: null, sessionId: null, conductorStage: 'UNDERSTAND', agentCreated: null }),
  restoreCopilot: (copilotMessages, sessionId, stage) => set({ copilotMessages, copilotLoading: false, pendingWorkflow: null, aiActionState: null, aiProgress: null, researchWebsiteUrl: null, sessionId, conductorStage: stage || (copilotMessages.some((message) => message.agentCreated) ? 'COMPLETED' : copilotMessages.some((message) => message.agentPlan) ? 'CONFIRM_PROFILE' : 'UNDERSTAND') }),
  clearPendingWorkflow: () => set({ pendingWorkflow: null }),
  agentCreated: null,
  setAgentCreated: (agentCreated) => set({ agentCreated }),
  agentSettings: defaultSettings,
  updateAgentSettings: (p) => set({ agentSettings: { ...get().agentSettings, ...p } }),
  selectedAgentId: null,
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),
  markAgentSaved: () => set({ lastSaved: 'just now' }),
  inspectorTab: 'global',
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  libraryTab: 'node',
  setLibraryTab: (libraryTab) => set({ libraryTab }),
  libraryOpen: true,
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  inspectorOpen: true,
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  lastSaved: 'just now',
}));
