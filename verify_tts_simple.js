
const API_KEY = 'sk_cf24c9b9c8380b131d489a67e6d5baefd7bd7184984cce35';
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

async function testTTS() {
    console.log("Testing ElevenLabs TTS...");
    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': API_KEY,
                },
                body: JSON.stringify({
                    text: 'System check. One two three.',
                    model_id: 'eleven_flash_v2_5'
                })
            }
        );

        if (!response.ok) {
            console.error(`FAILED: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
        } else {
            const buffer = await response.arrayBuffer();
            console.log(`SUCCESS: Received ${buffer.byteLength} bytes of audio.`);
        }
    } catch (e) {
        console.error("ERROR:", e);
    }
}

testTTS();
