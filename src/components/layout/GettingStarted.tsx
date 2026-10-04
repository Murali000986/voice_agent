import { Check, ChevronUp, Sparkles } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

const STEPS = [
  { id: 'name', title: 'Name your agent', hint: 'Set this in Global Settings.' },
  { id: 'voice', title: 'Pick a voice', hint: 'Speech Settings → Voice.' },
  { id: 'greeting', title: 'Write a greeting', hint: 'Edit the Greeting node.' },
  { id: 'knowledge', title: 'Attach knowledge', hint: 'Add a source in Knowledge Base.' },
  { id: 'test', title: 'Run a test call', hint: 'Use Test in the toolbar.' },
  { id: 'simulate', title: 'Add a simulation', hint: 'Open the Simulation tab.' },
  { id: 'publish', title: 'Publish a version', hint: 'Ship to Staging or Production.' },
];

export function GettingStarted() {
  const {
    gettingStartedOpen,
    toggleGettingStarted,
    completedSteps,
    completeStep,
    setActiveView,
    setTestCallOpen,
    setPublishOpen,
    libraryOpen,
  } = useUiStore();
  const done = completedSteps.length;
  const total = STEPS.length;
  const pct = Math.round((done / total) * 100);

  const onStep = (id: string) => {
    if (id === 'test') setTestCallOpen(true);
    if (id === 'simulate') setActiveView('simulation');
    if (id === 'publish') setPublishOpen(true);
    completeStep(id);
  };

  return (
    <div className={`absolute bottom-5 z-30 w-[236px] pointer-events-auto ${libraryOpen ? 'left-[272px]' : 'left-5'}`}>
      {gettingStartedOpen && (
        <div className="mb-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 animate-modal-in">
          {STEPS.map((s) => {
            const checked = completedSteps.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => onStep(s.id)}
                className="w-full flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 text-left"
              >
                <span
                  className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                    checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                  }`}
                >
                  {checked && <Check size={10} />}
                </span>
                <span>
                  <span className={`block text-xs font-semibold ${checked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {s.title}
                  </span>
                  <span className="block text-[11px] text-slate-400">{s.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={toggleGettingStarted}
        className="w-full bg-white rounded-2xl shadow-lg border border-slate-200 px-3 py-3 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <Sparkles size={14} />
            Getting started
          </div>
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1">
            {done}/{total}
            <ChevronUp size={12} className={gettingStartedOpen ? '' : 'rotate-180'} />
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </button>
    </div>
  );
}
