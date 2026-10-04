import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Phone, PhoneCall, Settings2 } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

type TelephonyHealth = { capabilities?: { phone_calls?: boolean; phone_number_configured?: boolean } };

export function PhoneProvisioningPanel() {
  const { agentSettings, selectedAgentId, addToast } = useUiStore();
  const [health, setHealth] = useState<TelephonyHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [number, setNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [lastCall, setLastCall] = useState<{ status: string; phone_number: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/health')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Backend unavailable')))
      .then((data) => { if (active) setHealth(data); })
      .catch(() => { if (active) setHealth(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const connected = Boolean(health?.capabilities?.phone_calls);
  const numberReady = Boolean(health?.capabilities?.phone_number_configured);

  const placeCall = async () => {
    if (!selectedAgentId || !consent) return;
    setPlacing(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgentId}/outbound-calls`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: number, consent_confirmed: consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'The call could not be placed.');
      setLastCall({ status: data.status, phone_number: data.phone_number });
      setNumber('');
      setConsent(false);
      addToast({ title: 'Call requested', description: `${data.phone_number} · ${data.status}`, type: 'success' });
    } catch (cause) {
      addToast({ title: 'Call could not be placed', description: cause instanceof Error ? cause.message : 'Backend unavailable.', type: 'error' });
    } finally { setPlacing(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <Phone size={14} className="text-slate-500" />
        <p className="text-[13px] font-semibold text-slate-800">Phone calling</p>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold ${loading ? 'bg-white text-slate-500 border-slate-200' : connected ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-white text-slate-500 border-slate-200'}`}>
          {loading ? 'Checking' : connected ? 'Twilio configured' : 'Not connected'}
        </span>
      </div>
      <div className="px-3 py-3 bg-white">
        {agentSettings.phoneNumber && <p className="font-semibold text-slate-900 font-mono text-sm mb-2">{agentSettings.phoneNumber}</p>}
        <div className="flex items-start gap-2">
          {connected ? <CheckCircle2 size={15} className="mt-0.5 text-emerald-600 shrink-0" /> : <Settings2 size={15} className="mt-0.5 text-slate-400 shrink-0" />}
          <p className="text-xs text-slate-500 leading-relaxed">
            {connected
              ? numberReady ? 'Twilio credentials and a caller ID are configured on the server. Your backend must have a PUBLIC_BASE_URL (e.g. ngrok) set in .env to receive Twilio webhook callbacks.' : 'Twilio account credentials are configured. Add a verified caller ID in backend/.env to enable calls.'
              : 'Phone numbers are not purchased automatically. Add Twilio credentials, a verified caller ID, and a PUBLIC_BASE_URL (e.g. via ngrok) to backend/.env before enabling real calls.'}
          </p>
        </div>
        {!connected && <p className="mt-2 ml-[22px] text-[10px] text-slate-400">No number has been bought or assigned by this dashboard.</p>}
        {connected && numberReady && selectedAgentId && <div className="mt-4 border-t border-slate-100 pt-3 space-y-2.5">
          <p className="text-xs font-semibold text-slate-800">Place an outbound call</p>
          <input className="ui-input" type="tel" inputMode="tel" placeholder="+14155550123" aria-label="Recipient phone number" value={number} onChange={(event) => setNumber(event.target.value)} />
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600"><input type="checkbox" className="mt-0.5 accent-blue-600" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I confirm this contact agreed to receive an automated call.</span></label>
          <button onClick={() => void placeCall()} disabled={placing || !consent || !/^\+[1-9][0-9]{7,14}$/.test(number)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{placing ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}{placing ? 'Starting call…' : 'Call contact'}</button>
          {lastCall && <p role="status" className="text-[11px] text-slate-500">Last request: {lastCall.phone_number} · {lastCall.status}</p>}
          <p className="text-[10px] leading-relaxed text-slate-400">The selected agent must be published. Enter the number in international format. Call and consent rules vary by location.</p>
        </div>}
      </div>
    </div>
  );
}
