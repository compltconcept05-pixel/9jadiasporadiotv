import { generateSpeech } from './services/elevenLabsService.ts';
import fs from 'fs';
import path from 'path';

// Manual .env parsing
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        console.log(`📄 Found .env file (${envConfig.length} bytes)`);
        envConfig.split(/\r?\n/).forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;

            const match = trimmedLine.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                process.env[key] = value;
                console.log(`   🔑 Loaded key: ${key}`);
            }
        });
        console.log("✅ Loaded .env file");
    } else {
        console.warn("⚠️ .env file not found");
    }
} catch (e) {
    console.error("⚠️ Error loading .env:", e);
}

console.log("Testing TTS with key:", process.env.VITE_ELEVENLABS_API_KEY ? "Present" : "Missing");

async function test() {
    try {
        console.log("Attempting to generate speech...");
        const audio = await generateSpeech("This is a test of the emergency broadcast system.", {
            modelId: 'eleven_multilingual_v2'
        });

        if (audio) {
            console.log("SUCCESS: Audio generated, length:", audio.byteLength);
        } else {
            console.error("FAILURE: Response was null");
        }
    } catch (e) {
        console.error("CRITICAL ERROR:", e);
    }
}

test();
