
import fs from 'fs';
import path from 'path';

// 1. Load .env manually for Node.js BEFORE any other imports
const envPath = path.resolve(process.cwd(), '.env');
console.log(`📂 Loading .env from: ${envPath}`);

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const match = trimmed.match(/^([^=]+)=(.*)$/);
        console.log(`[DEBUG] Line ${index}: "${trimmed}" | Match: ${match ? 'YES' : 'NO'}`);

        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            process.env[key] = value;
            if (key === 'VITE_GEMINI_API_KEY') {
                console.log(`✅ Loaded VITE_GEMINI_API_KEY: ${value.substring(0, 5)}...`);
            }
        }
    });
} else {
    console.error(`❌ .env file not found at: ${envPath}`);
}

// 2. Mock localStorage for Node.js environment
import { LocalStorage } from 'node-localstorage';

if (typeof localStorage === "undefined" || localStorage === null) {
    (global as any).localStorage = new LocalStorage('./scratch');
}

// 3. Import Service AFTER env is set
import { scanNigerianNewspapers } from './services/newsAIService';
import { getAIClient } from './services/geminiService';

async function verifyNewsWire() {
    console.log('📰 Testing News Wire Fetch...');
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ VITE_GEMINI_API_KEY not found in .env');
        return;
    }

    // Set the override globally for this test session if possible, 
    // OR modify scanNigerianNewspapers to accept an override. 
    // Since scanNigerianNewspapers doesn't accept an override, we have to rely on getAIClient finding it.
    // Let's try to monkey-patch getAIClient or just set process.env globally again right here.
    process.env.VITE_GEMINI_API_KEY = apiKey;

    // Actually, I'll update newsAIService to accept an optional key for testing.

    try {
        // We need to pass the key to scanNigerianNewspapers if we modify it, 
        // OR we trust that fixing geminiService to read process.env works. 
        // Wait, I already fixed geminiService to read process.env.
        // Why is it failing? 
        // Ah, maybe the module was imported BEFORE process.env was set in the PREVIOUS run attempt?
        // No, I fixed the order.

        // Let's try forcing the key into the global scope more aggressively
        (global as any).VITE_GEMINI_API_KEY = apiKey;

        // Let's verify if getAIClient works directly first
        try {
            const ai = getAIClient(apiKey);
            console.log('✅ getAIClient works with manual key');
        } catch (e) {
            console.error('❌ getAIClient failed even with manual key:', e);
        }

        const result = await scanNigerianNewspapers("London", true, apiKey); // Force refresh with key
        console.log(`✅ Success! Fetched ${result.news.length} items.`);

        let hasFallback = false;
        result.news.forEach(n => {
            console.log(`- [${n.category}] ${n.title} (${n.id})`);
            if (n.id.startsWith('fallback-')) hasFallback = true;
        });

        if (hasFallback) {
            console.error('❌ FAILURE: Returned Fallback News Items (Gemini Request Failed)');
        } else {
            console.log('✅ SUCCESS: Live wire news fetched successfully');
        }
    } catch (e) {
        console.error('❌ Critical Error:', e);
    }
}

verifyNewsWire();
