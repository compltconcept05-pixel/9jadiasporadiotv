// Quick TTS Test Script
// Run this to test ElevenLabs API directly

const ELEVENLABS_API_KEY = 'sk_eaa494c349aab42c4b808dd51e0d8603eba5debbf864f459';
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah (Standard Free Voice)

async function testTTS() {
    console.log('🧪 Testing ElevenLabs TTS...');
    console.log('API Key:', ELEVENLABS_API_KEY.substring(0, 15) + '...');
    console.log('Voice ID:', VOICE_ID);

    const testText = "Good evening. I'm Sara Obosa, and this is Nigeria Diaspora Radio Television.";

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVENLABS_API_KEY,
                },
                body: JSON.stringify({
                    text: testText,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.6,
                        similarity_boost: 0.8,
                    },
                }),
            }
        );

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', errorText);
            return;
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Success! Audio size:', audioBuffer.byteLength, 'bytes');

        // Test if we can create Uint8Array
        const audioData = new Uint8Array(audioBuffer);
        console.log('✅ Uint8Array created:', audioData.byteLength, 'bytes');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testTTS();
