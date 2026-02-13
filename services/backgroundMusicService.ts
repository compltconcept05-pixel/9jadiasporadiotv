// Background music generator for news broadcasts
// Creates a subtle ambient tone suitable for news reading

export function generateNewsBackgroundMusic(durationSeconds: number = 120): AudioBuffer | null {
    try {
        // Create an offline audio context for generating the background music
        const sampleRate = 44100;
        const offlineContext = new OfflineAudioContext(2, sampleRate * durationSeconds, sampleRate);

        // Create multiple oscillators for a rich ambient sound
        const frequencies = [110, 165, 220]; // Low ambient frequencies (A2, E3, A3)

        frequencies.forEach((freq, index) => {
            const oscillator = offlineContext.createOscillator();
            const gainNode = offlineContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.value = freq;

            // Very low volume for each oscillator
            gainNode.gain.value = 0.015 / frequencies.length;

            // Add slight variation over time
            gainNode.gain.setValueAtTime(0.01 / frequencies.length, offlineContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.02 / frequencies.length, offlineContext.currentTime + durationSeconds / 2);
            gainNode.gain.linearRampToValueAtTime(0.01 / frequencies.length, offlineContext.currentTime + durationSeconds);

            oscillator.connect(gainNode);
            gainNode.connect(offlineContext.destination);

            oscillator.start(0);
            oscillator.stop(durationSeconds);
        });

        // Note: This returns a promise, but we'll handle it in the calling code
        return null; // Placeholder, actual implementation will use async
    } catch (error) {
        console.error('Failed to generate background music:', error);
        return null;
    }
}

export async function generateNewsBackgroundMusicAsync(durationSeconds: number = 120): Promise<AudioBuffer | null> {
    try {
        const sampleRate = 44100;
        const offlineContext = new OfflineAudioContext(2, sampleRate * durationSeconds, sampleRate);

        // Create multiple oscillators for a rich ambient sound
        const frequencies = [110, 165, 220]; // Low ambient frequencies (A2, E3, A3)

        frequencies.forEach((freq) => {
            const oscillator = offlineContext.createOscillator();
            const gainNode = offlineContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.value = freq;

            // Very low volume for each oscillator
            gainNode.gain.value = 0.015 / frequencies.length;

            // Add slight variation over time
            gainNode.gain.setValueAtTime(0.01 / frequencies.length, offlineContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.02 / frequencies.length, offlineContext.currentTime + durationSeconds / 2);
            gainNode.gain.linearRampToValueAtTime(0.01 / frequencies.length, offlineContext.currentTime + durationSeconds);

            oscillator.connect(gainNode);
            gainNode.connect(offlineContext.destination);

            oscillator.start(0);
            oscillator.stop(durationSeconds);
        });

        const renderedBuffer = await offlineContext.startRendering();
        return renderedBuffer;
    } catch (error) {
        console.error('Failed to generate background music:', error);
        return null;
    }
}
