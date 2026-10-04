import type { Node, Edge } from '@xyflow/react';
import { ShieldAlert, Book, Webhook, Code2 } from 'lucide-react';

export const agentNodes: Node[] = [
  {
    id: 'trigger',
    type: 'trigger',
    position: { x: -80, y: 300 },
    data: {}
  },
  {
    id: 'pre-call',
    type: 'action',
    position: { x: 100, y: 250 },
    data: {
      label: 'Pre-call functions',
      icon: Code2,
      description: 'Look up data before the call starts, so your agent has context before it speaks.',
      colorClass: 'border-red-200',
      headerBg: 'border-red-50 bg-[#FFF5F8]',
      textClass: 'text-red-700'
    }
  },
  {
    id: 'add-knowledge',
    type: 'floatingAdd',
    position: { x: 500, y: 140 },
    data: { label: 'Add knowledge base', icon: Book, position: 'bottom' }
  },
  {
    id: 'agent',
    type: 'agentCenter',
    position: { x: 520, y: 300 },
    data: {}
  },
  {
    id: 'add-webhook',
    type: 'floatingAdd',
    position: { x: 525, y: 460 },
    data: { label: 'Add webhook', icon: Webhook, position: 'top' }
  },
  {
    id: 'extraction',
    type: 'extraction',
    position: { x: 740, y: 50 },
    data: {}
  },
  {
    id: 'post-call',
    type: 'action',
    position: { x: 1080, y: 250 },
    data: {
      label: 'Post-call functions',
      icon: Code2,
      description: 'Update your systems after the call ends, like logging the outcome or creating follow-ups.',
      colorClass: 'border-blue-200',
      headerBg: 'border-blue-50 bg-[#F4F9FF]',
      textClass: 'text-blue-700'
    }
  }
];

export const agentEdges: Edge[] = [
  { id: 'e-t-p', source: 'trigger', target: 'pre-call', type: 'smoothstep', style: { strokeDasharray: '4, 4' }, label: '' },
  { id: 'e-p-a', source: 'pre-call', target: 'agent', type: 'smoothstep', label: 'Call started', labelStyle: { fill: '#6B7280', fontSize: 11, fontWeight: 500 } },
  { id: 'e-ak-a', source: 'add-knowledge', target: 'agent', targetHandle: 'top', type: 'straight', style: { strokeDasharray: '4, 4' } },
  { id: 'e-aw-a', source: 'add-webhook', target: 'agent', targetHandle: 'bot', type: 'straight', style: { strokeDasharray: '4, 4' } },
  { id: 'e-a-e', source: 'agent', target: 'extraction', type: 'step', label: 'Call ended', labelStyle: { fill: '#6B7280', fontSize: 11, fontWeight: 500 } },
  { id: 'e-e-p', source: 'extraction', target: 'post-call', type: 'smoothstep', style: { strokeDasharray: '4, 4' } }
];
