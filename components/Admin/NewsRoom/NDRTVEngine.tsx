import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NewsItem, MediaFile } from '../../../types';
import { dbService } from '../../../services/dbService';
import { scanNigerianNewspapers } from '../../../services/newsAIService';
import { generateSaraObosaBulletin } from '../../../services/aiDjService';
import { processEditorial } from '../../../services/editorialEngine';
import { generateBulletinScript } from '../../../services/bulletinComposer';
import {
    BULLETIN_INTERVAL_MINUTES,
    MAX_NEWS_BUFFER,
    BREAKING_NEWS_PRIORITY_THRESHOLD,
    LEAD_ANCHOR_NAME,
    STATION_ABBR,
    JINGLE_1,
    JINGLE_2
} from '../../../constants';
import { getJingleAudio } from '../../../services/aiDjService';

interface NDRTVEngineProps {
    currentLocation: string;
    onStatusChange: (status: string) => void;
    onNewsUpdate: React.Dispatch<React.SetStateAction<NewsItem[]>>;
    onLogAdd: (action: string) => void;
    currentNewsFeed: NewsItem[];
    manualTrigger?: number;
    stopSignal?: number; // Added
    mediaFiles?: MediaFile[];
    onDuckingChange?: (isDucking: boolean) => void;
    isAllowedToPlay?: boolean; // NEW
}

/**
 * ═══════════════════════════════════════════════════════════════
 * NDRTV AUTOMATION ENGINE
 * Nigeria Diaspora Radio TV - Automated Global Newsroom
 * Lead Anchor: Sara Obosa
 * ═══════════════════════════════════════════════════════════════
 * 
 * 5-Layer Architecture:
 * 1️⃣ Global News Scanner → Worldwide Nigeria-related news
 * 2️⃣ Editorial Engine → Deduplication + Priority Ranking
 * 3️⃣ Bulletin Composer → Sara Obosa script generation
 * 4️⃣ TTS Engine → Professional newsroom voice
 * 5️⃣ Broadcast Engine → Auto-playback to listeners
 * 
 * Automation: 15-minute intervals + breaking news triggers
 * ═══════════════════════════════════════════════════════════════
 */
const NDRTVEngine: React.FC<NDRTVEngineProps> = ({
    currentLocation,
    onStatusChange,
    onNewsUpdate,
    onLogAdd,
    currentNewsFeed,
    manualTrigger,
    stopSignal, // Fixed
    mediaFiles = [],
    onDuckingChange,
    isAllowedToPlay = false // NEW
}) => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const bgMusicSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const bgGainNodeRef = useRef<GainNode | null>(null);
    const isBusyRef = useRef(false);
    const [lastBulletinTime, setLastBulletinTime] = useState(0);
    const lastTriggerHourRef = useRef<number>(-1);

    const stopAudio = useCallback(() => {
        console.log("🛑 [NDRTVEngine] STOP command received. Killing all broadcast audio.");
        if (activeSourceRef.current) {
            try { activeSourceRef.current.stop(); } catch (e) { }
            activeSourceRef.current = null;
        }
        if (bgMusicSourceRef.current) {
            try { bgMusicSourceRef.current.stop(); } catch (e) { }
            bgMusicSourceRef.current = null;
        }
        bgGainNodeRef.current = null;
        isBusyRef.current = false;
        onDuckingChange?.(false);
        onStatusChange('');
    }, [onStatusChange, onDuckingChange]);

    useEffect(() => {
        if ((stopSignal && stopSignal > 0) || !isAllowedToPlay) {
            stopAudio();
        }
    }, [stopSignal, isAllowedToPlay, stopAudio]);

    /**
     * Initialize AudioContext
     */
    const initContext = useCallback(() => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    }, []);

    // ONE-TIME DEBUG: Force clear old news/jingles (v6)
    useEffect(() => {
        const forceClear = async () => {
            const hasCleared = localStorage.getItem('debug_cache_cleared_v6');
            if (!hasCleared) {
                console.log("🧹 [Force] Cleaning stale news/jingle data (v6)...");
                try {
                    await dbService.clearCache();
                    localStorage.setItem('debug_cache_cleared_v6', 'true');
                    window.location.reload();
                } catch (e) {
                    console.error("Force clean failed:", e);
                }
            }
        };
        forceClear();
    }, []);

    /**
     * Play audio buffer or use Web Speech API
     */
    const playBuffer = async (data: Uint8Array, script?: string): Promise<void> => {
        // Check if this is the Web Speech marker
        const isWebSpeech = data.byteLength === 9 &&
            data[0] === 0x57 && data[1] === 0x45 && data[2] === 0x42 &&
            data[3] === 0x53 && data[4] === 0x50 && data[5] === 0x45 &&
            data[6] === 0x45 && data[7] === 0x43 && data[8] === 0x48;

        if (isWebSpeech && script) {
            console.log('🎙️ [Broadcast] Using Web Speech API for playback');

            // Import Web Speech service dynamically
            const { generateWebSpeech } = await import('../../../services/webSpeechService');

            try {
                await generateWebSpeech(script, {
                    rate: 0.9,   // Slightly slower for news clarity
                    pitch: 1.0,  // Natural pitch
                    volume: 1.0  // Full volume
                });
                console.log('✅ [Broadcast] Web Speech playback completed');
            } catch (e) {
                console.error('❌ [Broadcast] Web Speech error:', e);
                throw new Error('Web Speech playback failed');
            }
            return;
        }

        // Original audio buffer playback
        const ctx = initContext();
        let buffer: AudioBuffer;

        try {
            buffer = await ctx.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        } catch (e) {
            console.error("❌ Audio Decode Error:", e);
            onStatusChange("⚠️ Audio Format Error");
            return;
        }

        if (activeSourceRef.current) {
            try { activeSourceRef.current.stop(); } catch (e) { }
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        activeSourceRef.current = source;

        return new Promise<void>((resolve) => {
            source.onended = resolve;
            source.start(0);
        });
    };

    const broadcastManualStory = useCallback(async (item: NewsItem) => {
        if (isBusyRef.current || !isAllowedToPlay) return;
        isBusyRef.current = true;
        onDuckingChange?.(true);

        console.log(`🎙️ [Manual] Broadcasting specific story: ${item.title}`);
        onStatusChange(`🎙️ NDRTV: Special Report...`);

        try {
            // Start Background Music (Try newsjingle first)
            const newsJingleFile = mediaFiles.find(m => m.name.toLowerCase().includes('newsjingle'));
            const fallbackBgm = mediaFiles.find(m => m.name.toLowerCase().includes('instrumentals (1)'));
            const bgmFile = newsJingleFile || fallbackBgm;

            if (bgmFile) {
                console.log(`🎵 [Manual] Starting background bed: ${bgmFile.name}`);
                const ctx = initContext();
                let bgBuffer: AudioBuffer | null = null;
                if (bgmFile.file) {
                    bgBuffer = await ctx.decodeAudioData(await bgmFile.file.arrayBuffer());
                } else if (bgmFile.url) {
                    const res = await fetch(bgmFile.url);
                    bgBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
                }

                if (bgBuffer) {
                    const bgSource = ctx.createBufferSource();
                    const bgGain = ctx.createGain();
                    bgSource.buffer = bgBuffer;
                    bgSource.loop = true;
                    bgGain.gain.value = 0.6;
                    bgSource.connect(bgGain);
                    bgGain.connect(ctx.destination);
                    bgSource.start(0);
                    bgMusicSourceRef.current = bgSource;
                    bgGainNodeRef.current = bgGain;
                    bgGain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 2.0);
                }
            }

            // 1. Play Opening Jingle
            const j1 = await getJingleAudio(JINGLE_1);
            if (j1) await playBuffer(j1);

            await new Promise(r => setTimeout(r, 1500));

            // 2. Play the news
            const script = `${LEAD_ANCHOR_NAME} here with a manual news update. ${item.title}. ${item.content}`;
            const audioData = await generateSaraObosaBulletin(script);
            if (audioData) {
                await playBuffer(audioData, script);
            }

            // Fade out background music
            if (bgGainNodeRef.current) {
                const ctx = initContext();
                bgGainNodeRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);
                setTimeout(() => {
                    bgMusicSourceRef.current?.stop();
                    bgMusicSourceRef.current = null;
                    bgGainNodeRef.current = null;
                }, 2100);
            }

            // 3. Play Closing Jingle
            const j2 = await getJingleAudio(JINGLE_2);
            if (j2) await playBuffer(j2);

        } catch (e) {
            console.error("Manual story broadcast failed", e);
        } finally {
            isBusyRef.current = false;
            onDuckingChange?.(false);
            onStatusChange('');
        }
    }, [onStatusChange, mediaFiles, initContext, playBuffer, onDuckingChange]);

    /**
     * ═══════════════════════════════════════════════════════════════
     * MAIN BULLETIN BROADCAST SEQUENCE
     * ═══════════════════════════════════════════════════════════════
     */
    const broadcastBulletin = useCallback(async () => {
        // 🔒 Prevent overlapping bulletins or broadcasting if radio is off
        if (isBusyRef.current || !isAllowedToPlay) {
            console.warn(`⚠️ [${STATION_ABBR}] Bulletin ignored (Busy: ${isBusyRef.current}, Allowed: ${isAllowedToPlay})`);
            return;
        }
        isBusyRef.current = true;
        onDuckingChange?.(true);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🎙️ [${STATION_ABBR}] BULLETIN SEQUENCE INITIATED`);
        console.log(`📡 [${STATION_ABBR}] Anchor: ${LEAD_ANCHOR_NAME}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        try {
            // ═══════════════════════════════════════════════════════
            // LAYER 1: GLOBAL NEWS SCANNER
            // ═══════════════════════════════════════════════════════
            console.log('🛰️ [Layer 1] Global News Scanner...');
            onStatusChange(`📡 ${STATION_ABBR}: Scanning global wire...`);

            const wireRes = await scanNigerianNewspapers(currentLocation);
            const rawNews = wireRes.news || [];

            console.log(`✅ [Scanner] ${rawNews.length} items fetched from global sources`);

            // ═══════════════════════════════════════════════════════
            // LAYER 2: EDITORIAL ENGINE
            // ═══════════════════════════════════════════════════════
            console.log('📰 [Layer 2] Editorial Engine...');
            onStatusChange(`📰 ${STATION_ABBR}: Editorial processing...`);

            const processedNews = processEditorial(rawNews, MAX_NEWS_BUFFER);

            console.log(`✅ [Editorial] ${processedNews.length} items after processing`);

            // Update news queue - REPLACE old news with fresh scan
            onNewsUpdate(() => {
                console.log(`📊 [Queue] Replacing news feed with ${processedNews.length} fresh items`);

                // Save to database
                dbService.saveNews(processedNews);

                return processedNews;
            });

            // ═══════════════════════════════════════════════════════
            // LAYER 3: BULLETIN COMPOSER
            // ═══════════════════════════════════════════════════════
            console.log('📝 [Layer 3] Bulletin Composer...');
            onStatusChange(`📝 ${STATION_ABBR}: ${LEAD_ANCHOR_NAME} preparing script...`);

            const bulletinScript = generateBulletinScript(processedNews);

            console.log(`✅ [Composer] Script ready (${bulletinScript.fullScript.length} chars)`);
            console.log(`📋 [Composer] Headlines: ${bulletinScript.headlines.length}`);

            // ═══════════════════════════════════════════════════════
            // LAYER 4: TTS ENGINE (Sara Obosa)
            // ═══════════════════════════════════════════════════════
            console.log('🎙️ [Layer 4] TTS Engine...');
            onStatusChange(`🎙️ ${STATION_ABBR}: ${LEAD_ANCHOR_NAME} recording...`);

            const bulletinAudio = await generateSaraObosaBulletin(bulletinScript.fullScript);

            if (!bulletinAudio) {
                throw new Error('TTS generation failed');
            }

            // Check for Web Speech marker
            const isWebSpeechMarker = bulletinAudio.length === 9 &&
                bulletinAudio[0] === 0x57 && bulletinAudio[1] === 0x45;

            console.log(`✅ [TTS] Audio ready (${bulletinAudio.byteLength} bytes)`);

            // ═══════════════════════════════════════════════════════
            // LAYER 5: BROADCAST ENGINE
            // ═══════════════════════════════════════════════════════
            console.log('🔊 [Layer 5] Broadcast Engine...');

            // Start Background Music (Try newsjingle first)
            try {
                const newsJingleFile = mediaFiles.find(m => m.name.toLowerCase().includes('newsjingle'));
                const fallbackBgm = mediaFiles.find(m => m.name.toLowerCase().includes('instrumentals (1)'));
                const bgmFile = newsJingleFile || fallbackBgm;

                if (bgmFile) {
                    console.log(`🎵 [Broadcast] Starting background bed: ${bgmFile.name}`);
                    const ctx = initContext();
                    let bgBuffer: AudioBuffer | null = null;
                    if (bgmFile.file) {
                        bgBuffer = await ctx.decodeAudioData(await bgmFile.file.arrayBuffer());
                    } else if (bgmFile.url) {
                        const res = await fetch(bgmFile.url);
                        bgBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
                    }

                    if (bgBuffer) {
                        const bgSource = ctx.createBufferSource();
                        const bgGain = ctx.createGain();
                        bgSource.buffer = bgBuffer;
                        bgSource.loop = true;
                        bgGain.gain.value = 0.6;
                        bgSource.connect(bgGain);
                        bgGain.connect(ctx.destination);
                        bgSource.start(0);
                        bgMusicSourceRef.current = bgSource;
                        bgGainNodeRef.current = bgGain;
                        bgGain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 3.0);
                    }
                }
            } catch (e) {
                console.warn("⚠️ Background music failed", e);
            }

            // 1. Play Opening Jingle
            try {
                const j1 = await getJingleAudio(JINGLE_1);
                if (j1) {
                    console.log("🔊 [Broadcast] Playing Opening Jingle...");
                    await playBuffer(j1);
                    console.log("⏳ [Broadcast] 2.5-second technical pause...");
                    await new Promise(resolve => setTimeout(resolve, 2500));
                }
            } catch (e) {
                console.warn("⚠️ Jingle 1 failed", e);
            }

            onStatusChange(`🔊 ${STATION_ABBR}: ${LEAD_ANCHOR_NAME} ON AIR...`);
            await playBuffer(bulletinAudio, bulletinScript.fullScript);

            // Fade out background music
            if (bgGainNodeRef.current) {
                const ctx = initContext();
                bgGainNodeRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);
                setTimeout(() => {
                    bgMusicSourceRef.current?.stop();
                    bgMusicSourceRef.current = null;
                    bgGainNodeRef.current = null;
                }, 2100);
            }

            // 2. Play Closing Jingle
            try {
                const j2 = await getJingleAudio(JINGLE_2);
                if (j2) await playBuffer(j2);
            } catch (e) {
                console.warn("⚠️ Jingle 2 failed", e);
            }

            console.log('✅ [Broadcast] Bulletin delivered successfully');
            onLogAdd(`${LEAD_ANCHOR_NAME}: Bulletin delivered (${processedNews.length} stories)`);

            setLastBulletinTime(Date.now());

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`✅ [${STATION_ABBR}] BULLETIN SEQUENCE COMPLETE`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        } catch (err: any) {
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error(`❌ [${STATION_ABBR}] BULLETIN SEQUENCE FAILED`);
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('Error details:', err);

            const errMsg = err.message || "System fault";

            if (errMsg.includes("401")) onStatusChange("⚠️ ElevenLabs: Invalid API Key");
            else if (errMsg.includes("429")) onStatusChange("⚠️ ElevenLabs: Quota Exceeded");
            else if (errMsg.includes("TTS")) onStatusChange("⚠️ Voice synthesis failed");
            else onStatusChange(`⚠️ ${STATION_ABBR}: ${errMsg}`);

            onLogAdd(`${LEAD_ANCHOR_NAME}: ${errMsg}`);
        } finally {
            isBusyRef.current = false;
            onDuckingChange?.(false);
            setTimeout(() => onStatusChange(''), 6000);
        }
    }, [currentLocation, onNewsUpdate, onStatusChange, onLogAdd, onDuckingChange, isAllowedToPlay]);

    /**
     * Auto-trigger bulletin at the TOP OF THE HOUR
     */
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();

            // Strictly trigger only at Minute 0 and once per hour
            if (now.getMinutes() === 0 && lastTriggerHourRef.current !== currentHour && !isBusyRef.current) {
                console.log(`⏰ [${STATION_ABBR}] Top of the Hour trigger: ${currentHour}:00`);
                lastTriggerHourRef.current = currentHour;
                broadcastBulletin();
            }
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [broadcastBulletin]);

    /**
     * Manual trigger
     */
    useEffect(() => {
        if (manualTrigger && manualTrigger > 0) {
            console.log(`🔴 [${STATION_ABBR}] Manual trigger received`);
            broadcastBulletin();
        }
    }, [manualTrigger, broadcastBulletin]);

    // BREAKING NEWS AUTO-TRIGGER DISABLED PER USER REQUEST
    // Only play by time set at top of the hour

    /**
     * Initial news scan on mount
     */
    useEffect(() => {
        // Only run once on mount
        const initialScan = async () => {
            console.log(`🌍 [${STATION_ABBR}] Initial news scan on page load...`);

            // Scan and update news without broadcasting
            try {
                const { scanNigerianNewspapers } = await import('../../../services/newsAIService');
                const { processEditorial } = await import('../../../services/editorialEngine');

                const wireRes = await scanNigerianNewspapers(currentLocation);
                const rawNews = wireRes.news || [];

                if (rawNews.length > 0) {
                    const processedNews = processEditorial(rawNews, MAX_NEWS_BUFFER);

                    onNewsUpdate(() => {
                        console.log(`📊 [Initial Scan] Loaded ${processedNews.length} news items`);
                        return processedNews;
                    });

                    console.log(`✅ [${STATION_ABBR}] Initial scan complete - ${processedNews.length} stories loaded`);
                } else {
                    console.log(`⚠️ [${STATION_ABBR}] Initial scan returned no news`);
                }
            } catch (error) {
                console.error(`❌ [${STATION_ABBR}] Initial scan failed:`, error);
            }
        };

        initialScan();
    }, []); // Empty dependency array = run once on mount

    return (
        <div className="hidden">
            <div id="ndrtv-engine-trigger" onClick={() => { initContext(); }} />
            <input
                id="manual-story-trigger"
                type="hidden"
                onClick={(e) => {
                    const item = JSON.parse((e.target as HTMLInputElement).value);
                    broadcastManualStory(item);
                }}
            />
        </div>
    );
};

export default NDRTVEngine;
