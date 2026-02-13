
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NewsItem, MediaFile } from '../../../types';
import { dbService } from '../../../services/dbService';
import { getNewsAudio, getJingleAudio } from '../../../services/aiDjService';
import { MANUAL_NEWSCASTER_NAME, JINGLE_2, MANUAL_NEWS_INTRO } from '../../../constants';

interface ThompsonEngineProps {
    manualTriggerCount: number;
    onStatusChange: (status: string) => void;
    onNewsUpdate: React.Dispatch<React.SetStateAction<NewsItem[]>>;
    onLogAdd: (action: string) => void;
    stopSignal?: number;
    onDuckingChange?: (isDucking: boolean) => void;
    isAllowedToPlay?: boolean;
    mediaFiles?: MediaFile[];
}

/**
 * ThompsonEngine: Independent Manual News Engine.
 * Handles breaking news and direct script reading.
 */
const ThompsonEngine: React.FC<ThompsonEngineProps> = ({
    manualTriggerCount,
    onStatusChange,
    onNewsUpdate,
    onLogAdd,
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

    const stopAudio = useCallback(() => {
        if (activeSourceRef.current) {
            try { activeSourceRef.current.stop(); } catch (e) { }
            activeSourceRef.current = null;
        }
        if (bgmSourceRef.current) {
            try { bgmSourceRef.current.stop(); } catch (e) { }
            bgmSourceRef.current = null;
        }
        isBusyRef.current = false;
        onDuckingChange?.(false);
        onStatusChange('');
    }, [onStatusChange, onDuckingChange]);

    const playBuffer = useCallback(async (data: Uint8Array) => {
        const ctx = initContext();
        const buffer = await ctx.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

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
    }, [initContext]);

    const runManualReport = useCallback(async () => {
        if (isBusyRef.current || !isAllowedToPlay) return;
        isBusyRef.current = true;
        onDuckingChange?.(true);
        onStatusChange(`🏮 THOMPSON: Preparing Report...`);

        try {
            const script = await dbService.getManualScript();
            if (!script || script.length < 5) throw new Error("Empty script");

            // Update List using Rolling Queue Logic (Deduplicate + Pinned Manual)
            const breakingItem: NewsItem = {
                id: 'manual-' + Date.now(),
                title: '🚨 BREAKING NEWS REPORT',
                content: script,
                category: 'Breaking' as any,
                timestamp: Date.now()
            };

            onNewsUpdate(prev => {
                const combined = [breakingItem, ...prev];
                const unique = combined.filter((item, index, self) => index === self.findIndex(n => n.id === item.id));
                const manual = unique.filter(n => n.id.startsWith('manual-'));
                const auto = unique.filter(n => !n.id.startsWith('manual-'));
                const final = [...manual, ...auto].slice(0, 50);
                dbService.saveNews(final);
                return final;
            });

            const fullScript = `${MANUAL_NEWS_INTRO} ${script} . . . . . . That is the breaking news for now. I am Thompson Osas, for Nigeria Diaspora Radio.`;

            // Parallel Audio Prep (BGM + Jingles + Report)
            const newsJingleFile = mediaFiles.find(m => m.name.toLowerCase().includes('newsjingle'));
            const bgmPromise = newsJingleFile ? (async () => {
                const ctx = initContext();
                if (newsJingleFile.file) return await ctx.decodeAudioData(await newsJingleFile.file.arrayBuffer());
                const res = await fetch(newsJingleFile.url);
                return await ctx.decodeAudioData(await res.arrayBuffer());
            })() : Promise.resolve(null);

            const jinglePromise = getJingleAudio(JINGLE_2);
            const audioPromise = getNewsAudio(fullScript, true);

            const [bgmBuffer, jingleData, reportAudio] = await Promise.all([bgmPromise, jinglePromise, audioPromise]);

            // Start BGM if available
            if (bgmBuffer) {
                const ctx = initContext();
                const bgmSource = ctx.createBufferSource();
                const bgmGain = ctx.createGain();
                bgmSource.buffer = bgmBuffer;
                bgmSource.loop = true;
                bgmGain.gain.value = 0.15;
                bgmSource.connect(bgmGain);
                bgmGain.connect(ctx.destination);
                bgmSource.start(0);
                bgmSourceRef.current = bgmSource;
            }

            // Play jingle if available
            if (jingleData && jingleData.byteLength > 1000) {
                onStatusChange(`🎵 THOMPSON: Alert...`);
                console.log('🎵 Playing Thompson jingle...');
                try {
                    await playBuffer(jingleData);
                } catch (e) {
                    console.warn('⚠️ Thompson jingle playback failed, continuing:', e);
                }
            } else {
                console.warn('⚠️ Thompson jingle unavailable, skipping');
            }

            if (reportAudio && reportAudio.byteLength > 1000) {
                onStatusChange(`🎙️ THOMPSON: ON AIR...`);
                console.log(`🔊 Playing Thompson report (${reportAudio.byteLength} bytes)...`);
                await playBuffer(reportAudio);
                onLogAdd(`Thompson's Breaking Report Delivered.`);
            } else {
                console.error('❌ Thompson report audio invalid or missing');
                onStatusChange('⚠️ Thompson: Audio generation failed');
            }
        } catch (err: any) {
            console.error("❌ [ThompsonEngine] Lockdown Failure:", err);
            const errMsg = err.message || "System fault";
            // User-friendly error mapping
            if (errMsg.includes("401")) onStatusChange("⚠️ ElevenLabs: Invalid API Key");
            else if (errMsg.includes("429")) onStatusChange("⚠️ ElevenLabs: Quota Exceeded");
            else onStatusChange(`⚠️ Thompson Prep Error: ${errMsg}`);

            onLogAdd(`Thompson: ${errMsg}`);
        } finally {
            isBusyRef.current = false;
            onDuckingChange?.(false);
            onStatusChange('');
        }
    }, [onNewsUpdate, onStatusChange, onLogAdd, onDuckingChange, isAllowedToPlay, mediaFiles, initContext, playBuffer]);

    useEffect(() => {
        if ((stopSignal && stopSignal > 0) || !isAllowedToPlay) {
            stopAudio();
        }
    }, [stopSignal, isAllowedToPlay, stopAudio]);

    // Handle External Triggers
    useEffect(() => {
        if (manualTriggerCount > 0) {
            console.log("🏮 [ThompsonEngine] Manual Trigger:", manualTriggerCount);
            runManualReport();
        }
    }, [manualTriggerCount, runManualReport]);

    return (
        <div className="hidden">
            <div id="thompson-engine-trigger" onClick={() => { initContext(); }} />
            <div id="thompson-engine-stop" onClick={() => { stopAudio(); }} />
        </div>
    );
};

export default ThompsonEngine;
