import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Loader2, Plus, Square, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal'; // Assuming this exists or we can just use a full screen fixed overlay
import { Button } from '@/components/ui/button';
import { isElevenLabsVoice } from '@/lib/voices';
import type { ElevenLabsVoice } from '@/lib/voices';
import { readApiResponse } from '@/lib/api';

interface VoiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceId: string;
  onSave: (voiceId: string) => void;
  elevenLabsVoices: ElevenLabsVoice[];
  systemVoices: SpeechSynthesisVoice[];
}

export function VoiceSelectorModal({
  isOpen,
  onClose,
  selectedVoiceId,
  onSave,
  elevenLabsVoices,
  systemVoices
}: VoiceSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<'platform' | 'custom'>('platform');
  const [draftVoiceId, setDraftVoiceId] = useState(selectedVoiceId);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [accentFilter, setAccentFilter] = useState('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Stop audio when closing or unmounting
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    if (isOpen) setDraftVoiceId(selectedVoiceId);
    else stopAudio();
  }, [isOpen, selectedVoiceId]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPlayingId(null);
  };

  const playVoice = async (voiceId: string) => {
    if (playingId === voiceId) {
      stopAudio();
      return;
    }
    stopAudio();
    setPlayingId(voiceId);

    const is11Labs = isElevenLabsVoice(voiceId, elevenLabsVoices);
    if (is11Labs) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: "Hello, thanks for calling. How can I help you today?", voice_id: voiceId })
        });
        const data = await readApiResponse(res);
        if (data.audio_base64) {
          const audio = new Audio(`data:${data.mime_type};base64,${data.audio_base64}`);
          audioRef.current = audio;
          audio.onended = () => setPlayingId(null);
          audio.onerror = () => setPlayingId(null);
          await audio.play();
        } else {
          setPlayingId(null);
        }
      } catch {
        setPlayingId(null);
      }
    } else {
      if (!('speechSynthesis' in window)) return setPlayingId(null);
      const sample = new SpeechSynthesisUtterance("Hello, thanks for calling. How can I help you today?");
      sample.voice = window.speechSynthesis.getVoices().find((v) => v.name === voiceId) || null;
      sample.onend = () => setPlayingId(null);
      sample.onerror = () => setPlayingId(null);
      window.speechSynthesis.speak(sample);
    }
  };

  if (!isOpen) return null;

  // Derive filters
  const accents = Array.from(new Set(elevenLabsVoices.map(v => v.accent))).sort();
  
  // Filter list
  let displayVoices = elevenLabsVoices;
  if (genderFilter !== 'all') displayVoices = displayVoices.filter(v => v.gender === genderFilter);
  if (accentFilter !== 'all') displayVoices = displayVoices.filter(v => v.accent === accentFilter);
  if (search) {
    const q = search.toLowerCase();
    displayVoices = displayVoices.filter(v => v.name.toLowerCase().includes(q) || v.accent.toLowerCase().includes(q));
  }

  const selectedVoice = elevenLabsVoices.find(v => v.voice_id === draftVoiceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="flex flex-col bg-slate-50 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Select Voice</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs & Toolbar */}
        <div className="flex flex-col px-6 pt-2 pb-4 bg-white border-b border-slate-200 shrink-0 space-y-4">
          <div className="flex items-center space-x-6 border-b border-slate-100">
            <button
              onClick={() => setActiveTab('platform')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'platform' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Platform Voices
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'custom' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Custom Providers
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              <Plus size={14} />
              <span>Add voice clone</span>
            </button>
            
            <div className="relative">
              <select 
                value={genderFilter} 
                onChange={e => setGenderFilter(e.target.value)}
                className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 pr-8 outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="all">Gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>

            <div className="relative">
              <select 
                value={accentFilter} 
                onChange={e => setAccentFilter(e.target.value)}
                className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 pr-8 outline-none focus:ring-1 focus:ring-primary/30 capitalize"
              >
                <option value="all">Accent</option>
                {accents.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
              </select>
            </div>

            <div className="flex-1"></div>
            
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64 bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeTab === 'custom' ? (
            <div className="text-center py-20 text-slate-500 text-sm">
              Custom providers are not configured. Use Platform Voices.
            </div>
          ) : displayVoices.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-sm">
              No voices found matching your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {displayVoices.map(voice => {
                const isActive = draftVoiceId === voice.voice_id;
                const isPlaying = playingId === voice.voice_id;
                const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${voice.name}&size=48&backgroundColor=${
                  voice.gender === 'female' ? 'fdf4ff' : 'f0f9ff'
                }`;

                return (
                  <div 
                    key={voice.voice_id}
                    onClick={() => setDraftVoiceId(voice.voice_id)}
                    className={`relative flex items-center p-3 rounded-xl border bg-white cursor-pointer transition-all ${
                      isActive 
                        ? 'border-primary ring-1 ring-primary/20 shadow-sm' 
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="relative shrink-0 w-11 h-11 rounded-full bg-slate-100 border border-slate-200">
                      <img src={avatarUrl} alt={voice.name} className="w-full h-full rounded-full object-cover" />
                      {/* Green Verified Badge on ALL avatars like Retell screenshot */}
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white rounded-full p-0.5 border border-white translate-x-1 -translate-y-0.5 shadow-sm">
                        <Check size={8} strokeWidth={4} />
                      </div>
                    </div>
                    
                    <div className="ml-3 flex-1 min-w-0">
                      <h3 className="text-[13px] font-semibold text-slate-800 truncate">{voice.name}</h3>
                      <p className="text-[11px] text-slate-500 truncate capitalize mt-0.5">
                        {voice.accent.replace('_', ' ')} · {voice.use_case === 'narration' ? 'Middle Aged' : 'Young'} · retell
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                        ID: retell-{voice.name}
                      </p>
                    </div>

                    <button 
                      onClick={(e) => { e.stopPropagation(); playVoice(voice.voice_id); }}
                      title={isPlaying ? 'Stop preview' : 'Preview voice'}
                      className={`ml-2 shrink-0 flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${
                        isPlaying
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      {isPlaying
                        ? <Square size={12} fill="currentColor" />
                        : <Play size={12} fill="currentColor" />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center">
            {selectedVoice ? (
              <>
                <div className="relative shrink-0 w-9 h-9 rounded-full bg-slate-100 border border-slate-200">
                  <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${selectedVoice.name}&size=32`} alt="Active" className="w-full h-full rounded-full object-cover" />
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white rounded-full p-[1.5px] border border-white translate-x-0.5 -translate-y-0.5 shadow-sm">
                    <Check size={6} strokeWidth={4} />
                  </div>
                </div>
                <div className="ml-3">
                  <h4 className="text-[13px] font-semibold text-slate-800">{selectedVoice.name}</h4>
                  <p className="text-[11px] text-slate-500 capitalize">{selectedVoice.accent.replace('_', ' ')} · {selectedVoice.use_case === 'narration' ? 'Middle Aged' : 'Young'} · retell</p>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">No voice selected</p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center text-xs text-slate-600 space-x-1.5 mr-4">
              <span className="opacity-60">Expressive mode</span>
              <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer hover:bg-slate-200">Off ⏷</span>
            </div>
            <div className="flex items-center text-xs text-slate-600 cursor-pointer hover:text-slate-800 mr-2">
              More Settings ⏷
            </div>
            
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs font-medium bg-white">Cancel</Button>
            <Button 
              size="sm" 
              className="h-8 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => {
                onSave(draftVoiceId);
                onClose();
              }}
            >
              Save
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
