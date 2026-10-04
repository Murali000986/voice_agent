import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Play, Plus, Search, XCircle, Clock, Loader2, Bot, User } from 'lucide-react';
import { useUiStore, type BatchRun, type TestStatus, type TranscriptTurn } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { readApiResponse } from '@/lib/api';

function StatusPill({ status }: { status: TestStatus }) {
  const map = {
    passed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    failed: 'bg-rose-50 text-rose-700 border-rose-100',
    pending: 'bg-slate-50 text-slate-500 border-slate-200',
    running: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize inline-flex items-center gap-1 ${map[status]}`}>
      {status === 'running' && <Loader2 size={10} className="animate-spin" />}
      {status}
    </span>
  );
}

function TranscriptPanel({ turns, status }: { turns: TranscriptTurn[]; status: TestStatus }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  if (turns.length === 0 && status !== 'running') {
    return (
      <p className="text-xs text-slate-400 italic">
        No transcript yet — run the test to see the conversation.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
      {turns.map((t) => (
        <div key={t.id} className={`flex gap-2 items-start ${t.speaker !== 'Agent' ? 'flex-row-reverse' : ''}`}>
          <div className={`flex size-6 shrink-0 items-center justify-center rounded-full ${t.speaker === 'Agent' ? 'bg-slate-100' : 'bg-blue-100'}`}>
            {t.speaker === 'Agent'
              ? <Bot size={12} className="text-slate-700" />
              : <User size={12} className="text-blue-600" />}
          </div>
          <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${t.speaker === 'Agent' ? 'bg-slate-100 text-slate-800' : 'bg-blue-50 text-blue-900'}`}>
            {t.text}
            <span className="block text-[10px] opacity-40 mt-0.5">{t.ts}</span>
          </div>
        </div>
      ))}
      {status === 'running' && (
        <div className="flex gap-2 items-center pl-8 text-xs text-slate-400">
          <Loader2 size={11} className="animate-spin" /> Agent is speaking…
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export function SimulationView() {
  const { simulationTab, setSimulationTab, testCases, setTestCases, selectedTestId, setSelectedTestId, runTest, runAllTests, addTestCase, batchRuns, setTestCallOpen, selectedAgentId, addToast } = useUiStore();
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [savedRuns, setSavedRuns] = useState<BatchRun[]>([]);
  const [draft, setDraft] = useState({ name: '', persona: '', script: '', expectedOutcome: '' });

  useEffect(() => {
    let active = true;
    if (!selectedAgentId) return () => { active = false; };
    fetch(`/api/agents/${selectedAgentId}/scenarios`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Saved test scenarios could not be loaded.');
        if (!active) return;
        setTestCases((data.scenarios || []).map((scenario: { id: string; name: string; persona: string; script: string; expected_outcome: string }) => ({
          id: scenario.id, name: scenario.name, persona: scenario.persona, script: scenario.script,
          expectedOutcome: scenario.expected_outcome || '', status: 'pending' as const,
        })));
      })
      .catch((error) => { if (active) addToast({ title: 'Scenarios could not load', description: error instanceof Error ? error.message : 'Backend unavailable.', type: 'error' }); });
    return () => { active = false; };
  }, [selectedAgentId, setTestCases, addToast]);

  useEffect(() => {
    let active = true;
    if (simulationTab !== 'history' || !selectedAgentId) return () => { active = false; };
    fetch(`/api/agents/${selectedAgentId}/simulation-runs?limit=50`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Test run history could not load.');
        if (!active) return;
        const names = new Map(testCases.map((test) => [test.id, test.name]));
        setSavedRuns((data.runs || []).map((run: { id: string; scenario_id: string; created_at: string; status: string }) => ({
          id: run.id, name: names.get(run.scenario_id) || 'Agent simulation', ranAt: new Date(run.created_at).toLocaleString(),
          passed: run.status === 'passed' ? 1 : 0, failed: run.status === 'passed' ? 0 : 1, total: 1,
        })));
      })
      .catch((error) => { if (active) addToast({ title: 'Test history unavailable', description: error instanceof Error ? error.message : 'Backend unavailable.', type: 'error' }); });
    return () => { active = false; };
  }, [simulationTab, selectedAgentId, testCases, addToast]);

  const filtered = testCases.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  const selected = testCases.find((t) => t.id === selectedTestId) ?? filtered[0];
  const passed = testCases.filter((t) => t.status === 'passed').length;
  const failed = testCases.filter((t) => t.status === 'failed').length;
  const pending = testCases.filter((t) => t.status === 'pending').length;
  const running = testCases.filter((t) => t.status === 'running').length;

  return (
      <div className="h-full w-full bg-[var(--retell-bg)] overflow-hidden flex">
      <div className="flex-1 min-w-0 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Test scenarios</h2>
              <p className="text-sm text-slate-500 mt-1">Run realistic callers against the current agent and call flow.</p>
            </div>
              <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setTestCallOpen(true)}>Live test call</Button>
              <Button variant="outline" size="sm" onClick={runAllTests} className="gap-1.5">
                <Play size={13} /> Run all
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus size={13} /> New test
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Passed', value: passed, tone: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              { label: 'Failed', value: failed, tone: 'text-rose-600 bg-rose-50 border-rose-100' },
              { label: 'Not run', value: pending, tone: 'text-slate-600 bg-white border-slate-200' },
              { label: 'Running', value: running, tone: 'text-blue-600 bg-blue-50 border-blue-100' },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl border px-4 py-3 ${s.tone}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
                <p className="text-2xl font-semibold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-6 border-b border-slate-200 mb-5">
            {(['cases', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSimulationTab(tab)}
                className={`pb-2.5 text-sm font-medium transition-colors ${simulationTab === tab ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {tab === 'cases' ? 'Test Cases' : 'Batch Testing History'}
              </button>
            ))}
          </div>

          {simulationTab === 'cases' ? (
            <div className="grid grid-cols-[1.1fr_0.9fr] gap-5">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 focus-within:bg-white focus-within:border-blue-300">
                    <Search size={14} className="text-slate-400" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tests" className="bg-transparent text-sm w-full outline-none" />
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTestId(t.id)}
                      className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors ${selected?.id === t.id ? 'bg-blue-50/70' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                        <StatusPill status={t.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{t.persona}</p>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="p-10 text-center text-sm text-slate-400">No tests match that search.</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 overflow-y-auto">
                {selected ? (
                  <>
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{selected.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{selected.persona}</p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => runTest(selected.id)}>
                        <Play size={12} /> Run
                      </Button>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Caller script</p>
                    <p className="text-sm text-slate-700 mb-3 leading-relaxed">{selected.script}</p>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Expected outcome</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{selected.expectedOutcome}</p>

                    <div className="border-t border-slate-100 mt-4 pt-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        Test transcript
                        {selected.status === 'running' && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        )}
                      </p>
                      <TranscriptPanel turns={selected.transcript ?? []} status={selected.status} />
                    </div>

                    {(selected.status === 'passed' || selected.status === 'failed') && (
                      <div className={`mt-4 rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm font-semibold ${selected.status === 'passed' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {selected.status === 'passed' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {selected.status === 'passed' ? 'Test passed' : 'Test failed'}
                        {selected.lastRun && (
                          <span className="ml-auto font-normal text-xs flex items-center gap-1 opacity-70">
                            <Clock size={11} />{selected.lastRun}{selected.duration ? ` · ${selected.duration}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                    {selected.reason && <p className="mt-2 text-xs leading-relaxed text-slate-500">{selected.reason}</p>}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Select a test case.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Run</th>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Passed</th>
                    <th className="px-4 py-3 font-medium">Failed</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...savedRuns, ...batchRuns].map((b) => (
                    <tr key={b.id} className="border-t border-slate-50 hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-900">{b.name}</td>
                      <td className="px-4 py-3 text-slate-500">{b.ranAt}</td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">{b.passed}</td>
                      <td className="px-4 py-3 text-rose-600 font-medium">{b.failed}</td>
                      <td className="px-4 py-3">{b.total}</td>
                    </tr>
                  ))}
                  {savedRuns.length + batchRuns.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No scenario runs yet. Run all scenarios to record your first result.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New test case" subtitle="Describe a caller and what a good outcome looks like.">
        <div className="space-y-3">
          <input className="ui-input" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="ui-input" placeholder="Persona" value={draft.persona} onChange={(e) => setDraft({ ...draft, persona: e.target.value })} />
          <textarea className="ui-input h-20 resize-none" placeholder="Caller script" value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} />
          <textarea className="ui-input h-16 resize-none" placeholder="Expected outcome" value={draft.expectedOutcome} onChange={(e) => setDraft({ ...draft, expectedOutcome: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => {
              if (!draft.name.trim()) return;
              void addTestCase(draft);
              setCreateOpen(false);
              setDraft({ name: '', persona: '', script: '', expectedOutcome: '' });
            }}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
