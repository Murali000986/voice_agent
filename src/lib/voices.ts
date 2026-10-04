/**
 * Shared ElevenLabs voice catalogue with retry logic.
 * Cached in module scope so all components share one fetch.
 */

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  gender: string;
  accent: string;
  use_case: string;
};

import { readApiResponse } from '@/lib/api';

// Curated fallback — matches backend catalogue exactly.
// Shown immediately so UI never shows an empty list even if backend is slow.
export const FALLBACK_VOICES: ElevenLabsVoice[] = [
  // ── Female ──────────────────────────────────────────────────────────────────
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',    gender: 'female', accent: 'american',    use_case: 'narration' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',     gender: 'female', accent: 'american',    use_case: 'narration' },
  { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',      gender: 'female', accent: 'american',    use_case: 'conversational' },
  { voice_id: 'piTKgcLEGmPE4e6mEKli', name: 'Nicole',    gender: 'female', accent: 'american',    use_case: 'meditation' },
  { voice_id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', accent: 'swedish',     use_case: 'conversational' },
  { voice_id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',     gender: 'female', accent: 'british',     use_case: 'news_presenter' },
  { voice_id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda',   gender: 'female', accent: 'american',    use_case: 'narration' },
  { voice_id: 'jBpfuIE2acCO8z3wKNLl', name: 'Freya',     gender: 'female', accent: 'american',    use_case: 'conversational' },
  { voice_id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace',     gender: 'female', accent: 'southern_us', use_case: 'conversational' },
  { voice_id: 'wViXBPUzp2ZZixB1xQuM', name: 'Serena',    gender: 'female', accent: 'american',    use_case: 'interactive' },
  { voice_id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda',    gender: 'female', accent: 'american',    use_case: 'narration' },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',      gender: 'female', accent: 'american',    use_case: 'narration' },
  // ── Male ────────────────────────────────────────────────────────────────────
  { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni',    gender: 'male',   accent: 'american',    use_case: 'narration' },
  { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh',      gender: 'male',   accent: 'american',    use_case: 'conversational' },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold',    gender: 'male',   accent: 'american',    use_case: 'narration' },
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',      gender: 'male',   accent: 'american',    use_case: 'narration' },
  { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam',       gender: 'male',   accent: 'american',    use_case: 'conversational' },
  { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',    gender: 'male',   accent: 'british',     use_case: 'news_presenter' },
  { voice_id: 'g5CIjZEefAph4nQFvHAz', name: 'Ethan',     gender: 'male',   accent: 'american',    use_case: 'conversational' },
  { voice_id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry',     gender: 'male',   accent: 'american',    use_case: 'conversational' },
  { voice_id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',      gender: 'male',   accent: 'american',    use_case: 'narration' },
  { voice_id: 'bVMeCyTHy58xNoL34h3p', name: 'Jeremy',    gender: 'male',   accent: 'american',    use_case: 'conversational' },
  { voice_id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Michael',   gender: 'male',   accent: 'american',    use_case: 'audiobook' },
  { voice_id: 'jsCqWAovK2LkecY7zXl4', name: 'Fin',       gender: 'male',   accent: 'irish',       use_case: 'conversational' },
  { voice_id: 't0jbNlBVZ17f02VDIeMI', name: 'Jessie',    gender: 'male',   accent: 'american',    use_case: 'conversational' },
  { voice_id: 'zrHiDhphv9ZnVXBqCLjz', name: 'Giovanni',  gender: 'male',   accent: 'italian',     use_case: 'narration' },
];

let _cache: ElevenLabsVoice[] | null = null;
let _fetchPromise: Promise<ElevenLabsVoice[]> | null = null;

export async function fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  if (_cache) return _cache;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('/api/voice/elevenlabs');
        if (!res.ok) break;
        const data = await readApiResponse(res);
        if (Array.isArray(data.voices) && data.voices.length > 0) {
          _cache = data.voices as ElevenLabsVoice[];
          return _cache;
        }
        break;
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    // Serve fallback if backend unreachable
    _cache = FALLBACK_VOICES;
    return _cache;
  })();

  return _fetchPromise;
}

/** Sync get: returns fallback immediately then hydrates from backend. */
export function getVoicesSync(): ElevenLabsVoice[] {
  return _cache ?? FALLBACK_VOICES;
}

export function isElevenLabsVoice(voiceId: string, voices: ElevenLabsVoice[]): boolean {
  return voices.some(v => v.voice_id === voiceId);
}

export function groupByGender(voices: ElevenLabsVoice[]) {
  const female = voices.filter(v => v.gender === 'female');
  const male = voices.filter(v => v.gender === 'male');
  return { female, male };
}
