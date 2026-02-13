
import { generateText, withRetry } from './geminiService';
import { generateSpeech } from './elevenLabsService';
import { dbService } from './dbService';
import { DjScript, NewsItem } from '../types';
import { NEWSCASTER_NAME, MANUAL_NEWSCASTER_NAME, APP_NAME, NEWS_INTRO, MANUAL_NEWS_INTRO, LEAD_ANCHOR_VOICE_ID, LEAD_ANCHOR_NAME } from '../constants';
import { WeatherData } from './newsAIService';

export async function generateDjSegment(): Promise<DjScript> {
  return withRetry(async () => {
    const prompt = `Write a 15-second radio bridge for ${APP_NAME}. 
    Host: ${NEWSCASTER_NAME}. 
    Mention the diaspora community and our voice abroad. Keep it high energy and warm.`;

    const systemInstruction = `You are ${NEWSCASTER_NAME}, a professional female news anchor for ${APP_NAME}. 
    TONE: Professional, authoritative, and distinctively West African (Nigerian). You speak with the clarity and professional rhythm of a top-tier Nigerian broadcaster.
    LANGUAGE: Use standard English but with the warmth and phrasing typical of a Nigerian news desk (e.g., using "Home front", "Across the federation", "Diasporans").
    STRICT RULE: Never read categories or timestamps (like "Politics 12:00 PM"). Only read the actual news content.
    TRANSITIONS: Move naturally between stories using "Across the federation...", "On the international scene...", "Also making headlines...", and "In other developments..." rather than numbering.`;

    const scriptText = await generateText(prompt, systemInstruction);
    const djScript: DjScript = {
      id: Math.random().toString(36).substr(2, 9),
      script: scriptText,
      timestamp: Date.now()
    };
    await dbService.addScript(djScript);
    return djScript;
  });
}

export async function getDetailedBulletinAudio(params: {
  location: string;
  localTime: string;
  newsItems: NewsItem[];
  weather?: WeatherData;
  isBrief?: boolean;
}): Promise<{ audio: Uint8Array | null, script: string }> {
  return withRetry(async () => {
    const { location, localTime, newsItems, weather, isBrief } = params;

    let fullScript = "";

    // Part 1: Intro
    fullScript += `${NEWS_INTRO} `;
    if (isBrief) {
      fullScript += `This is your headlines update from ${APP_NAME}. `;
    } else {
      fullScript += `Welcome to the ${APP_NAME} detailed news bulletin. `;
    }

    // Part 2: Weather (if available)
    if (weather) {
      fullScript += `Looking at the weather in ${weather.location}, it is currently ${weather.condition} with a temperature of ${weather.temp}. `;
    }

    // Part 3: News Stories
    if (isBrief) {
      fullScript += `Here are the latest headlines: `;
      newsItems.forEach((n, i) => {
        const transition = i === 0 ? "" : i === newsItems.length - 1 ? "And finally, " : "Also, ";
        fullScript += `${transition}${n.title}. `;
      });
      fullScript += `I'm ${NEWSCASTER_NAME}, for ${APP_NAME}.`;
    } else {
      fullScript += `Our top reports this hour, focus on Nigerian diaspora news, drawing from global publications. `;

      // Moderate limit to 3 stories for maximum stability and speed
      const storiesToRead = newsItems.slice(0, 3);

      storiesToRead.forEach((n, index) => {
        let transition = index === 0 ? "Our top story, " : index === storiesToRead.length - 1 ? "And finally, " : "In other news, ";

        // HIGHLIGHT BREAKING NEWS from Thompson or the Wire
        const isBreaking = n.category?.toLowerCase().includes('breaking') || n.id.startsWith('manual-');
        if (isBreaking) {
          transition = "We have an urgent breaking report: ";
        }

        // Aggressive cleaning
        let rawContent = n.content.replace(/[^\x00-\x7F]/g, " ").trim();
        rawContent = rawContent.replace(/^(Politics|News|Sports|Breaking|Opinion|Home Front)\s+\d{1,2}:\d{2}\s+(AM|PM)\s*-?\s*/i, "");

        let contentToRead = rawContent;
        if (rawContent.length > 600) {
          const cutPoint = rawContent.lastIndexOf('.', 600);
          contentToRead = cutPoint > 100 ? rawContent.substring(0, cutPoint + 1) : rawContent.substring(0, 600) + "...";
        }

        fullScript += `${transition}${n.title}. ${contentToRead} `;
      });
      fullScript += `That is the news wrap for now. I'm ${NEWSCASTER_NAME}, for Nigeria Diaspora Radio. Stay tuned to the channel for more news and entertainment.`;
    }

    // Safety check: Final script must be absolute maximum 4800 for ElevenLabs
    if (fullScript.length > 4800) {
      console.warn("🚨 Script too long for One-Shot TTS, truncating total length.");
      fullScript = fullScript.substring(0, 4790) + "... That's the news for now.";
    }

    console.log(`🎙️ One-Shot News Generation (${fullScript.length} chars): "${fullScript.substring(0, 100)}..."`);
    console.log("------------------------------------------");
    console.log("FULL SCRIPT TO BE READ:");
    console.log(fullScript);
    console.log("------------------------------------------");

    const audio = await generateSpeech(fullScript);
    if (audio) {
      console.log(`✅ News Bulletin Audio Generated (${audio.byteLength} bytes)`);
      return { audio, script: fullScript };
    }

    console.warn("⚠️ ElevenLabs quota exceeded or failed. Returning script for fallback.");
    return { audio: null, script: fullScript };
  });
}

export async function getNewsAudio(newsContent: string, isManual: boolean = false): Promise<Uint8Array | null> {
  return withRetry(async () => {
    console.log(`🎙️ Generating ${isManual ? 'Thompson' : 'Favour'}'s audio...`);
    // onwK4e9ZLuTAKqWW0Phv is the Male Nigerian voice ID for Thompson
    const voiceId = isManual ? 'onwK4e9ZLuTAKqWW0Phv' : undefined;

    const audioData = await generateSpeech(newsContent, { voiceId });

    if (audioData) {
      console.log('✅ News audio generated successfully');
      return audioData;
    }
    return null;
  });
}

export async function getJingleAudio(jingleText: string): Promise<Uint8Array | null> {
  // Centralized Fix: If the jingle text is the instrumental file name, try to fetch it from DB
  if (jingleText.toLowerCase().includes('instrumentals (1)')) {
    try {
      const media = await dbService.getMedia();
      const instrumental = media.find(m => m.name.toLowerCase().includes('instrumentals (1)'));
      if (instrumental && instrumental.file) {
        console.log('🎵 [aiDjService] Found actual instrumental file in DB, using as Jingle');
        const buffer = await instrumental.file.arrayBuffer();
        return new Uint8Array(buffer);
      }
    } catch (e) {
      console.warn('⚠️ [aiDjService] Failed to fetch instrumental from DB:', e);
    }
  }

  const cacheKey = `jingle_${btoa(jingleText).substring(0, 32)}`;
  const cached = await dbService.getCachedAudio(cacheKey);
  if (cached && cached.byteLength > 1000) {
    console.log('✅ Using cached jingle audio');
    return cached;
  }

  return withRetry(async () => {
    try {
      console.log('🎙️ Generating jingle audio with ElevenLabs...');

      // Make text more speakable for TTS
      const speakableText = jingleText.replace(/:/g, '.').replace(/-/g, '.');

      const audioData = await generateSpeech(speakableText, {
        stability: 0.5,
        similarityBoost: 0.75
      });

      if (audioData && audioData.byteLength > 1000) {
        console.log(`✅ Jingle audio generated (${audioData.byteLength} bytes), caching...`);
        await dbService.setCachedAudio(cacheKey, audioData);
        return audioData;
      } else {
        console.warn('⚠️ Jingle audio invalid or too small');
        return null;
      }
    } catch (error) {
      console.error("❌ Jingle TTS failed:", error);
      return null;
    }
  });
}


export async function getStingerAudio(): Promise<Uint8Array | null> {
  // Updated for High-Fidelity Stinger Request
  const stingerText = "Nigerians Voice Abroad";
  const cacheKey = `stinger_v3_${btoa(stingerText).substring(0, 32)}`;

  const cached = await dbService.getCachedAudio(cacheKey);
  if (cached && cached.byteLength > 1000) {
    return cached;
  }

  return withRetry(async () => {
    try {
      console.log('🎙️ Generating High-Fidelity Stinger Audio...');
      const audioData = await generateSpeech(stingerText, {
        voiceId: 'onwK4e9ZLuTAKqWW0Phv', // Deep, confident male voice (Thompson/Daniel)
        stability: 0.35,
        similarityBoost: 0.85,
        useSpeakerBoost: true
      });

      if (audioData && audioData.byteLength > 1000) {
        await dbService.setCachedAudio(cacheKey, audioData);
        return audioData;
      }
      return null;
    } catch (e) {
      console.error("Stinger Gen Failed", e);
      return null;
    }
  });
}

// Note: decode function removed - ElevenLabs returns binary audio data directly, not base64

/**
 * ═══════════════════════════════════════════════════════════════
 * SARA OBOSA TTS ENGINE
 * Professional newsroom voice generation for NDRTV bulletins
 * Uses Web Speech API as fallback when ElevenLabs quota exceeded
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Generate Sara Obosa bulletin audio with professional newsroom voice
 * Falls back to Web Speech API when ElevenLabs quota is exceeded
 */
export async function generateSaraObosaBulletin(script: string): Promise<Uint8Array | null> {
  return withRetry(async () => {
    try {
      console.log('🎙️ [Sara Obosa TTS] Generating bulletin audio...');
      console.log(`📝 [Sara Obosa TTS] Script length: ${script.length} characters`);

      // Try ElevenLabs first (premium quality)
      const audioData = await generateSpeech(script, {
        voiceId: LEAD_ANCHOR_VOICE_ID,
        stability: 0.6,        // Calm, consistent delivery
        similarityBoost: 0.8   // Clear, professional tone
      });

      if (audioData && audioData.byteLength > 1000) {
        console.log(`✅ [Sara Obosa TTS] ElevenLabs audio generated (${audioData.byteLength} bytes)`);
        return audioData;
      } else {
        console.warn('⚠️ [Sara Obosa TTS] ElevenLabs returned invalid audio, trying Web Speech...');
        throw new Error('Invalid ElevenLabs audio');
      }
    } catch (error: any) {
      console.warn('⚠️ [Sara Obosa TTS] ElevenLabs failed:', error.message);

      // Fallback to Web Speech API (free, unlimited)
      if (error.message.includes('quota') || error.message.includes('401') || error.message.includes('429')) {
        console.log('🎙️ [Sara Obosa TTS] Using Web Speech API fallback (quota exceeded)');
      } else {
        console.log('🎙️ [Sara Obosa TTS] Using Web Speech API fallback (ElevenLabs error)');
      }

      // Web Speech API doesn't return audio data, it speaks directly
      // Return a special marker to indicate Web Speech will be used
      return new Uint8Array([0x57, 0x45, 0x42, 0x53, 0x50, 0x45, 0x45, 0x43, 0x48]); // "WEBSPEECH" marker
    }
  });
}
