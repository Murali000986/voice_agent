import { useEffect, useState, type ReactNode } from 'react';
import {
  Bot,
  Book,
  Speech,
  FileText,
  Headset,
  Scissors,
  ShieldAlert,
  Webhook,
  ChevronDown,
  Play,
  Square,
  Loader2,
  Trash2,
  PanelRightClose,
} from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { NodeSettings } from './NodeSettings';
import { KnowledgeBasePanel } from './KnowledgeBasePanel';
import { Switch } from '@/components/ui/switch';
import { fetchElevenLabsVoices, getVoicesSync, groupByGender, type ElevenLabsVoice } from '@/lib/voices';
import { VoiceSelectorModal } from '../modals/VoiceSelectorModal';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 mb-3">
      <span className="text-[11px] font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'ui-input';

export function GlobalSettings() {
  const { inspectorTab, setInspectorTab, agentSettings, updateAgentSettings, completeStep, addToast, setInspectorOpen } = useUiStore();
  const [open, setOpen] = useState<string | null>('Agent Settings');
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Start with fallback voices immediately, hydrate from backend
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>(getVoicesSync());
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  useEffect(() => {
    fetchElevenLabsVoices().then(setElevenLabsVoices);
  }, []);

  const toggle = (label: string) => setOpen((v) => (v === label ? null : label));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const refreshVoices = () => setSystemVoices(window.speechSynthesis.getVoices());
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
  }, []);

  const sections = [
    {
      icon: Bot,
      label: 'Agent Settings',
      body: (
        <>
          <Field label="Agent name">
            <input
              className={inputClass}
              value={agentSettings.name}
              onChange={(e) => {
                updateAgentSettings({ name: e.target.value });
                completeStep('name');
              }}
            />
          </Field>
          <Field label="Language">
            <select
              className={inputClass}
              value={agentSettings.language}
              onChange={(e) => updateAgentSettings({ language: e.target.value })}
            >
              <option>English (US)</option>
              <option>English (UK)</option>
              <option>Spanish</option>
              <option>Hindi</option>
            </select>
          </Field>
          <Field label="Response model">
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Managed by the configured backend provider. Check Workspace settings for connection status.</p>
          </Field>
          <Field label={`Temperature (${agentSettings.temperature.toFixed(1)})`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={agentSettings.temperature}
              onChange={(e) => updateAgentSettings({ temperature: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </Field>
          <Field label="Opening line">
            <textarea
              className={`${inputClass} h-24 resize-none`}
              value={agentSettings.greeting}
              onChange={(e) => updateAgentSettings({ greeting: e.target.value })}
            />
          </Field>
          <Field label="Agent instructions">
            <textarea
              className={`${inputClass} h-28 resize-y`}
              value={agentSettings.systemPrompt}
              onChange={(e) => updateAgentSettings({ systemPrompt: e.target.value })}
              placeholder="Describe the agent's role, tone, and call goals."
            />
          </Field>
        </>
      ),
    },
    {
      icon: Book,
      label: 'Knowledge Base',
      body: <KnowledgeBasePanel />,
    },
    {
      icon: Speech,
      label: 'Speech Settings',
      body: (
        <>
          <div className="flex flex-col gap-2 relative">
            <label className="text-[11px] font-semibold text-slate-800">Voice & Language</label>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md shrink-0 text-xs text-slate-700 cursor-not-allowed opacity-80 h-9">
                <span className="text-sm">🇺🇸</span>
                <span>English (US)</span>
                <ChevronDown size={14} className="text-slate-400 ml-0.5" />
              </div>
              
              <button 
                onClick={() => setVoiceModalOpen(true)}
                className="flex items-center justify-between flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-md text-xs text-slate-700 transition-all h-9"
              >
                <div className="flex items-center gap-2.5">
                  {elevenLabsVoices.find(v => v.voice_id === agentSettings.voice) ? (
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${elevenLabsVoices.find(v => v.voice_id === agentSettings.voice)!.name}&size=18`} className="w-5 h-5 rounded-full border border-slate-200 bg-white" alt="Avatar" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-dashed bg-white flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                    </div>
                  )}
                  <span className="font-medium text-slate-700">
                    {elevenLabsVoices.find(v => v.voice_id === agentSettings.voice)?.name || agentSettings.voice || 'Select voice...'}
                  </span>
                </div>
                <ChevronDown size={14} className="text-slate-400 ml-1" />
              </button>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">Click the Voice button to explore and preview high quality TTS voices.</p>
          </div>
          
          <VoiceSelectorModal
            isOpen={voiceModalOpen}
            onClose={() => setVoiceModalOpen(false)}
            selectedVoiceId={agentSettings.voice}
            elevenLabsVoices={elevenLabsVoices}
            systemVoices={systemVoices}
            onSave={(voiceId) => {
              updateAgentSettings({ voice: voiceId });
              completeStep('voice');
            }}
          />

          <Field label={`Interruption sensitivity (${agentSettings.interruptionSensitivity.toFixed(1)})`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={agentSettings.interruptionSensitivity}
              onChange={(e) => updateAgentSettings({ interruptionSensitivity: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </Field>
        </>
      ),
    },
    {
      icon: FileText,
      label: 'Realtime Transcription Settings',
      body: (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-700">Browser speech for test calls</p>
          <p className="text-[10px] leading-relaxed text-slate-500 mt-1">Phone transcription uses Deepgram when its server key is configured. See Workspace settings for connection status.</p>
        </div>
      ),
    },
    {
      icon: Headset,
      label: 'Call Settings',
      body: (
        <>
          <Field label="Silence timeout (seconds)">
            <input
              type="number"
              className={inputClass}
              value={agentSettings.silenceTimeout}
              onChange={(e) => updateAgentSettings({ silenceTimeout: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max call duration (minutes)">
            <input
              type="number"
              className={inputClass}
              value={agentSettings.maxCallDuration}
              onChange={(e) => updateAgentSettings({ maxCallDuration: Number(e.target.value) })}
            />
          </Field>
        </>
      ),
    },
    {
      icon: Scissors,
      label: 'Post Call Extraction',
      body: (
        <>
          {agentSettings.extractionFields.map((f, i) => (
            <div key={f} className="flex items-center gap-2 mb-2">
              <input
                className={inputClass}
                value={f}
                onChange={(e) => {
                  const next = [...agentSettings.extractionFields];
                  next[i] = e.target.value;
                  updateAgentSettings({ extractionFields: next });
                }}
              />
            </div>
          ))}
          <button
            onClick={() =>
              updateAgentSettings({ extractionFields: [...agentSettings.extractionFields, 'new_field'] })
            }
            className="text-xs font-semibold text-blue-600"
          >
            + Add field
          </button>
        </>
      ),
    },
    {
      icon: ShieldAlert,
      label: 'Security & Fallback Settings',
      body: (
        <>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 mb-3">
            <span className="text-[13px] font-semibold text-slate-700">HIPAA mode</span>
            <Switch checked={agentSettings.hipaa} onCheckedChange={(hipaa) => updateAgentSettings({ hipaa })} />
          </label>
          <Field label="Fallback message">
            <textarea
              className={`${inputClass} h-20 resize-none`}
              value={agentSettings.fallbackMessage}
              onChange={(e) => updateAgentSettings({ fallbackMessage: e.target.value })}
            />
          </Field>
        </>
      ),
    },
    {
      icon: Webhook,
      label: 'Webhook Settings',
      body: (
        <>
          <Field label="Endpoint URL">
            <input
              className={inputClass}
              value={agentSettings.webhookUrl}
              onChange={(e) => updateAgentSettings({ webhookUrl: e.target.value })}
            />
          </Field>
          <p className="text-[11px] text-gray-400 mb-2">Events</p>
          {['call.started', 'call.ended', 'transcript.ready', 'extraction.ready'].map((ev) => (
            <label key={ev} className="flex items-center gap-2 text-[13px] text-gray-700 mb-1.5">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={agentSettings.webhookEvents.includes(ev)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...agentSettings.webhookEvents, ev]
                    : agentSettings.webhookEvents.filter((x) => x !== ev);
                  updateAgentSettings({ webhookEvents: next });
                }}
              />
              {ev}
            </label>
          ))}
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white text-slate-800">
      <div className="flex items-center gap-1 mx-2 mt-2 shrink-0">
        <div className="flex flex-1 gap-1 rounded-full p-1 bg-slate-100">
          <button
            onClick={() => setInspectorTab('global')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all ${
              inspectorTab === 'global' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
            }`}
          >
            Global
          </button>
          <button
            onClick={() => setInspectorTab('node')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all ${
              inspectorTab === 'node' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
            }`}
          >
            Node
          </button>
        </div>
        <button
          onClick={() => setInspectorOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Hide inspector"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      {inspectorTab === 'global' ? (
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sections.map((item) => {
            const isOpen = open === item.label;
            return (
              <div key={item.label} className="border-b border-gray-50">
                <button
                  onClick={() => toggle(item.label)}
                  className="w-full flex items-center justify-between px-3 py-3.5 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={16} className="text-gray-500" />
                    <span className="text-[13px] font-semibold text-gray-800">{item.label}</span>
                  </div>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <div className="px-3 pb-4">{item.body}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <NodeSettings />
      )}
    </div>
  );
}
