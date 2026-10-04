export const NODE_CATALOG = [
  { type: 'conversation', label: 'Conversation', color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', header: 'bg-pink-50/80', accent: '#db2777' },
  { type: 'subagent', label: 'Subagent', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-50/80', accent: '#16a34a' },
  { type: 'function', label: 'Function', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-50/80', accent: '#9333ea' },
  { type: 'callTransfer', label: 'Call Transfer', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-50/80', accent: '#f97316' },
  { type: 'pressDigit', label: 'Press Digit', color: 'text-sky-500', bg: 'bg-sky-50', border: 'border-sky-200', header: 'bg-sky-50/80', accent: '#0ea5e9' },
  { type: 'logicSplit', label: 'Logic Split', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-50/80', accent: '#2563eb' },
  { type: 'agentTransfer', label: 'Agent Transfer', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-50/80', accent: '#ea580c' },
  { type: 'inCallSms', label: 'In-Call SMS', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'bg-yellow-50/80', accent: '#ca8a04' },
  { type: 'extractVariable', label: 'Extract Variable', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', header: 'bg-slate-50/80', accent: '#475569' },
  { type: 'code', label: 'Code', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', header: 'bg-slate-50/80', accent: '#334155' },
  { type: 'mcp', label: 'MCP', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', header: 'bg-indigo-50/80', accent: '#4f46e5' },
  { type: 'ending', label: 'Ending', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-50/80', accent: '#059669' },
  { type: 'note', label: 'Note', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-50/80', accent: '#d97706' },
] as const;

export type FlowNodeType = (typeof NODE_CATALOG)[number]['type'];

export function getNodeMeta(type: string) {
  return NODE_CATALOG.find((n) => n.type === type) ?? NODE_CATALOG[0];
}
