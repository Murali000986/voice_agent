import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { readApiResponse } from '@/lib/api';

type Source = { id: string; title: string; content: string; updated_at: string };

export function KnowledgeBasePanel() {
  const { selectedAgentId, addToast } = useUiStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [title, setTitle] = useState('Business information');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!selectedAgentId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgentId}/knowledge`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Knowledge sources could not be loaded.');
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backend unavailable.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [selectedAgentId]);

  const saveSource = async (sourceTitle: string, sourceContent: string) => {
    if (!selectedAgentId) {
      addToast({ title: 'Save the agent first', description: 'Then add knowledge sources to that agent.', type: 'info' });
      return;
    }
    const cleanTitle = sourceTitle.trim();
    const cleanContent = sourceContent.trim();
    if (!cleanTitle || !cleanContent) {
      addToast({ title: 'Add a title and some text', type: 'info' });
      return;
    }
    if (cleanContent.length > 100_000) {
      addToast({ title: 'Text is too large', description: 'Each knowledge source can contain up to 100,000 characters.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgentId}/knowledge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle, content: cleanContent }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Knowledge source could not be saved.');
      setSources((current) => [data as Source, ...current]);
      setContent('');
      addToast({ title: 'Knowledge source saved', description: 'The agent can now use this information in calls.', type: 'success' });
    } catch (cause) {
      addToast({ title: 'Could not save knowledge', description: cause instanceof Error ? cause.message : 'Backend unavailable.', type: 'error' });
    } finally { setSaving(false); }
  };

  const removeSource = async (source: Source) => {
    if (!selectedAgentId) return;
    try {
      const response = await fetch(`/api/agents/${selectedAgentId}/knowledge/${source.id}`, { method: 'DELETE' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Knowledge source could not be removed.');
      setSources((current) => current.filter((item) => item.id !== source.id));
      addToast({ title: 'Knowledge source removed', type: 'success' });
    } catch (cause) {
      addToast({ title: 'Could not remove knowledge', description: cause instanceof Error ? cause.message : 'Backend unavailable.', type: 'error' });
    }
  };

  const readFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!/\.(txt|md|csv)$/i.test(file.name)) {
        addToast({ title: `${file.name} was skipped`, description: 'Upload a plain text, Markdown, or CSV file.', type: 'info' });
        continue;
      }
      try { await saveSource(file.name, await file.text()); }
      catch { addToast({ title: `${file.name} could not be read`, type: 'error' }); }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {!selectedAgentId && <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">Save this agent to attach knowledge sources. Sources are stored securely with the agent and used to answer callers’ questions.</p>}

      <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
        <p className="text-xs font-semibold text-slate-800">Add business information</p>
        <input className="ui-input" aria-label="Knowledge source title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
        <textarea className="ui-input min-h-24 resize-y" aria-label="Knowledge source content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Services, hours, pricing guidance, policies, FAQs…" maxLength={100000} />
        <div className="flex justify-between items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={!selectedAgentId || saving} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-blue-700 disabled:opacity-50"><Upload size={12} />Upload text file</button>
          <button onClick={() => void saveSource(title, content)} disabled={saving || !content.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Save source</button>
        </div>
        <input ref={fileRef} type="file" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" multiple className="hidden" onChange={(event) => void readFiles(event.target.files)} />
      </div>

      <div className="flex items-center justify-between px-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saved sources</p><span className="text-[10px] text-slate-400">{sources.length}</span></div>
      {loading ? <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" />Loading sources…</div> : error ? <p role="alert" className="px-2 py-2 text-xs text-rose-700">{error}</p> : sources.length === 0 ? <p className="rounded-lg bg-slate-50 px-3 py-3 text-[11px] leading-relaxed text-slate-500">No knowledge saved yet. Add service details, FAQs, or other information callers may need.</p> : (
        <div className="space-y-2">
          {sources.map((source) => <article key={source.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-start gap-2"><FileText size={13} className="mt-0.5 shrink-0 text-blue-600" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-semibold text-slate-800">{source.title}</p><button aria-label={`Remove ${source.title}`} onClick={() => void removeSource(source)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={12} /></button></div><p className="mt-1 whitespace-pre-wrap line-clamp-4 text-[10px] leading-relaxed text-slate-500">{source.content}</p></div></div>
          </article>)}
        </div>
      )}
      <button onClick={() => fileRef.current?.click()} disabled={!selectedAgentId || saving} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"><Plus size={12} />Add file source</button>
    </div>
  );
}
