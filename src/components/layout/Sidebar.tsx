import {
  AudioLines, Bot, CheckCircle2, ChevronDown, ChevronUp, Circle,
  FlaskConical, HelpCircle, Home, PhoneCall, Settings2, Workflow, History,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/uiStore';

const navigation = [
  { id: 'home' as const, label: 'Home', icon: Home },
  { id: 'agents' as const, label: 'Saved agents', icon: History },
  { id: 'agent' as const, label: 'Agent builder', icon: Bot },
  { id: 'workflow' as const, label: 'Call flow', icon: Workflow },
  { id: 'simulation' as const, label: 'Test scenarios', icon: FlaskConical },
  { id: 'calls' as const, label: 'Call history', icon: PhoneCall },
];

const setupSteps = [
  { id: 'name', label: 'Name your agent' },
  { id: 'voice', label: 'Choose a voice' },
  { id: 'greeting', label: 'Write a greeting' },
  { id: 'knowledge', label: 'Add business knowledge' },
  { id: 'test', label: 'Run a voice test' },
  { id: 'publish', label: 'Publish your agent' },
];

export function Sidebar() {
  const { activeView, setActiveView, completedSteps, gettingStartedOpen, toggleGettingStarted } = useUiStore();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const done = setupSteps.filter((step) => completedSteps.includes(step.id)).length;

  return (
    <aside className="z-50 flex h-full w-16 shrink-0 flex-col border-r border-slate-200 bg-white text-[14px] md:w-[248px]">
      <div className="p-4 pb-3">
        <div className="mb-5 flex items-center gap-2.5 text-[15px] font-bold text-slate-950">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
            <AudioLines size={17} strokeWidth={2.3} />
          </span>
          <span className="hidden md:inline">Bask <span className="font-medium text-slate-400">Voice Studio</span></span>
        </div>
        <button
          aria-label="Switch workspace"
          aria-expanded={workspaceOpen}
          onClick={() => setWorkspaceOpen((value) => !value)}
          className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 transition-colors hover:bg-slate-50"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">W</div>
          <div className="hidden min-w-0 flex-1 flex-col items-start overflow-hidden md:flex">
            <span className="text-[11px] leading-none text-slate-500">Workspace</span>
            <span className="mt-1 w-full truncate text-left text-sm font-semibold leading-tight text-slate-900">Bask Digital Agency</span>
          </div>
          <span className="hidden md:inline">{workspaceOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}</span>
        </button>
        {workspaceOpen && (
          <div className="mt-2 hidden rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 md:block">
            Current workspace <span className="mt-0.5 block font-medium text-slate-700">Bask Digital Agency</span>
          </div>
        )}
      </div>

      <div className="px-3 pt-3">
        <p className="mb-2 hidden px-3 text-[10px] font-bold uppercase text-slate-400 md:block">Workspace</p>
        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => {
            const selected = activeView === id || (id === 'agent' && activeView === 'workflow');
            return (
              <button
                key={id}
                aria-label={label}
                aria-current={selected ? 'page' : undefined}
                onClick={() => setActiveView(id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left font-medium transition-colors',
                  selected ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
                title={label}
              >
                <Icon size={17} strokeWidth={selected ? 2.1 : 1.8} />
                <span className="hidden flex-1 md:inline">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-7 hidden px-3 md:block">
        <button
          aria-label="Workspace settings"
          aria-expanded={gettingStartedOpen}
          onClick={toggleGettingStarted}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left font-semibold text-slate-800 hover:bg-slate-50"
        >
          <CheckCircle2 size={16} className="text-blue-600" />
          <span className="flex-1 text-[13px]">Getting started</span>
          <span className="text-[11px] font-medium text-slate-400">{done}/{setupSteps.length}</span>
          <ChevronDown size={14} className={cn('text-slate-400 transition-transform', gettingStartedOpen && 'rotate-180')} />
        </button>
        {gettingStartedOpen && (
          <div className="mt-1 ml-[20px] flex flex-col gap-0.5 border-l border-slate-200 pl-2">
            {setupSteps.map((step) => {
              const complete = completedSteps.includes(step.id);
              return (
                <div key={step.id} className={cn('flex items-center gap-2 py-2 px-2 text-[12px]', complete ? 'text-slate-400' : 'text-slate-600')}>
                  {complete ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Circle size={14} className="text-slate-300" />}
                  <span className={complete ? 'line-through decoration-slate-300' : ''}>{step.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-auto p-3 border-t border-slate-100 flex flex-col gap-1">
        <button
          onClick={() => setActiveView('settings')}
          className={cn('flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors', activeView === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}
        >
          <Settings2 size={16} /> <span className="hidden md:inline">Workspace settings</span>
        </button>
        <button aria-label="Help and support" title="Help and support" className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs text-slate-500 hover:bg-slate-50">
          <HelpCircle size={15} /> <span className="hidden md:inline">Help and support</span>
        </button>
        <div className="mt-1 flex items-center gap-2.5 border-t border-slate-100 px-3 pt-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">WS</span>
          <span className="hidden min-w-0 md:block"><span className="block text-xs font-semibold text-slate-700">Bask admin</span><span className="block text-[10px] text-slate-400">Bask Digital Agency</span></span>
        </div>
      </div>
    </aside>
  );
}
