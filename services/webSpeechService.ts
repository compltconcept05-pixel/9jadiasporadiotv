/**
 * Web Speech API Service - Browser Native TTS
 * Fallback for when ElevenLabs quota is exceeded
 * Free, unlimited, works in all modern browsers
 */

export interface WebSpeechConfig {
    voice?: SpeechSynthesisVoice;
    rate?: number;
    pitch?: number;
    volume?: number;
    lang?: string;
}

/**
 * Get available voices from browser
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices();
}

/**
 * Select best female voice for Sara Obosa
 */
export function selectSaraObosaVoice(): SpeechSynthesisVoice | null {
    const voices = getAvailableVoices();

    // Preference order for Sara Obosa (professional female newsroom voice)
    const preferences = [
        'Google UK English Female',
        'Microsoft Zira',
        'Samantha',
        'Victoria',
        'Karen',
        'Moira',
        'Tessa',
        'Fiona'
    ];

    // Try to find preferred voices
    for (const pref of preferences) {
        const voice = voices.find(v => v.name.includes(pref));
        if (voice) {
            console.log(`🎙️ [WebSpeech] Selected voice: ${voice.name}`);
            return voice;
        }
    }

    // Fallback: any female English voice
    const femaleVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('woman'))
    );

    if (femaleVoice) {
        console.log(`🎙️ [WebSpeech] Selected fallback voice: ${femaleVoice.name}`);
        return femaleVoice;
    }

    // Last resort: first English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
        console.log(`🎙️ [WebSpeech] Selected default voice: ${englishVoice.name}`);
        return englishVoice;
    }

    console.warn('⚠️ [WebSpeech] No suitable voice found, using browser default');
    return null;
}

/**
 * Generate speech using browser Web Speech API
 * Returns a promise that resolves when speech completes
 */
export async function generateWebSpeech(
    text: string,
    config?: WebSpeechConfig
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
            reject(new Error('Web Speech API not supported in this browser'));
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Configure voice
        const voice = config?.voice || selectSaraObosaVoice();
        if (voice) {
            utterance.voice = voice;
        }

        // Professional newsroom settings
        utterance.rate = config?.rate ?? 0.9;  // Slightly slower for clarity
        utterance.pitch = config?.pitch ?? 1.0; // Natural pitch
        utterance.volume = config?.volume ?? 1.0; // Full volume
        utterance.lang = config?.lang ?? 'en-US';

        // Event handlers
        utterance.onend = () => {
            console.log('✅ [WebSpeech] Speech completed');
            resolve();
        };

        utterance.onerror = (event) => {
            console.error('❌ [WebSpeech] Speech error:', event.error);
            reject(new Error(`Web Speech Error: ${event.error}`));
        };

        utterance.onstart = () => {
            console.log('🎙️ [WebSpeech] Speech started');
        };

        // Speak
        console.log(`🎙️ [WebSpeech] Speaking ${text.length} characters...`);
        window.speechSynthesis.speak(utterance);
    });
}

/**
 * Stop any ongoing speech
 */
export function stopWebSpeech(): void {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        console.log('🛑 [WebSpeech] Speech stopped');
    }
}

/**
 * Check if Web Speech API is available
 */
export function isWebSpeechAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Load voices when they become available
if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        console.log(`🎙️ [WebSpeech] Voices loaded: ${getAvailableVoices().length} available`);
    };
}
