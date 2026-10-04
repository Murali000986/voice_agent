import { useEffect, useState, type ReactNode } from 'react';
import { Phone, CheckCircle2, XCircle, Voicemail, PhoneCall, ChevronRight, TrendingUp, Clock, Bot, User } from 'lucide-react';
import { type DemoCall } from '@/data/demoCalls';
import { useUiStore } from '@/store/uiStore';

const outcomeMeta: Record<DemoCall['outcome'], { label: string; cls: string; icon: ReactNode }> = {
  qualified: { label: 'Qualified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 size={11} /> },
  callback: { label: 'Callback', cls: 'bg-amber-50 text-amber-700 border-amber-100', icon: <PhoneCall size={11} /> },
  'not-a-fit': { label: 'Not a fit', cls: 'bg-rose-50 text-rose-700 border-rose-100', icon: <XCircle size={11} /> },
  voicemail: { label: 'Voicemail', cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: <Voicemail size={11} /> },
  unknown: { label: 'Not classified', cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: <Phone size={11} /> },
};

const sentimentDot: Record<DemoCall['sentiment'], string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-amber-400',
  negative: 'bg-rose-500',
};

function OutcomePill({ outcome }: { outcome: DemoCall['outcome'] }) {
  const m = outcomeMeta[outcome];
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function TranscriptDrawer({ call, onClose }: { call: DemoCall; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="flex h-full w-full flex-col bg-white shadow-xl sm:w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <p className="font-semibold text-slate-900">{call.persona}</p>
            <p className="text-xs text-slate-500 mt-0.5">{call.phone} · {call.date}, {call.time} · {call.duration}</p>
          </div>
          <button aria-label="Close call transcript" onClick={onClose} className="mt-0.5 text-lg leading-none text-slate-400 hover:text-slate-700">×</button>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Outcome</span><OutcomePill outcome={call.outcome} /></div>
          <p className="text-xs text-slate-600 leading-relaxed">{call.summary}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {call.transcript.map((t, i) => (
            <div key={i} className={`flex gap-2 items-start ${t.speaker !== 'Agent' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex size-6 shrink-0 items-center justify-center rounded-full ${t.speaker === 'Agent' ? 'bg-slate-100' : 'bg-blue-100'}`}>
                {t.speaker === 'Agent' ? <Bot size={12} className="text-slate-700" /> : <User size={12} className="text-blue-600" />}
              </div>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${t.speaker === 'Agent' ? 'bg-slate-100 text-slate-800' : 'bg-blue-50 text-blue-900'}`}>
                {t.text}
                <span className="block text-[10px] opacity-40 mt-0.5">{t.ts}</span>
              </div>
            </div>
          ))}
          {call.transcript.length === 0 && <p className="text-sm text-slate-500">No transcript was recorded for this call.</p>}
        </div>
      </div>
    </div>
  );
}

export function CallsView() {
  const selectedAgentId = useUiStore((state) => state.selectedAgentId);
  const setTestCallOpen = useUiStore((state) => state.setTestCallOpen);
  const [selected, setSelected] = useState<DemoCall | null>(null);
  const [calls, setCalls] = useState<DemoCall[]>([]);
  const [query, setQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    const endpoint = selectedAgentId ? `/api/calls?agent_id=${encodeURIComponent(selectedAgentId)}` : '/api/calls';
    fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) throw new Error('Call history unavailable');
        return response.json();
      })
      .then((data) => {
        if (!active || !Array.isArray(data.calls)) return;
        const saved = data.calls.map((row: {
          id: string; timestamp: string; source?: string; caller_number?: string; duration_seconds?: number;
          outcome?: string; sentiment?: string; summary?: string; transcript?: string;
        }): DemoCall => {
          const date = new Date(row.timestamp);
          let transcript: DemoCall['transcript'] = [];
          try { transcript = typeof row.transcript === 'string' ? JSON.parse(row.transcript) : row.transcript || []; } catch { transcript = []; }
          const outcome = ['qualified', 'callback', 'not-a-fit', 'voicemail', 'unknown'].includes(row.outcome || '')
            ? row.outcome as DemoCall['outcome'] : 'unknown';
          const sentiment = ['positive', 'neutral', 'negative'].includes(row.sentiment || '')
            ? row.sentiment as DemoCall['sentiment'] : 'neutral';
          const seconds = row.duration_seconds || 0;
          return {
            id: row.id,
            date: Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(),
            time: Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            persona: row.caller_number === 'browser test' ? 'Browser test call' : row.source || 'Phone call',
            phone: row.caller_number || '—',
            duration: `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`,
            outcome,
            sentiment,
            summary: row.summary || 'Call completed.',
            transcript,
          };
        });
        setCalls(saved);
        setLoadError('');
      })
      .catch(() => { if (active) setLoadError('Call history could not load. Check that the backend is running and refresh this page.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedAgentId]);

  const qualified = calls.filter((c) => c.outcome === 'qualified').length;
  const totalDurationMins = calls.reduce((acc, c) => {
    const [m, s] = c.duration.replace('m', '').replace('s', '').trim().split(' ');
    return acc + parseInt(m) + parseInt(s) / 60;
  }, 0);
  const visibleCalls = calls.filter((call) => {
    const transcriptText = call.transcript.map((turn) => turn.text).join(' ');
    const matchesQuery = `${call.persona} ${call.phone} ${call.summary} ${transcriptText}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (outcomeFilter === 'all' || call.outcome === outcomeFilter);
  });

  return (
    <div className="h-full w-full bg-[var(--retell-bg)] overflow-y-auto">
      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-1">Call History</h2>
        <p className="mb-6 text-pretty text-sm text-slate-500">{selectedAgentId ? 'Calls for the selected agent.' : 'All saved calls in this workspace.'} Select a call to review its transcript and summary.</p>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: <Phone size={16} className="text-slate-500" />, label: 'Total calls', value: loading ? '—' : calls.length },
            { icon: <TrendingUp size={16} className="text-emerald-600" />, label: 'Qualified', value: loading ? '—' : `${qualified} / ${calls.length}` },
            { icon: <Clock size={16} className="text-blue-500" />, label: 'Avg duration', value: loading ? '—' : `${(calls.length ? totalDurationMins / calls.length : 0).toFixed(1)}m` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">{s.icon}</div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</p>
                <p className="text-lg font-semibold text-slate-900 mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-3 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
            <input aria-label="Search calls" className="ui-input max-w-sm text-sm" placeholder="Search callers and transcripts" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select aria-label="Filter calls by outcome" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600" value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
              <option value="all">All outcomes</option>
              <option value="qualified">Qualified</option>
              <option value="callback">Callback</option>
              <option value="not-a-fit">Not a fit</option>
              <option value="voicemail">Voicemail</option>
              <option value="unknown">Not classified</option>
            </select>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Caller</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Sentiment</th>
                <th className="px-4 py-3 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {visibleCalls.map((c) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open call from ${c.persona}, ${c.date}, outcome ${outcomeMeta[c.outcome].label}`}
                  onClick={() => setSelected(c)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(c); } }}
                  className="cursor-pointer border-t border-slate-50 transition-colors hover:bg-slate-50/80 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{c.date}</p>
                    <p className="text-[11px] text-slate-400">{c.time}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{c.persona}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{c.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.duration}</td>
                  <td className="px-4 py-3"><OutcomePill outcome={c.outcome} /></td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs capitalize text-slate-600">
                      <span className={`h-2 w-2 rounded-full ${sentimentDot[c.sentiment]}`} />
                      {c.sentiment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <ChevronRight size={14} />
                  </td>
                </tr>
              ))}
              {visibleCalls.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  {loading ? 'Loading call history…' : loadError || (calls.length ? 'No calls match these filters.' : <span className="flex flex-col items-center gap-3"><span>No calls yet. Run a browser voice test to see your first transcript here.</span><button onClick={() => setTestCallOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><Phone size={13} />Start a voice test</button></span>)}
                </td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      {selected && <TranscriptDrawer call={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
