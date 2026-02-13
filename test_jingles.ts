
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Manual Mock of dbService
const dbService = {
    getCachedAudio: async () => null,
    setCachedAudio: async () => { },
    getLastSyncTime: async () => 0,
    getNews: async () => [],
    saveNews: async () => { }
};

// Mock the module system to return our manual mock when dbService is imported
// This is hard in a script without a bundler. 
// Instead, let's just use the real aiDjService but MONKEY PATCH the dbService if possible or just import it and rely on its safe methods.
// Actually, aiDjService imports dbService. 
// Let's try to run a modified version of the test that builds the dependencies manually or 
// just trust that dbService won't crash even if we don't mock it, as long as we don't need real DB access.
// But dbService uses `localStorage`. In Node, that fails.

// Debug: Let's create a minimal script that just calls ElevenLabs directly for the jingles, 
// bypassing aiDjService to isolate the TTS issue.

const JINGLE_1 = "Nigeria Diaspora Radio Television. Bringing Nigerians abroad together.";
const JINGLE_2 = "Nigeria Diaspora Radio Television. The voice of Nigerians abroad.";

async function testDirectTTS() {
    console.log("🧪 Testing Direct Jingle TTS...");

    // Load .env
    const envPath = path.resolve(process.cwd(), '.env');
    let apiKey = '';
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        const match = envConfig.match(/VITE_ELEVENLABS_API_KEY=(.+)/);
        if (match) apiKey = match[1].trim();
    }

    if (!apiKey) {
        console.error("❌ No API Key found");
        return;
    }
    console.log(`🔑 Key: ${apiKey.substring(0, 10)}...`);

    const generate = async (text: string, label: string) => {
        console.log(`🎙️ Generating ${label}...`);
        try {
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL`, // Sarah
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': apiKey,
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                    }),
                }
            );

            if (!response.ok) {
                console.error(`❌ ${label} Failed: ${response.status} ${await response.text()}`);
                return;
            }

            const buffer = await response.arrayBuffer();
            if (buffer.byteLength > 1000) {
                console.log(`✅ ${label} Success: ${buffer.byteLength} bytes`);
            } else {
                console.warn(`⚠️ ${label} returned small/invalid buffer`);
            }
        } catch (e) {
            console.error(`❌ ${label} Exception:`, e);
        }
    };

    await generate(JINGLE_1, "JINGLE 1");
    // Wait a bit to avoid rate limits if any
    await new Promise(r => setTimeout(r, 1000));
    await generate(JINGLE_2, "JINGLE 2");
}

testDirectTTS();
