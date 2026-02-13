
import { getAIClient, withRetry } from './geminiService';
import { generateSpeech } from './elevenLabsService';
import { dbService } from './dbService';
import { NewsItem } from '../types';
import { APP_NAME, NEWSCASTER_NAME } from '../constants';

// Voices
const VOICE_HOST_1 = 'EXAVITQu4vr4xnSDxMaL'; // Host 1
const VOICE_HOST_2 = 'ErXwobaYiN019PkySvjV'; // Host 2

interface ScriptLine {
    speaker: string;
    text: string;
}

function cleanJsonText(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

export async function generatePodcastScript(news: NewsItem[]): Promise<ScriptLine[]> {
    return withRetry(async () => {
        const ai = getAIClient();

        // Limit to top 5 news items to keep script concise
        const topNews = news.slice(0, 5);
        const newsContext = topNews.map(n => `- ${n.title}: ${n.content}`).join('\n');

        const prompt = `Convert the following news items into a lively, engaging 2-minute "deep dive" podcast conversation between two hosts: ${NEWSCASTER_NAME} and David.
    
    THEME: ${APP_NAME} - The Voice of the Nigerian Diaspora.
    
    CHARACTERS:
    - ${NEWSCASTER_NAME}: The lead anchor. Warm, professional, guiding the conversation.
    - David: The co-host. Curious, adds context, asks questions, and provides "color" commentary.
    
    INSTRUCTIONS:
    - Do NOT read the news linearly. Discuss it.
    - Start with a high-energy intro welcoming listeners to "${APP_NAME} Deep Dive".
    - Move fluidly between topics.
    - Keep it feeling spontaneous and conversational.
    - Focus heavily on the Diaspora specific stories.
    - End with a warm sign-off from both.
    
    NEWS CONTENT:
    ${newsContext}
    
    OUTPUT FORMAT:
    Return ONLY a raw JSON array of objects with "speaker" and "text" fields.
    Example: [{\"speaker\": \"${NEWSCASTER_NAME}\", \"text\": \"Hello world\"}, {\"speaker\": \"David\", \"text\": \"Hi ${NEWSCASTER_NAME}!\"}]`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = cleanJsonText(response.text || "[]");
        try {
            const script = JSON.parse(text);
            if (Array.isArray(script)) {
                return script as ScriptLine[];
            }
            return [];
        } catch (e) {
            console.error("Failed to parse podcast script JSON", e);
            return [];
        }
    });
}

export async function generatePodcastAudio(script: ScriptLine[]): Promise<Uint8Array | null> {
    if (!script || script.length === 0) return null;

    console.log(`🎙️ Generating Podcast Audio for ${script.length} lines...`);

    const audioBuffers: Uint8Array[] = [];

    for (const line of script) {
        const voiceId = line.speaker === NEWSCASTER_NAME ? VOICE_HOST_1 : VOICE_HOST_2;

        console.log(`🗣️ ${line.speaker}: ${line.text.substring(0, 30)}...`);

        // Generate audio for this line
        const audio = await generateSpeech(line.text, {
            voiceId,
            stability: 0.5,
            similarityBoost: 0.75
        });

        if (audio) {
            audioBuffers.push(audio);

            // Optionally add a small silence buffer here if needed for pacing
            // const silence = new Uint8Array(24000); // ~0.5s at 48kHz? (approx)
            // audioBuffers.push(silence);
        }
    }

    if (audioBuffers.length === 0) return null;

    // Concatenate all buffers
    const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const finalBuffer = new Uint8Array(totalLength);

    let offset = 0;
    for (const buf of audioBuffers) {
        finalBuffer.set(buf, offset);
        offset += buf.length;
    }

    console.log(`✅ Podcast generation complete: ${totalLength} bytes`);
    return finalBuffer;
}
