
import { GoogleGenAI } from "@google/genai";
import fetch from 'node-fetch';

// Keys
const GEMINI_KEY = 'AIzaSyCJraGvrvNyIrAgFgzdTNiMte5lpQ5R6Os';
const ELEVEN_KEY = 'sk_cf24c9b9c8380b131d489a67e6d5baefd7bd7184984cce35';

async function testChain() {
    console.log('🚀 Starting Full Chain Verification...');

    // 1. Fetch News
    console.log('1️⃣ fetching news from Gemini (gemini-2.0-flash)...');
    const genAI = new GoogleGenAI({ apiKey: GEMINI_KEY });
    let newsContent = "";

    try {
        const response = await genAI.models.generateContent({
            model: "gemini-2.0-flash",
            contents: "Write 3 short fake news headlines about Nigeria."
        });
        newsContent = response.text || "";
        console.log('✅ Gemini Response:', newsContent.substring(0, 50) + '...');
    } catch (e) {
        console.error('❌ Gemini Failed:', e);
        return;
    }

    // 2. Construct Script
    const fullScript = `This is a test broadcast. ${newsContent} That was the news.`;
    console.log(`2️⃣ Generated Script (${fullScript.length} chars). Sending to ElevenLabs...`);

    // 3. Generate Audio
    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVEN_KEY,
                },
                body: JSON.stringify({
                    text: fullScript,
                    model_id: 'eleven_flash_v2_5',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                })
            }
        );

        if (!response.ok) {
            console.error(`❌ ElevenLabs Failed: ${response.status}`);
            const err = await response.text();
            console.error('Error Body:', err);
        } else {
            const arrayBuffer = await response.arrayBuffer();
            console.log(`✅ Success! Audio generated: ${arrayBuffer.byteLength} bytes`);
        }

    } catch (e) {
        console.error('❌ ElevenLabs Network Error:', e);
    }
}

testChain();
