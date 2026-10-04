import { MousePointerClick } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { getNodeMeta } from '@/data/nodeCatalog';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState } from 'react';

export function NodeSettings() {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId));
  const updateSelectedNode = useWorkflowStore((s) => s.updateSelectedNode);
  const [speakFirst, setSpeakFirst] = useState(true);
  const [skipWait, setSkipWait] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  if (!selectedNodeId || !node) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 mb-3 flex items-center justify-center text-slate-400">
          <MousePointerClick size={18} />
        </div>
        <p className="text-sm font-semibold text-slate-800">No node selected</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Click a node on the canvas or drag one from the library.</p>
      </div>
    );
  }

  const meta = getNodeMeta(node.type ?? 'conversation');
  const data = node.data as Record<string, string>;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      <div className={`rounded-xl border px-3 py-3 ${meta.bg} ${meta.border}`}>
        <p className={`text-xs font-semibold ${meta.color}`}>{meta.label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">ID {node.id}</p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-700">Name</span>
        <input
          className="ui-input"
          value={data.label ?? ''}
          onChange={(e) => updateSelectedNode({ label: e.target.value })}
        />
      </label>

      {node.type === 'conversation' && (
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Voice for this step</span>
          <select className="ui-input" value={data.voice || ''} onChange={(e) => updateSelectedNode({ voice: e.target.value })}>
            <option value="">Use agent default voice</option>
            {data.voice && !voices.some((voice) => voice.name === data.voice) && <option value={data.voice}>{data.voice} · not available for this preview</option>}
            {voices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}
          </select>
          <p className="text-[10px] leading-relaxed text-slate-500">Choose a different device voice for this part of the call. This works in browser tests; phone calls use the configured phone voice.</p>
        </label>
      )}

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-700">
          {node.type === 'conversation' ? 'Agent prompt' : 'Description'}
        </span>
        <textarea
          className="ui-input h-28 resize-none"
          value={data.prompt || data.description || ''}
          onChange={(e) =>
            updateSelectedNode(node.type === 'conversation' ? { prompt: e.target.value } : { description: e.target.value })
          }
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-700">Transition</span>
        <textarea
          className="ui-input h-20 resize-none"
          value={data.transition ?? ''}
          onChange={(e) => updateSelectedNode({ transition: e.target.value })}
        />
      </label>

      <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
        <span className="text-xs font-semibold text-slate-700">Speak first</span>
        <Switch checked={speakFirst} onCheckedChange={setSpeakFirst} />
      </label>
      <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
        <span className="text-xs font-semibold text-slate-700">Skip response wait</span>
        <Switch checked={skipWait} onCheckedChange={setSkipWait} />
      </label>
    </div>
  );
}
