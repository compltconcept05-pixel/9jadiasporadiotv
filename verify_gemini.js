
const API_KEY = 'AIzaSyCJraGvrvNyIrAgFgzdTNiMte5lpQ5R6Os';
const MODEL = 'gemini-1.5-flash-001';

async function testGemini() {
    console.log(`Testing Gemini API with model: ${MODEL}`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Hello, explain why independent news is important in one sentence."
                    }]
                }]
            })
        });

        if (!response.ok) {
            console.error(`FAILED: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error Details:', errorText);
        } else {
            const data = await response.json();
            console.log('SUCCESS!');
            console.log('Response:', data.candidates[0].content.parts[0].text);
        }

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
    }
}

testGemini();
