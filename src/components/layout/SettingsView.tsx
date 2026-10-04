import { useEffect, useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Bell, KeyRound, User } from 'lucide-react';
import { PhoneProvisioningPanel } from './PhoneProvisioningPanel';

export function SettingsView() {
  const { agentSettings, updateAgentSettings, setActiveView, addToast } = useUiStore();
  const [notifs, setNotifs] = useState([true, true, false]);
  const [health, setHealth] = useState<{ status: string; capabilities: Record<string, boolean> } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/health')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Backend unavailable')))
      .then((data) => { if (active) setHealth(data); })
      .catch(() => { if (active) setHealth(null); })
      .finally(() => { if (active) setHealthLoading(false); });
    return () => { active = false; };
  }, []);

  const integrations = [
    { label: 'Agent responses', detail: 'LLM provider', key: 'call_simulation' },
    { label: 'Phone speech recognition', detail: 'Deepgram STT', key: 'transcription' },
    { label: 'Phone spoken responses', detail: 'Deepgram TTS', key: 'text_to_speech' },
    { label: 'Phone calls', detail: 'Twilio telephony', key: 'phone_calls' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#f4f6f9]">
      <div className="max-w-3xl mx-auto py-10 px-8">
        <button
          onClick={() => setActiveView('agent')}
          className="text-xs font-semibold text-slate-500 mb-5 hover:text-slate-800 inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={13} /> Back to editor
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1">Workspace settings</h1>
        <p className="text-sm text-slate-500 mb-8">Manage your workspace and see which voice services are ready.</p>

        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900">Profile</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">Workspace</span>
              <input className="ui-input" defaultValue="Bask Digital Agency" />
            </label>
            <label className="text-sm space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">Default language</span>
              <input
                className="ui-input"
                value={agentSettings.language}
                onChange={(e) => updateAgentSettings({ language: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900">Service connections</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">Connection status only. Add provider keys to <code className="text-slate-700">backend/.env</code>; secret values stay on the server.</p>
          <div className="divide-y divide-slate-100">
            {integrations.map((service) => {
              const configured = Boolean(health?.capabilities?.[service.key]);
              return (
                <div key={service.key} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{service.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{service.detail}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${healthLoading ? 'bg-slate-50 text-slate-500 border-slate-200' : configured ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {healthLoading ? 'Checking…' : health ? configured ? 'Key configured' : 'Not connected' : 'Backend unavailable'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">Browser voice tests use your browser’s speech recognition and voice output. Deepgram and Twilio keys are only needed for server-side phone calling.</p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-semibold text-slate-900">Telephony</h2>
          </div>
          <PhoneProvisioningPanel />
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900">Notifications</h2>
          </div>
          {['Email me when a test fails', 'Slack when an agent is published', 'Weekly quality digest'].map((label, i) => (
            <label key={label} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
              <span className="text-sm text-slate-700">{label}</span>
              <Switch
                checked={notifs[i]}
                onCheckedChange={(v) => setNotifs((prev) => prev.map((x, idx) => (idx === i ? v : x)))}
              />
            </label>
          ))}
          <div className="flex justify-end mt-5">
            <Button size="sm" onClick={() => addToast({ title: 'Settings saved', type: 'success' })}>
              Save changes
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
