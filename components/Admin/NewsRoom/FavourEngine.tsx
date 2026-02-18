

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NewsItem, MediaFile } from '../../../types';
import { dbService } from '../../../services/dbService';
import { scanNigerianNewspapers } from '../../../services/newsAIService';
import { getDetailedBulletinAudio, getJingleAudio } from '../../../services/aiDjService';
import { NEWSCASTER_NAME, JINGLE_1, JINGLE_2, NEWS_BGM_VOLUME } from '../../../constants';
import { generateNewsBackgroundMusicAsync } from '../../../services/backgroundMusicService';
import { generateWebSpeech } from '../../../services/webSpeechService';

interface FavourEngineProps {
    currentLocation: string;
    triggerCount: number;
    stopSignal?: number;
    onStatusChange: (status: string) => void;
    onNewsUpdate: React.Dispatch<React.SetStateAction<NewsItem[]>>;
    onLogAdd: (action: string) => void;
    currentNewsFeed: NewsItem[];
    onDuckingChange?: (isDucking: boolean) => void;
    isAllowedToPlay?: boolean;
    mediaFiles?: MediaFile[];
}

/**
 * FavourEngine: Independent Automated News Engine.
 * Handles wire scanning and scheduled bulletins.
 */
const FavourEngine: React.FC<FavourEngineProps> = ({
    currentLocation,
    triggerCount,
    onStatusChange,
    onNewsUpdate,
    onLogAdd,
    currentNewsFeed,
    stopSignal,
    onDuckingChange,
    isAllowedToPlay = false,
    mediaFiles = []
}) => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const isBusyRef = useRef(false);

    const initContext = useCallback(() => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    }, []);

    // ONE-TIME DEBUG: Clear cache on mount to fix stale jingles
    useEffect(() => {
        const clearAndReload = async () => {
            const hasCleared = localStorage.getItem('debug_cache_cleared_v5');
            if (!hasCleared) {
                console.log("🧹 [Debug] Clearing DB cache to fix jingles (v5)...");
                try {
                    await dbService.clearCache();
                    localStorage.setItem('debug_cache_cleared_v5', 'true');
                    window.location.reload();
                } catch (e) {
                    console.error("Cache clear failed, retrying on next reload...");
                }
            }
        };
        clearAndReload();
    }, []);

    const stopAudio = useCallback(() => {
        // Stop voice
        if (activeSourceRef.current) {
            try { activeSourceRef.current.stop(); } catch (e) { }
            activeSourceRef.current = null;
        }
        // Stop background music
        if (bgmSourceRef.current) {
            try { bgmSourceRef.current.stop(); } catch (e) { }
            bgmSourceRef.current = null;
        }
        isBusyRef.current = false;
        onDuckingChange?.(false);
        onStatusChange('');
    }, [onStatusChange, onDuckingChange]);

    /**
     * LAYER 1: AUDIO DRIVER
     * Handles raw buffer playback and synchronization.
     */
    const playBuffer = useCallback(async (data: Uint8Array) => {
        const ctx = initContext();

        // 🔒 Ensure AudioContext is running (Auto-Resume)
        if (ctx.state === 'suspended') {
            console.log("🔊 [Audio] Context suspended. Attempting resume...");
            try {
                await ctx.resume();
                console.log("🔊 [Audio] Context resumed! New state:", ctx.state);
            } catch (err) {
                console.error("❌ [Audio] Failed to resume context:", err);
            }
        }

        let buffer: AudioBuffer;
        try {
            console.log(`🔊 [Audio] Decoding ${data.byteLength} bytes...`);
            buffer = await ctx.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
            console.log(`🔊 [Audio] Successfully decoded. Duration: ${buffer.duration.toFixed(2)}s`);
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

        console.log("🔊 [Audio] Starting playback...");

        return new Promise<void>((resolve) => {
            source.onended = () => {
                console.log("✅ [Audio] Playback finished.");
                resolve();
            };
            source.start(0);
        });
    }, [initContext, onStatusChange]);

    const playBackgroundMusic = async () => {
        console.log("🎻 [BGM] Choosing background music...");

        // Try newsjingle first
        const newsJingleFile = mediaFiles.find(m => m.name.toLowerCase().includes('newsjingle'));
        const bgmFile = newsJingleFile;

        let musicBuffer: AudioBuffer | null = null;
        const ctx = initContext();

        if (bgmFile) {
            console.log(`🎻 [BGM] Using newsjingle: ${bgmFile.name}`);
            if (bgmFile.file) {
                musicBuffer = await ctx.decodeAudioData(await bgmFile.file.arrayBuffer());
            } else if (bgmFile.url) {
                const res = await fetch(bgmFile.url);
                musicBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
            }
        }

        if (!musicBuffer) {
            console.log("🎻 [BGM] Falling back to generated ambient music.");
            musicBuffer = await generateNewsBackgroundMusicAsync(180);
        }

        if (!musicBuffer) return;

        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();

        source.buffer = musicBuffer;
        source.loop = true;

        // BGM Volume (Low ambient)
        gainNode.gain.value = NEWS_BGM_VOLUME || 0.15;

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);
        bgmSourceRef.current = source;
        console.log("🎻 [BGM] Started.");
    };

    /**
     * LAYER 2: WIRE SCANNER
     * Fetches raw news data from the satellite wire.
     */
    const scanWire = async () => {
        console.log("🛰️ [Scanner] Fetching wire data...");
        return await scanNigerianNewspapers(currentLocation);
    };

    /**
     * ═══════════════════════════════════════════════════════════════
     * LAYER 3: BULLETIN ENGINE (3-Layer Architecture)
     * ═══════════════════════════════════════════════════════════════
     * 
     * Orchestrates the complete broadcast sequence with strict layer separation:
     * 
     * 1️⃣ SCANNER LAYER → Fetches fresh wire data
     * 2️⃣ QUEUE MANAGER → Maintains stable 50-item rolling buffer
     * 3️⃣ BULLETIN ENGINE → Generates audio from FRESH wire data (not state)
     * 
     * CRITICAL RULES:
     * - isBusyRef MUST block overlapping bulletins
     * - Bulletin MUST use fresh newsItems, NOT currentNewsFeed
     * - Queue MUST preserve all items (no deletion except overflow)
     * - Manual news MUST stay pinned at top
     * ═══════════════════════════════════════════════════════
     */
    const runBulletin = useCallback(async (isBrief: boolean) => {
        // 🔒 STABILITY RULE: Block overlapping bulletins or broadcasting if radio is off
        if (isBusyRef.current || !isAllowedToPlay) {
            console.warn("⚠️ [FavourEngine] Bulletin ignored (Busy or Not Allowed)");
            return;
        }
        isBusyRef.current = true;
        onDuckingChange?.(true);

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🎙️ [FavourEngine] BULLETIN SEQUENCE INITIATED");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        onStatusChange(`📡 FAVOUR: Connecting satellite...`);

        try {
            // ═══════════════════════════════════════════════════════
            // STEP A: PREPARE ASSETS (Async, Non-Blocking)
            // ═══════════════════════════════════════════════════════
            console.log("🎵 [Step A] Starting asset generation (async)...");
            onStatusChange(`🎵 FAVOUR: Intro...`);

            // Start BGM generation immediately but don't play yet
            const bgmPromise = generateNewsBackgroundMusicAsync(180);
            const jinglePromise = getJingleAudio(JINGLE_1);

            // ═══════════════════════════════════════════════════════
            // STEP B: SCANNER LAYER (Fetch Fresh Wire Data)
            // ═══════════════════════════════════════════════════════
            console.log("🛰️ [Step B] Invoking Scanner Layer...");
            onStatusChange(`💎 FAVOUR: Scanning wire...`);
            const wireRes = await scanWire();
            const newsItems = wireRes.news || [];

            console.log(`✅ [Scanner] Wire scan complete: ${newsItems.length} fresh items received`);

            // ═══════════════════════════════════════════════════════
            // STEP C: QUEUE MANAGER LAYER (Rolling Merge & Dedup)
            // ═══════════════════════════════════════════════════════
            console.log("🗂️ [Step C] Invoking Queue Manager Layer...");
            onNewsUpdate(prev => {
                const combined = [...prev, ...newsItems];
                const unique = combined.filter((item, index, self) => index === self.findIndex(n => n.id === item.id));
                const manual = unique.filter(n => n.id.startsWith('manual-'));
                const auto = unique.filter(n => !n.id.startsWith('manual-'));
                const final = [...manual, ...auto].slice(0, 50);

                dbService.saveNews(final);
                return final;
            });



            // ═══════════════════════════════════════════════════════
            // STEP D: BULLETIN GENERATION (Fresh Wire Data Only)
            // ═══════════════════════════════════════════════════════
            console.log("📰 [Step D] Preparing bulletin content...");

            const itemsToRead = newsItems.length > 0 ? newsItems.slice(0, 5) : currentNewsFeed.slice(0, 5);

            if (itemsToRead.length === 0) {
                throw new Error("No news items available for bulletin generation");
            }

            console.log("🎙️ [Bulletin] Dispatching to AI for speech generation...");

            // Get audio AND script (for fallback)
            const { audio: bulletinAudio, script: bulletinScript } = await getDetailedBulletinAudio({
                location: currentLocation,
                localTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                newsItems: itemsToRead,
                weather: wireRes.weather,
                isBrief
            });

            // ═══════════════════════════════════════════════════════
            // STEP E: AUDIO PLAYBACK SEQUENCE
            // ═══════════════════════════════════════════════════════
            console.log("🔊 [Step E] Starting audio playback sequence...");

            // 1. Play Background Music
            const bgmBuffer = await bgmPromise;
            if (bgmBuffer) {
                const ctx = initContext();
                const source = ctx.createBufferSource();
                const gainNode = ctx.createGain();
                source.buffer = bgmBuffer;
                source.loop = true;
                gainNode.gain.value = NEWS_BGM_VOLUME || 0.15;
                source.connect(gainNode);
                gainNode.connect(ctx.destination);
                source.start(0);
                bgmSourceRef.current = source;
            }

            // 2. Play Jingle 1 (Start sequence)
            const jingleData = await jinglePromise;
            if (jingleData && jingleData.byteLength > 1000) {
                try {
                    console.log("🔊 [Sequence] Playing Opening Jingle...");
                    await playBuffer(jingleData);

                    // 2-Second Pause as requested
                    console.log("⏳ [Sequence] Pausing for 2 seconds...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (e) {
                    console.warn('⚠️ [Playback] Jingle playback failed, continuing:', e);
                }
            }

            // 3. Play Bulletin (ElevenLabs OR Web Speech Fallback)
            if (bulletinAudio && bulletinAudio.byteLength > 1000) {
                // PRIMARY: ElevenLabs Audio
                onStatusChange(`🎙️ FAVOUR: ON AIR...`);
                await playBuffer(bulletinAudio);
                onLogAdd(`Favour's ${isBrief ? 'Headlines' : 'Bulletin'} delivered successfully (HQ Voice).`);
            } else if (bulletinScript && bulletinScript.length > 0) {
                // FALLBACK: Web Speech API
                onStatusChange(`🎙️ FAVOUR: ON AIR (Fallback)...`);
                console.warn("⚠️ Using Web Speech Fallback");
                onLogAdd(`Favour: Using satellite fallback voice.`);

                await generateWebSpeech(bulletinScript);
                onLogAdd(`Favour's ${isBrief ? 'Headlines' : 'Bulletin'} delivered successfully (Fallback).`);
            } else {
                throw new Error("Bulletin generation failed (No Audio & No Script)");
            }

            // 4. Play Jingle 2 (Closing)
            try {
                const jingle2Data = await getJingleAudio(JINGLE_2);
                if (jingle2Data && jingle2Data.byteLength > 1000) {
                    console.log("🔊 [Sequence] Playing Closing Jingle...");
                    await playBuffer(jingle2Data);
                }
            } catch (e) {
                console.warn('⚠️ [Playback] Closing jingle failed:', e);
            }

            console.log("✅ [FavourEngine] BULLETIN SEQUENCE COMPLETE");

        } catch (err: any) {
            console.error("❌ [FavourEngine] BULLETIN SEQUENCE FAILED", err);
            const errMsg = err.message || "System fault";
            onStatusChange(`⚠️ Link error: ${errMsg}`);
            onLogAdd(`Favour: ${errMsg}`);
        } finally {
            // Stop BGM when finished
            if (bgmSourceRef.current) {
                // Fade out BGM would be nice here, but simple stop for now
                try { bgmSourceRef.current.stop(); } catch (e) { }
                bgmSourceRef.current = null;
            }
            isBusyRef.current = false;
            onDuckingChange?.(false);
            setTimeout(() => onStatusChange(''), 6000);
        }
    }, [currentLocation, onNewsUpdate, onStatusChange, onLogAdd, currentNewsFeed, onDuckingChange, isAllowedToPlay, mediaFiles, initContext, playBuffer]);

    useEffect(() => {
        if ((stopSignal && stopSignal > 0) || !isAllowedToPlay) {
            stopAudio();
        }
    }, [stopSignal, isAllowedToPlay, stopAudio]);

    // Handle External Triggers
    useEffect(() => {
        if (triggerCount > 0) {
            console.log("📡 [FavourEngine] Trigger pulse received:", triggerCount);
            runBulletin(false);
        }
    }, [triggerCount, runBulletin]);

    return (
        <div className="hidden">
            <div id="favour-engine-trigger" onClick={() => { initContext(); }} />
            <div id="favour-engine-stop" onClick={() => { stopAudio(); }} />
        </div>
    );
};

export default FavourEngine;

