// ElevenLabs TTS Service
// Handles text-to-speech conversion using ElevenLabs API

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Professional voices for anchors
// Professional voices for anchors (Authentic Nigerian Voices added by user)
const FEMALE_VOICE_ID = 'QqgW7xZ3mjIAgZVFMwJz'; // Ngozi (Calm & Descriptive - Nigerian) - Use for Favour
const MALE_VOICE_ID = '77aEIu0qStu8Jwv1EdhX';   // Ayinde (Deep and Melodic - Nigerian) - Use for Thompson
// Prev IDs: Sarah: EXAVITQu4vr4xnSDxMaL | Daniel: onwK4e9ZLuTAKqWW03F9

export interface ElevenLabsConfig {
    apiKey: string;
    voiceId?: string;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    useSpeakerBoost?: boolean;
}

/**
 * Generate speech audio from text using ElevenLabs API
 */
export async function generateSpeech(
    text: string,
    config?: Partial<ElevenLabsConfig>
): Promise<Uint8Array | null> {
    // Parse keys from env (support comma-separated list)
    let rawKeys = config?.apiKey;

    if (!rawKeys) {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            rawKeys = import.meta.env.VITE_ELEVENLABS_API_KEY;
        } else if (typeof process !== 'undefined' && process.env) {
            rawKeys = process.env.VITE_ELEVENLABS_API_KEY;
        }
    }

    rawKeys = rawKeys || '';
    const apiKeys = rawKeys.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);

    if (apiKeys.length === 0) {
        console.error('❌ [ElevenLabs] No API keys found in environment!');
        return null;
    }

    const voiceId = config?.voiceId || FEMALE_VOICE_ID;
    const modelId = config?.modelId || 'eleven_multilingual_v2';

    // Try each key in sequence
    for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        const isLastKey = i === apiKeys.length - 1;

        try {
            const preview = text.substring(0, 50);
            console.log(`🎙️ [ElevenLabs] Attempt ${i + 1}/${apiKeys.length} using key ending in ...${currentKey.slice(-4)}`);

            if (text.length > 5000) {
                console.warn(`⚠️ [ElevenLabs] Text exceeds 5000 char safety limit. Truncating...`);
                text = text.substring(0, 4990) + "...";
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            const response = await fetch(
                `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': currentKey,
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        text: text,
                        model_id: modelId,
                        voice_settings: {
                            stability: config?.stability ?? 0.4,
                            similarity_boost: config?.similarityBoost ?? 0.8,
                            use_speaker_boost: config?.useSpeakerBoost ?? true
                        },
                    }),
                }
            );
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`⚠️ [ElevenLabs] Key ...${currentKey.slice(-4)} failed (${response.status}): ${errorText.substring(0, 100)}`);

                // If unauthorized, payment required, or quota exceeded, try next key
                if (response.status === 401 || response.status === 429 || response.status === 402) {
                    if (!isLastKey) {
                        console.log(`🔄 [ElevenLabs] Rotating to next API key...`);
                        continue; // Try next key
                    } else {
                        throw new Error(`All API keys exhausted. Last error: ${response.status}`);
                    }
                } else {
                    // Start next key for other errors too, just in case
                    if (!isLastKey) continue;
                    throw new Error(`ElevenLabs API Error: ${response.status} - ${errorText}`);
                }
            }

            const audioBuffer = await response.arrayBuffer();
            if (!audioBuffer || audioBuffer.byteLength < 500) {
                if (!isLastKey) continue;
                throw new Error(`ElevenLabs returned empty or invalid buffer (${audioBuffer?.byteLength} bytes)`);
            }

            const audioData = new Uint8Array(audioBuffer);
            console.log(`✅ [ElevenLabs] Success: Received ${audioData.byteLength} bytes.`);
            return audioData;

        } catch (error: any) {
            console.error(`❌ [ElevenLabs] Error with key match ${i + 1}:`, error.message);
            if (isLastKey) {
                console.error("❌ [ElevenLabs] All keys failed. Giving up.");
                return null; // Will trigger Web Speech fallback in aiDjService
            }
        }
    }

    return null;
}

/**
 * Get available voices from ElevenLabs (optional, for future use)
 */
export async function getAvailableVoices(apiKey?: string): Promise<any[]> {
    let key = apiKey;
    if (!key) {
        if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
            key = (import.meta as any).env.VITE_ELEVENLABS_API_KEY;
        } else if (typeof process !== 'undefined' && process.env) {
            key = process.env.VITE_ELEVENLABS_API_KEY;
        }
    }

    if (!key) {
        console.error('❌ ElevenLabs API key is missing!');
        return [];
    }

    try {
        const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
            headers: {
                'xi-api-key': key,
            },
        });

        if (!response.ok) {
            console.error(`❌ Failed to fetch voices (${response.status})`);
            return [];
        }

        const data = await response.json();
        return data.voices || [];
    } catch (error) {
        console.error('❌ Failed to fetch voices:', error);
        return [];
    }
}

/**
 * Get character usage information (optional, for monitoring quota)
 */
export async function getCharacterUsage(apiKey?: string): Promise<any> {
    let key = apiKey;
    if (!key) {
        if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
            key = (import.meta as any).env.VITE_ELEVENLABS_API_KEY;
        } else if (typeof process !== 'undefined' && process.env) {
            key = process.env.VITE_ELEVENLABS_API_KEY;
        }
    }

    if (!key) {
        console.error('❌ ElevenLabs API key is missing!');
        return null;
    }

    try {
        const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
            headers: {
                'xi-api-key': key,
            },
        });

        if (!response.ok) {
            console.error(`❌ Failed to fetch usage (${response.status})`);
            return null;
        }

        const data = await response.json();
        console.log('📊 ElevenLabs usage:', data.subscription);
        return data;
    } catch (error) {
        console.error('❌ Failed to fetch usage:', error);
        return null;
    }
}
