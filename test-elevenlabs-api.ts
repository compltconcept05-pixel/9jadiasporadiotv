// Test script to verify ElevenLabs API is working
import { generateSpeech, getCharacterUsage } from './services/elevenLabsService';
import fs from 'fs';
import path from 'path';

// Manual .env parsing
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        });
    }
} catch (e) { }

const API_KEY = process.env.VITE_ELEVENLABS_API_KEY || "";

async function testElevenLabsAPI() {
    console.log('🧪 Testing ElevenLabs API...');
    console.log('');

    // Test 1: Check API key and usage
    console.log('📊 Step 1: Checking API key and quota...');
    const usage = await getCharacterUsage(API_KEY);

    if (usage) {
        console.log('✅ API key is valid!');
        console.log('');
    } else {
        console.error('❌ Failed to verify API key');
        console.log('');
    }

    // Test 2: Generate simple test audio
    console.log('🎙️ Step 2: Generating test audio...');
    const testText = "Hello, this is Sarah Obosa testing the ElevenLabs text to speech system.";

    const audioData = await generateSpeech(testText, { apiKey: API_KEY });

    if (audioData) {
        console.log('✅ SUCCESS! Audio generated successfully!');
        console.log(`📊 Audio size: ${audioData.byteLength} bytes`);
        console.log(`📊 Text length: ${testText.length} characters`);
        console.log('');
        console.log('🎉 ElevenLabs TTS is working correctly!');
        console.log('');
        console.log('✅ You can now use the "Read Full News Now" button');
    } else {
        console.error('❌ FAILED: No audio data received');
        console.log('');
        console.log('💡 Possible issues:');
        console.log('   - Invalid API key');
        console.log('   - Quota exceeded');
        console.log('   - Network error');
        console.log('   - API service down');
    }
}

testElevenLabsAPI().catch(error => {
    console.error('❌ Test failed with error:', error);
});
