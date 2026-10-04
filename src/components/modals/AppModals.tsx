import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/store/uiStore';
import { useWorkflowStore } from '@/store/workflowStore';
import { agentPathFor } from '@/lib/agentRoute';
import { readApiResponse } from '@/lib/api';

export function PublishModal() {
  const { publishOpen, setPublishOpen, environment, version, addToast, completeStep, selectedAgentId, agentSettings, setVersion } = useUiStore();
  const [notes, setNotes] = useState('');
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    if (!selectedAgentId) {
      addToast({ title: 'Save the agent first', description: 'Create or save this agent before publishing a release.', type: 'info' });
      return;
    }
    setPublishing(true);
    try {
      const { nodes, edges } = useWorkflowStore.getState();
      const response = await fetch(`/api/agents/${selectedAgentId}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment, notes,
          agent_settings: {
            name: agentSettings.name, description: agentSettings.description,
            greeting: agentSettings.greeting, system_prompt: agentSettings.systemPrompt,
            voice: agentSettings.voice, language: agentSettings.language.toLowerCase().includes('english') ? 'en-US' : agentSettings.language,
            temperature: agentSettings.temperature, max_duration_minutes: agentSettings.maxCallDuration,
          },
          nodes, edges,
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : data.detail?.message || [...(data.detail?.errors || []), ...(data.detail?.warnings || [])].join(' ');
        throw new Error(detail || 'The release could not be saved.');
      }
      setVersion(data.version.toUpperCase());
      completeStep('publish');
      addToast({ title: `Published ${data.version} to ${environment}`, description: notes || 'This release snapshot is saved and can be reviewed in agent history.', type: 'success' });
      setPublishOpen(false);
      setNotes('');
    } catch (cause) {
      addToast({ title: 'Publish failed', description: cause instanceof Error ? cause.message : 'Backend unavailable.', type: 'error' });
    } finally { setPublishing(false); }
  };

  return (
    <Modal
      open={publishOpen}
      onClose={() => setPublishOpen(false)}
      title="Publish agent"
      subtitle={`Release a new version to ${environment}.`}
    >
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-sm text-slate-600">
          Current draft: <span className="font-semibold text-slate-900">{version}</span>
        </div>
        <textarea
          className="ui-input h-24 resize-none"
          placeholder="Release notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setPublishOpen(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void publish()}
            disabled={publishing}
          >
            {publishing && <Loader2 size={13} className="mr-1.5 animate-spin" />}{publishing ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function FeedbackModal() {
  const { feedbackOpen, setFeedbackOpen, addToast } = useUiStore();
  const [text, setText] = useState('');

  return (
    <Modal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="Send feedback" subtitle="Tell us what is working and what is not.">
      <textarea
        className="ui-input h-28 resize-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="I wish this editor could…"
      />
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={() => setFeedbackOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            addToast({ title: 'Thanks for the feedback', type: 'success' });
            setFeedbackOpen(false);
            setText('');
          }}
        >
          Send
        </Button>
      </div>
    </Modal>
  );
}

export function ShareModal() {
  const { shareOpen, setShareOpen, addToast, selectedAgentId, agentSettings } = useUiStore();
  const link = selectedAgentId ? new URL(agentPathFor(agentSettings.name, selectedAgentId), window.location.origin).toString() : '';

  return (
    <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Copy agent link" subtitle="Share a direct link for this agent in your workspace.">
      <div className="flex gap-2">
        <input readOnly value={link || 'Save this agent to create a link'} className="ui-input bg-slate-50" />
        <Button
          size="sm"
          disabled={!link}
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(() => addToast({ title: 'Agent link copied', description: link, type: 'success' })).catch(() => addToast({ title: 'Could not copy agent link', type: 'error' }));
          }}
        >
          Copy
        </Button>
      </div>
    </Modal>
  );
}
