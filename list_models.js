
import fs from 'fs';
import path from 'path';

async function listModels() {
    console.log(`Listing available models for API key...`);

    // Load .env
    const envPath = path.resolve(process.cwd(), '.env');
    let apiKey = '';

    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        const match = envConfig.match(/VITE_GEMINI_API_KEY=(.+)/);
        if (match) {
            apiKey = match[1].trim();
        }
    }

    if (!apiKey) {
        console.error("❌ No API key found in .env");
        return;
    }

    console.log(`Using key: ${apiKey.substring(0, 5)}...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`FAILED: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error Details:', errorText);
        } else {
            const data = await response.json();
            console.log('SUCCESS! Available Models:');
            data.models.forEach(m => {
                const name = m.name.replace('models/', '');
                console.log(`- ${name}: ${m.displayName}`);
            });
        }
    } catch (error) {
        console.error('CRITICAL ERROR:', error);
    }
}

listModels();
