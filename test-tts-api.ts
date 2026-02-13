// Test script to check if the TTS API is working
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// Manual .env parsing
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split(/\r?\n/).forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;

            const match = trimmedLine.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        });
    }
} catch (e) { console.error(e); }

const TTS_API_KEY = process.env.VITE_GEMINI_API_KEY || "";

async function testTTSAPI() {
    console.log("🧪 Testing Gemini API...");
    console.log("🔑 API Key:", TTS_API_KEY ? (TTS_API_KEY.substring(0, 5) + "...") : "MISSING");

    try {
        const ai = new GoogleGenAI({ apiKey: TTS_API_KEY });

        console.log("📝 Generating test audio with simple text...");
        const testScript = "Hello, this is a test of the text to speech API.";

        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: testScript,
        });

        console.log("✅ API Response received!");
        console.log("Response structure:", Object.keys(response));

        const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (base64Audio) {
            console.log("✅ SUCCESS: Audio data received!");
            console.log("📊 Audio data size:", base64Audio.length, "characters (base64)");
            console.log("📊 Estimated bytes:", Math.floor(base64Audio.length * 0.75));
            console.log("\n🎉 TTS API is working correctly!");
        } else {
            console.error("❌ FAILED: No audio data in response");
            console.log("Response candidates:", JSON.stringify(response.candidates, null, 2));
        }

    } catch (error: any) {
        console.error("❌ API Test Failed!");
        console.error("Error type:", error.constructor.name);
        console.error("Error message:", error.message);

        if (error.message?.includes("429") || error.status === 429) {
            console.error("\n🚫 QUOTA EXCEEDED: The API has reached its rate limit or quota.");
            console.error("💡 Solution: Wait for quota reset or use a different API key.");
        } else if (error.message?.includes("401") || error.status === 401) {
            console.error("\n🔒 AUTHENTICATION FAILED: Invalid API key.");
            console.error("💡 Solution: Check if the API key is correct and active.");
        } else if (error.message?.includes("403") || error.status === 403) {
            console.error("\n🚫 FORBIDDEN: API key doesn't have permission for this operation.");
            console.error("💡 Solution: Verify API key permissions or billing status.");
        } else {
            console.error("\n❓ Unknown error occurred.");
            console.error("Full error:", error);
        }
    }
}

testTTSAPI();
