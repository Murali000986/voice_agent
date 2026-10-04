export type DemoCall = {
  id: string;
  date: string;
  time: string;
  persona: string;
  phone: string;
  duration: string;
  outcome: 'qualified' | 'callback' | 'not-a-fit' | 'voicemail' | 'unknown';
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  transcript: { speaker: 'Agent' | 'Caller'; text: string; ts: string }[];
};

export const demoCalls: DemoCall[] = [
  {
    id: 'c-1',
    date: 'Today',
    time: '4:12 PM',
    persona: 'Inbound — florist owner',
    phone: '+1 (555) 201-4892',
    duration: '2m 18s',
    outcome: 'qualified',
    sentiment: 'positive',
    summary: 'Caller is a small florist interested in local SEO. Budget $1,500/mo. Booked discovery call.',
    transcript: [
      { speaker: 'Agent', text: 'Hi, this is Maya from Bask Growth. Do you have a couple of minutes?', ts: '0:00' },
      { speaker: 'Caller', text: 'Sure, I was just looking at your website actually.', ts: '0:06' },
      { speaker: 'Agent', text: 'Great! What kind of business are you running?', ts: '0:11' },
      { speaker: 'Caller', text: 'I have a small florist shop, mostly local customers.', ts: '0:16' },
      { speaker: 'Agent', text: 'Love it. Are you currently running any Google or social ads?', ts: '0:22' },
      { speaker: 'Caller', text: 'Just Google occasionally. Maybe $500 a month.', ts: '0:28' },
      { speaker: 'Agent', text: 'Got it. We could likely 3x that ROI. Would Thursday at 2 PM work for a discovery call?', ts: '0:35' },
      { speaker: 'Caller', text: 'Thursday works perfect, yes.', ts: '0:42' },
    ],
  },
  {
    id: 'c-2',
    date: 'Today',
    time: '3:40 PM',
    persona: 'Outbound — contractor',
    phone: '+1 (555) 834-0021',
    duration: '0m 47s',
    outcome: 'callback',
    sentiment: 'neutral',
    summary: 'Caller was on a job site. Open to a callback Friday afternoon.',
    transcript: [
      { speaker: 'Agent', text: 'Hi, this is Maya from Bask Growth. Is this a good time?', ts: '0:00' },
      { speaker: 'Caller', text: "I'm on a job site right now, can't really talk.", ts: '0:05' },
      { speaker: 'Agent', text: 'No problem at all! Would Friday afternoon work for a quick chat?', ts: '0:10' },
      { speaker: 'Caller', text: 'Friday after 3 PM should be fine.', ts: '0:15' },
      { speaker: 'Agent', text: "Perfect. I'll have someone call you then. Thanks for your time!", ts: '0:19' },
    ],
  },
  {
    id: 'c-3',
    date: 'Yesterday',
    time: '6:02 PM',
    persona: 'Skeptical price shopper',
    phone: '+1 (555) 719-5530',
    duration: '3m 05s',
    outcome: 'not-a-fit',
    sentiment: 'negative',
    summary: 'Caller was hostile and refused to share budget. Agent stayed calm but could not qualify.',
    transcript: [
      { speaker: 'Agent', text: 'Hi, this is Maya from Bask Growth. Do you have a moment?', ts: '0:00' },
      { speaker: 'Caller', text: "What's your cheapest package? Just give me a number.", ts: '0:05' },
      { speaker: 'Agent', text: 'Our packages start around $799/month depending on your goals. What are you hoping to achieve?', ts: '0:12' },
      { speaker: 'Caller', text: "I'm not telling you my budget. Just send me a price list.", ts: '0:20' },
      { speaker: 'Agent', text: "Absolutely, I can email that over. What's the best address?", ts: '0:27' },
    ],
  },
  {
    id: 'c-4',
    date: 'Yesterday',
    time: '2:15 PM',
    persona: 'Home services, no website',
    phone: '+1 (555) 302-9901',
    duration: '1m 55s',
    outcome: 'qualified',
    sentiment: 'positive',
    summary: 'No website but wants more calls. Recommended starter package, captured goal.',
    transcript: [
      { speaker: 'Agent', text: 'Hi! This is Maya from Bask Growth. Is this a good time?', ts: '0:00' },
      { speaker: 'Caller', text: 'Yeah sure. I need more customers calling me.', ts: '0:06' },
      { speaker: 'Agent', text: 'We can definitely help with that. Do you have a website?', ts: '0:11' },
      { speaker: 'Caller', text: 'No website. Just word of mouth.', ts: '0:15' },
      { speaker: 'Agent', text: "That's okay! We can set up a landing page as part of the starter package.", ts: '0:20' },
    ],
  },
  {
    id: 'c-5',
    date: '2 days ago',
    time: '11:30 AM',
    persona: 'Restaurant owner',
    phone: '+1 (555) 447-1182',
    duration: '1m 12s',
    outcome: 'voicemail',
    sentiment: 'neutral',
    summary: 'Reached voicemail. Left brief message with callback number.',
    transcript: [
      { speaker: 'Agent', text: "Hi, this is Maya from Bask Growth. I'm calling about growing your restaurant's online presence. Please call us back at 1-800-BASK or visit bask.growth. Have a great day!", ts: '0:00' },
    ],
  },
  {
    id: 'c-6',
    date: '2 days ago',
    time: '9:05 AM',
    persona: 'Spa owner, inbound',
    phone: '+1 (555) 663-7720',
    duration: '2m 44s',
    outcome: 'qualified',
    sentiment: 'positive',
    summary: 'Spa owner interested in Instagram ads and local SEO. Budget $2k/mo. Booked demo.',
    transcript: [
      { speaker: 'Agent', text: 'Hi! This is Maya from Bask Growth. Do you have a couple of minutes?', ts: '0:00' },
      { speaker: 'Caller', text: 'Yes hi! I found you on Google. I have a day spa.', ts: '0:06' },
      { speaker: 'Agent', text: 'Wonderful! Are you running any paid ads currently?', ts: '0:12' },
      { speaker: 'Caller', text: "Instagram, but I stopped because I wasn't seeing results.", ts: '0:18' },
      { speaker: 'Agent', text: "That's very common. Our team specializes in exactly that. Budget range?", ts: '0:25' },
      { speaker: 'Caller', text: 'Around $2,000 a month if the results are there.', ts: '0:31' },
    ],
  },
];
