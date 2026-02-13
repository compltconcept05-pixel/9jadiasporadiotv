
import { getAvailableVoices } from './services/elevenLabsService.ts';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const key = process.env.VITE_ELEVENLABS_API_KEY;
    console.log("Using API Key:", key ? "Present" : "Missing");
    if (!key) return;

    try {
        const voices = await getAvailableVoices(key);
        console.log("AVAILABLE VOICES:");
        voices.forEach(v => {
            console.log(`- ${v.name} (${v.voice_id}): ${v.labels?.accent || 'No Accent'}`);
        });
    } catch (e) {
        console.error("Error listing voices:", e);
    }
}

run();
