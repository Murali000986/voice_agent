import type { Edge, Node } from '@xyflow/react';

export const initialNodes: Node[] = [
  {
    id: 'node-1',
    type: 'conversation',
    position: { x: 40, y: 180 },
    data: {
      label: 'Greeting',
      prompt:
        'This call\'s direction is {{direction}} (either "inbound" or "outbound").\n\nIf direction is "outbound": Clearly introduce yourself, name the business you represent, explain the reason for the call, and ask if it is a good time to talk.\n\nIf direction is "inbound": Thank the caller for contacting the business and ask how you can help today.',
      transition:
        'Caller is willing to continue or asks about a business service',
    },
  },
  {
    id: 'node-2',
    type: 'conversation',
    position: { x: 460, y: 40 },
    data: {
      label: 'Discover Business Basics',
      prompt:
        "Ask about the caller's organization and needs one at a time. Don't re-ask what they already shared.",
      transition: 'Caller described their organization or declined to share',
    },
  },
  {
    id: 'node-4',
    type: 'function',
    position: { x: 460, y: 430 },
    data: {
      label: 'Lookup CRM',
        description: 'Look up the caller in the connected customer record system, if available.',
      transition: 'Record found or not found',
    },
  },
  {
    id: 'node-3',
    type: 'conversation',
    position: { x: 880, y: 120 },
    data: {
      label: 'Understand goals and requirements',
      prompt:
        'Ask about the caller’s primary goal, relevant requirements, and desired timeline. Ask about budget only when relevant. Keep it conversational.',
      transition: 'Caller answered or declined to share their goals and requirements',
    },
  },
  {
    id: 'node-5',
    type: 'logicSplit',
    position: { x: 1280, y: 160 },
    data: {
      label: 'Is this a fit?',
      description: 'The caller has a relevant need and meets the confirmed qualification criteria',
    },
  },
  {
    id: 'node-6',
    type: 'ending',
    position: { x: 1640, y: 40 },
    data: {
      label: 'Offer a next step',
      description: 'Summarize the caller’s need, offer an appropriate follow-up, and end warmly.',
    },
  },
  {
    id: 'node-7',
    type: 'ending',
    position: { x: 1640, y: 320 },
    data: {
      label: 'Not a fit',
      description: 'Thank them, offer an appropriate resource when available, and close the call.',
    },
  },
];

export const initialEdges: Edge[] = [
  { id: 'edge-1-2', source: 'node-1', target: 'node-2', type: 'smoothstep' },
  { id: 'edge-1-4', source: 'node-1', target: 'node-4', type: 'smoothstep' },
  { id: 'edge-2-3', source: 'node-2', target: 'node-3', type: 'smoothstep' },
  { id: 'edge-3-5', source: 'node-3', target: 'node-5', type: 'smoothstep' },
  { id: 'edge-5-6', source: 'node-5', target: 'node-6', sourceHandle: 'yes', type: 'smoothstep', label: 'Yes' },
  { id: 'edge-5-7', source: 'node-5', target: 'node-7', sourceHandle: 'no', type: 'smoothstep', label: 'No' },
];
