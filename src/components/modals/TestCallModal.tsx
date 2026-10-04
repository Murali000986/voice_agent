import { useEffect, useRef, useState } from 'react';
import {
  AudioLines, Check, Loader2, Mic, MicOff, Phone, PhoneCall, PhoneOff,
  Send, Volume2, VolumeX, ChevronDown
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { VoiceSelectorModal } from './VoiceSelectorModal';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/store/uiStore';
import { useWorkflowStore } from '@/store/workflowStore';
import { fetchElevenLabsVoices, getVoicesSync, type ElevenLabsVoice } from '@/lib/voices';

type Line = { from: 'agent' | 'user'; text: string; isSystem?: boolean };
async function readApiResponse(response: Response): Promise<Record<string, any>> {
  const body = await response.text();
  if (!body.trim()) {
    if (!response.ok) throw new Error(`Server returned an empty response (${response.status}). Is the backend running?`);
    return {};
  }
  try {
    return JSON.parse(body);
  } catch {
    if (!response.ok) throw new Error(`Server error (${response.status}). Try again in a moment.`);
    throw new Error('The server returned an unreadable response. Check that the backend is running, then try again.');
  }
}
type BrowserResult = { isFinal: boolean; [index: number]: { transcript: string } };
type BrowserRecognitionEvent = Event & { resultIndex: number; results: ArrayLike<BrowserResult> };
type BrowserRecognitionError = Event & { error: string };
interface BrowserRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserRecognitionEvent) => void) | null;
  onerror: ((event: BrowserRecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognition;
  webkitSpeechRecognition?: new () => BrowserRecognition;
};

function languageTag(language: string) {
  const normalized = language.toLowerCase();
  if (normalized.includes('uk') || normalized.includes('british')) return 'en-GB';
  if (normalized.includes('english')) return 'en-US';
  if (normalized.includes('spanish')) return 'es-ES';
  if (normalized.includes('hindi')) return 'hi-IN';
  return language || 'en-US';
}

function speechConstructor() {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

const SILENCE_PROMPT = 'Hello? Are you still there?';

export function TestCallModal() {
  const { testCallOpen, setTestCallOpen, agentSettings, selectedAgentId, completeStep, addToast } = useUiStore();
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const [status, setStatus] = useState<'idle' | 'live' | 'ended'>('idle');
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [interim, setInterim] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('+919042846208');
  const [outboundStatus, setOutboundStatus] = useState<'idle' | 'calling' | 'done' | 'error'>('idle');
  const [outboundMsg, setOutboundMsg] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>(getVoicesSync());
  // selectedVoice is local call-time voice — initialized once on open, never auto-changed
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  // Initialize voice once when modal opens (not on every list change)
  const voiceInitialized = useRef(false);
  useEffect(() => {
    if (testCallOpen && !voiceInitialized.current) {
      voiceInitialized.current = true;
      setSelectedVoice(agentSettings.voice || '');
    }
    if (!testCallOpen) {
      voiceInitialized.current = false;
    }
  }, [testCallOpen, agentSettings.voice]);

  useEffect(() => {
    fetchElevenLabsVoices().then(setElevenLabsVoices);
  }, []);

  const [speechEnabled, setSpeechEnabled] = useState(true);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const sessionRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const liveRef = useRef(false);
  const busyRef = useRef(false);
  const speakingRef = useRef(false);
  const speechEnabledRef = useRef(true);
  const voiceRef = useRef('');
  // Barge-in: track the active audio element so we can stop it
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  // Silence detection
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionAvailable = Boolean(speechConstructor());
  const speechOutputAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const supported = recognitionAvailable && speechOutputAvailable;

  useEffect(() => { speechEnabledRef.current = speechEnabled; }, [speechEnabled]);
  useEffect(() => { voiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length, interim]);

  useEffect(() => {
    if (!testCallOpen || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [testCallOpen]);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const startSilenceTimer = () => {
    clearSilenceTimer();
    const timeout = Math.max(7, Math.min(agentSettings.silenceTimeout || 10, 16)) * 1000;
    silenceTimerRef.current = setTimeout(() => {
      if (liveRef.current && !busyRef.current && !speakingRef.current) {
        // Show system message and speak it
        setLines((prev) => [...prev, { from: 'agent', text: SILENCE_PROMPT, isSystem: true }]);
        void speak(SILENCE_PROMPT);
      }
    }, timeout);
  };

  // Interrupt AI speech — for barge-in
  const interruptAI = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = '';
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    setSpeaking(false);
    clearSilenceTimer();
  };

  const stopVoice = () => {
    liveRef.current = false;
    setListening(false);
    setSpeaking(false);
    speakingRef.current = false;
    setInterim('');
    clearSilenceTimer();
    try { recognitionRef.current?.abort(); } catch { /* may already be stopped */ }
    recognitionRef.current = null;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = '';
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  useEffect(() => () => stopVoice(), []);

  const beginListening = () => {
    const Recognition = speechConstructor();
    if (!Recognition || !liveRef.current || busyRef.current || speakingRef.current) return;
    if (!recognitionRef.current) {
      const recognition = new Recognition();
      recognition.lang = languageTag(agentSettings.language);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let finalText = '';
        let partialText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += result[0].transcript;
          else partialText += result[0].transcript;
        }
        setInterim(partialText.trim());
        if (finalText.trim()) {
          setInterim('');
          // Barge-in: if AI is currently speaking, interrupt it
          if (speakingRef.current) {
            interruptAI();
          }
          void sendCallerTurn(finalText.trim());
        }
      };
      recognition.onerror = (event) => {
        setListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError('Microphone access was blocked. Allow it in your browser to speak, or keep typing in this call.');
          liveRef.current = false;
        } else if (event.error === 'network') {
          setVoiceError('Your browser speech service is unavailable. Keep typing in this call or try the microphone again later.');
          liveRef.current = false;
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setVoiceError('Speech recognition stopped. You can try the microphone again or continue by text.');
        }
      };
      recognition.onend = () => {
        setListening(false);
        if (liveRef.current && !busyRef.current && !speakingRef.current) {
          window.setTimeout(() => beginListening(), 180);
        }
      };
      recognitionRef.current = recognition;
    }
    try {
      recognitionRef.current.start();
      setListening(true);
      setVoiceError('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'InvalidStateError') return;
      setVoiceError('Could not start speech recognition. Check your microphone permission and try again.');
      setListening(false);
    }
  };

  const speak = async (text: string, preferredVoice?: string) => {
    if (!speechEnabledRef.current) return;
    clearSilenceTimer();
    const isElevenLabs = elevenLabsVoices.some(v => v.voice_id === (preferredVoice || voiceRef.current));

    if (isElevenLabs) {
      setSpeaking(true);
      speakingRef.current = true;
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice_id: preferredVoice || voiceRef.current })
        });
        const data = await readApiResponse(res);
        if (!res.ok) {
          setVoiceError(data.detail || 'ElevenLabs TTS Error');
        } else if (data.audio_base64) {
          const audio = new Audio(`data:${data.mime_type};base64,${data.audio_base64}`);
          activeAudioRef.current = audio;
          await new Promise<void>(resolve => {
            audio.onended = () => { activeAudioRef.current = null; resolve(); };
            audio.onerror = () => { activeAudioRef.current = null; resolve(); };
            audio.play().catch(() => { activeAudioRef.current = null; resolve(); });
          });
        }
      } catch (e) {
        setVoiceError(e instanceof Error ? e.message : 'ElevenLabs TTS Network Error');
      } finally {
        setSpeaking(false);
        speakingRef.current = false;
        // Start silence timer after AI finishes speaking
        if (liveRef.current) startSilenceTimer();
      }
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageTag(agentSettings.language);
      utterance.rate = 1;
      utterance.pitch = 1;
      const chosen = window.speechSynthesis.getVoices().find((voice) => voice.name === (preferredVoice || voiceRef.current));
      if (chosen) utterance.voice = chosen;
      speakingRef.current = true;
      setSpeaking(true);
      const finish = () => {
        speakingRef.current = false;
        setSpeaking(false);
        // Start silence timer after AI finishes speaking
        if (liveRef.current) startSilenceTimer();
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
      window.setTimeout(finish, Math.max(3000, text.length * 100));
    });
  };

  const sendCallerTurn = async (text: string) => {
    const currentSession = sessionRef.current;
    if (!text || !currentSession || busyRef.current) return;
    clearSilenceTimer();
    busyRef.current = true;
    setBusy(true);
    setListening(false);
    setInterim('');
    try { recognitionRef.current?.stop(); } catch { /* may already be stopped */ }
    setLines((current) => [...current, { from: 'user', text }]);
    try {
      const response = await fetch(`/api/calls/${currentSession}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_text: text }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Could not get an agent response.');
      const agentText = String(data.agent_text || '');
      setLines((current) => [...current, { from: 'agent', text: agentText }]);
      if (speechEnabledRef.current) await speak(agentText);
      if (data.ended) {
        stopVoice();
        setStatus('ended');
        liveRef.current = false;
        sessionRef.current = null;
        setSessionId(null);
        addToast({ title: 'Test call saved', description: 'The transcript is available in call history.', type: 'success' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backend unavailable.';
      setVoiceError(message);
      addToast({ title: 'Agent response failed', description: message, type: 'error' });
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (liveRef.current && recognitionAvailable && !speakingRef.current) beginListening();
    }
  };

  const connectTranscriptionStream = (agentId: string) => {
    if (wsRef.current) wsRef.current.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/calls/stream-transcripts/${agentId}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.speaker && data.text) {
          setLines(current => [...current, { from: data.speaker === 'Caller' ? 'user' : 'agent', text: data.text }]);
        }
      } catch (e) {}
    };
    wsRef.current = ws;
  };

  const callMyPhone = async () => {
    const digits = phoneNumber.replace(/[\s\-().]/g, '');
    const e164 = digits.startsWith('+') ? digits : `+${digits}`;
    if (!/^\+[1-9][0-9]{7,14}$/.test(e164)) {
      setOutboundMsg('Enter a valid international number, e.g. +919042842080');
      setOutboundStatus('error');
      return;
    }
    setOutboundStatus('calling');
    setOutboundMsg('');
    try {
      const res = await fetch('/api/calls/outbound?test_call=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: e164, agent_id: selectedAgentId || '' }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.detail || 'Outbound call failed.');
      setOutboundStatus('done');
      setOutboundMsg(`Calling ${e164}… SID: ${data.call_sid}`);
      addToast({ title: 'Calling your phone', description: `Twilio is dialling ${e164}`, type: 'success' });
      
      setStatus('live');
      setLines([]);
      if (selectedAgentId) connectTranscriptionStream(selectedAgentId);
    } catch (err) {
      setOutboundStatus('error');
      setOutboundMsg(err instanceof Error ? err.message : 'Call failed.');
    }
  };

  const start = async () => {
    setBusy(true);
    busyRef.current = true;
    setVoiceError('');
    try {
      const response = await fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: selectedAgentId || '',
          agent_settings: { ...agentSettings, system_prompt: agentSettings.systemPrompt, max_duration_minutes: agentSettings.maxCallDuration },
          nodes,
          edges,
          source: 'browser',
          caller_number: 'browser test',
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Could not start the test call.');
      setSessionId(data.session_id);
      sessionRef.current = data.session_id;
      const initialLines = (data.transcript || []).map((turn: { speaker: string; text: string }) => ({
        from: turn.speaker === 'Caller' ? 'user' as const : 'agent' as const,
        text: turn.text,
      }));
      setLines(initialLines);
      liveRef.current = true;
      setStatus('live');
      completeStep('test');
      if (recognitionAvailable || speechOutputAvailable) {
        busyRef.current = false;
        setBusy(false);
        const greeting = initialLines.find((line: Line) => line.from === 'agent')?.text;
        if (greeting) await speak(greeting, typeof data.voice === 'string' ? data.voice : undefined);
        if (recognitionAvailable) beginListening();
        else setVoiceError('Microphone speech recognition is unavailable here. You can type in this call; agent replies can still be spoken if browser speech output is available.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backend unavailable.';
      setVoiceError(message);
      addToast({ title: 'Test call could not start', description: message, type: 'error' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const end = async () => {
    stopVoice();
    liveRef.current = false;
    const currentSession = sessionRef.current;
    let saved = !currentSession;
    if (currentSession) {
      try {
        const response = await fetch(`/api/calls/${currentSession}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome: 'unknown' }),
        });
        if (!response.ok) throw new Error('Could not save this call.');
        saved = true;
      } catch (error) {
        addToast({ title: 'Call could not be saved', description: error instanceof Error ? error.message : 'Backend unavailable.', type: 'error' });
      }
    }
    sessionRef.current = null;
    setSessionId(null);
    setStatus('ended');
    if (saved) addToast({ title: 'Test call saved', description: 'The transcript is available in call history.', type: 'success' });
  };

  const close = async () => {
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }
    if (sessionRef.current) await end();
    else stopVoice();
    setTestCallOpen(false);
    setStatus('idle');
    setLines([]);
    setDraft('');
    setVoiceError('');
    setSessionId(null);
  };

  const toggleMicrophone = () => {
    if (listening) {
      try { recognitionRef.current?.stop(); } catch { /* may already be stopped */ }
      liveRef.current = false;
      setListening(false);
    } else {
      liveRef.current = true;
      beginListening();
    }
  };

  // Handle typed barge-in: if user sends text while AI is speaking, interrupt
  const handleSendTurn = (text: string) => {
    if (!text.trim()) return;
    if (speakingRef.current) interruptAI();
    void sendCallerTurn(text.trim());
    setDraft('');
  };

  return (
    <Modal open={testCallOpen} onClose={close} title="Test your agent" subtitle="Talk or type in one call. Every turn appears in the transcript." width="max-w-2xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><AudioLines size={15} className="text-blue-600" /> Combined voice and text</div>
        {speechOutputAvailable && (
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-slate-500" />
            
            <button 
              onClick={() => { if (status !== 'live') setVoiceModalOpen(true); }}
              disabled={status === 'live'}
              className="flex items-center justify-between min-w-[180px] px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-lg text-xs text-slate-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                {elevenLabsVoices.find(v => v.voice_id === selectedVoice) ? (
                  <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${elevenLabsVoices.find(v => v.voice_id === selectedVoice)!.name}&size=18`} className="w-4 h-4 rounded-full border border-slate-200 bg-slate-100" alt="Avatar" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-300 border-dashed bg-slate-50 flex items-center justify-center shrink-0">
                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                  </div>
                )}
                <span className="font-medium">
                  {elevenLabsVoices.find(v => v.voice_id === selectedVoice)?.name || selectedVoice || 'Select voice...'}
                </span>
              </div>
              <ChevronDown size={14} className="text-slate-400 ml-2" />
            </button>
            <VoiceSelectorModal
              isOpen={voiceModalOpen}
              onClose={() => setVoiceModalOpen(false)}
              selectedVoiceId={selectedVoice}
              elevenLabsVoices={elevenLabsVoices}
              systemVoices={voices}
              onSave={setSelectedVoice}
            />
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
          <p className="text-[11px] text-blue-900 leading-relaxed">
            {supported
              ? 'Speak or type as the caller. Interrupting the agent while it speaks will stop it immediately.'
              : recognitionAvailable
              ? 'Browser speech output is unavailable. Type or speak as the caller; text replies will still appear in the transcript.'
              : 'Microphone speech recognition is unavailable in this browser. You can still type and see every reply in the transcript.'}
          </p>
          <button onClick={() => setSpeechEnabled((value) => !value)} disabled={!speechOutputAvailable} className="text-[11px] font-semibold text-blue-700 flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60" aria-pressed={speechEnabled && speechOutputAvailable}>
            {speechEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            Agent speech {!speechOutputAvailable ? 'unavailable' : speechEnabled ? 'on' : 'off'}
          </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 h-[360px] flex flex-col overflow-hidden">
        <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-800">{agentSettings.name}</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">Voice and text conversation</span>
          </div>
          {status === 'live' ? (
            <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 live-pulse" />
              {speaking ? 'Agent speaking — interrupt anytime' : listening ? 'Listening' : busy ? 'Thinking' : 'Connected'}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 capitalize">{status === 'ended' ? 'Call ended' : 'Ready'}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {status === 'idle' && lines.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center px-6 gap-5">
              <div className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3 mx-auto">
                  <Phone size={20} className="text-slate-700" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Ready when you are</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">Start the call, then speak or type. You can interrupt the AI anytime.</p>
              </div>
              <div className="w-full max-w-sm border border-slate-200 rounded-xl bg-white p-4 text-left shadow-sm">
                <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><PhoneCall size={13} className="text-emerald-600" /> Call my real phone (Twilio)</p>
                <div className="flex gap-2">
                  <input
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value); setOutboundStatus('idle'); setOutboundMsg(''); }}
                    placeholder="+919042842080"
                    className="ui-input flex-1 text-sm"
                  />
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0"
                    onClick={() => void callMyPhone()}
                    disabled={outboundStatus === 'calling'}
                  >
                    {outboundStatus === 'calling' ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}
                    {outboundStatus === 'calling' ? 'Calling…' : 'Call'}
                  </Button>
                </div>
                {outboundMsg && (
                  <p className={`mt-2 text-[11px] leading-relaxed ${
                    outboundStatus === 'error' ? 'text-red-600' : 'text-emerald-700'
                  }`}>{outboundMsg}</p>
                )}
              </div>
            </div>
          )}
          {lines.map((line, index) => (
            <div key={`${index}-${line.from}`} className={`flex ${line.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                line.from === 'user'
                  ? 'bg-slate-900 text-white'
                  : line.isSystem
                  ? 'bg-amber-50 border border-amber-200 text-amber-800 shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
              }`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5 opacity-50">
                  {line.from === 'user' ? 'You' : line.isSystem ? 'System' : agentSettings.name}
                </p>
                {line.text}
              </div>
            </div>
          ))}
          {interim && (
            <div className="flex justify-end"><div className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] text-slate-500 bg-blue-50 border border-blue-100 italic">{interim}…</div></div>
          )}
          {busy && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" /> Preparing the next response…</div>}
          <div ref={transcriptEndRef} />
        </div>

        {voiceError && <div role="status" className="px-4 py-2 text-[11px] leading-relaxed text-amber-800 bg-amber-50 border-t border-amber-100">{voiceError}</div>}

        {status === 'live' && (
          <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <Button size="sm" variant={listening ? 'secondary' : 'outline'} onClick={toggleMicrophone} disabled={!recognitionAvailable || busy} aria-label={listening ? 'Pause microphone' : 'Start microphone'} title={recognitionAvailable ? 'Speak to the agent' : 'Speech recognition is unavailable in this browser'}>{listening ? <MicOff size={14} /> : <Mic size={14} />}</Button>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleSendTurn(draft); }}
              placeholder={listening ? 'Speak or type — press Enter to send…' : 'Type what the caller says…'}
              className="ui-input"
            />
            <Button size="sm" onClick={() => handleSendTurn(draft)} disabled={busy || !draft.trim()} aria-label="Send caller message"><Send size={14} /></Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 gap-3">
        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Mic size={13} className="shrink-0" /> <span className="truncate">{recognitionAvailable ? 'Microphone ready — speak to interrupt' : 'Type to speak · microphone unavailable'}</span></span>
        <div className="flex gap-2 shrink-0">
          {status === 'idle' && <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={() => void start()} disabled={busy}><Phone size={13} />{busy ? 'Starting…' : 'Start test'}</Button>}
          {status === 'live' && <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => void end()}><PhoneOff size={13} /> End test</Button>}
          {status === 'ended' && <Button size="sm" variant="outline" onClick={() => void close()}><Check size={13} /> Done</Button>}
        </div>
      </div>
    </Modal>
  );
}
