import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { MediaFile, NewsItem, AdminMessage } from '../../../types';
import TVOverlay from './TVOverlay';

interface TVPlayerProps {
    activeVideo: MediaFile | null;
    allVideos: MediaFile[];
    news: NewsItem[];
    adminMessages: AdminMessage[];
    onPlayStateChange?: (isPlaying: boolean) => void;
    onVideoAdvance?: (index: number | MediaFile) => void;
    isNewsPlaying: boolean;
    isActive: boolean;
    isAdmin?: boolean;
    isMuted?: boolean;
    onMuteChange?: (muted: boolean) => void;
    tvPlaylist?: string[];
    isPreview?: boolean;
    lastZap?: number;
}

const TVPlayer: React.FC<TVPlayerProps> = ({
    activeVideo,
    allVideos,
    news,
    adminMessages,
    onPlayStateChange,
    onVideoAdvance,
    isNewsPlaying,
    isActive,
    isAdmin = false,
    isMuted: isMutedProp = false,
    onMuteChange,
    tvPlaylist = [],
    isPreview = false,
    lastZap = 0
}) => {
    const [playerKey, setPlayerKey] = useState(0);
    const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error' | 'blocked'>('idle');
    const [volume, setVolume] = useState(1.0);
    const [showControls, setShowControls] = useState(true);
    const blockTimerRef = useRef<NodeJS.Timeout | null>(null);
    const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

    // ── URL RESOLUTION — Priority: playlist > uploaded video
    const resolvedUrl = (() => {
        if (tvPlaylist && tvPlaylist.length > 0) return tvPlaylist[0];
        if (activeVideo?.url) return activeVideo.url;
        return '';
    })();

    // ── FORCE NEW PLAYER MOUNT on source change
    useEffect(() => {
        if (resolvedUrl) {
            console.log('📺 [TVPlayer] NEW SOURCE → Mounting fresh player:', resolvedUrl);
            setStatus('loading');
            setPlayerKey(k => k + 1);

            // Autoplay block safety net
            if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
            blockTimerRef.current = setTimeout(() => {
                setStatus(s => s === 'loading' ? 'blocked' : s);
            }, 8000);
        } else {
            setStatus('idle');
        }
        return () => { if (blockTimerRef.current) clearTimeout(blockTimerRef.current); };
    }, [resolvedUrl, lastZap]);

    // ── CONTROLS HIDE
    const resetControlsTimer = () => {
        setShowControls(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        if (status === 'playing') {
            controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);
        }
    };
    useEffect(() => resetControlsTimer(), [status]);

    // ── KEYBOARD for D-Pad
    useEffect(() => {
        if (status !== 'blocked') return;
        const handler = (e: KeyboardEvent) => {
            console.log('⌨️ [TVPlayer] Key pressed, retrying:', e.key);
            setStatus('loading');
            setPlayerKey(k => k + 1);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [status]);

    return (
        <div
            className="relative w-full h-full bg-black overflow-hidden select-none"
            onClick={resetControlsTimer}
            onMouseMove={resetControlsTimer}
        >
            {/* ── PLAYER LAYER ── */}
            {resolvedUrl ? (
                <div key={`tv-${playerKey}`} className="absolute inset-0">
                    <ReactPlayer
                        key={`rp-${playerKey}`}
                        url={resolvedUrl}
                        width="100%"
                        height="100%"
                        playing={!isNewsPlaying}
                        muted={isMutedProp}
                        volume={volume}
                        playsinline
                        config={{
                            youtube: { playerVars: { autoplay: 1, rel: 0, modestbranding: 1, origin: window.location.origin } } as any,
                            file: { forceHLS: resolvedUrl.includes('.m3u8'), attributes: { playsInline: true, style: { width: '100%', height: '100%', objectFit: 'cover' } } }
                        } as any}
                        onReady={() => {
                            console.log('✅ [TVPlayer] Ready');
                            if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
                            setStatus('playing');
                            onPlayStateChange?.(true);
                        }}
                        onPlay={() => {
                            if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
                            setStatus('playing');
                        }}
                        onBuffer={() => setStatus('loading')}
                        onBufferEnd={() => setStatus('playing')}
                        onEnded={() => {
                            if (tvPlaylist && tvPlaylist.length > 1) {
                                console.log('⏭️ [TVPlayer] Playlist ended item, advancing');
                            } else if (allVideos.length > 0 && onVideoAdvance) {
                                const idx = allVideos.findIndex(v => v.id === activeVideo?.id);
                                onVideoAdvance((idx + 1) % allVideos.length);
                            } else {
                                setStatus('idle');
                                onPlayStateChange?.(false);
                            }
                        }}
                        onError={(e) => {
                            console.error('❌ [TVPlayer] Error:', e);
                            if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
                            setStatus('error');
                            onPlayStateChange?.(false);
                        }}
                    />

                    {/* LOADING SPINNER */}
                    {status === 'loading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
                            <div className="w-14 h-14 border-4 border-white/10 border-t-[#008751] rounded-full animate-spin" />
                            <span className="mt-5 text-[10px] text-white/40 font-black uppercase tracking-[0.4em] animate-pulse">Establishing Signal...</span>
                            <span className="mt-2 text-[7px] text-white/20 font-mono truncate max-w-[80%]">{resolvedUrl}</span>
                        </div>
                    )}

                    {/* AUTOPLAY BLOCKED */}
                    {status === 'blocked' && (
                        <div
                            onClick={() => { setStatus('loading'); setPlayerKey(k => k + 1); }}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 cursor-pointer"
                        >
                            <div className="w-28 h-28 bg-[#008751] rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(0,135,81,0.5)] border-8 border-white/10 animate-bounce">
                                <i className="fas fa-play text-white text-4xl ml-2" />
                            </div>
                            <h2 className="mt-8 text-white font-black text-2xl uppercase tracking-tight text-center px-8">Tap to Watch</h2>
                            <p className="mt-2 text-white/30 text-[9px] uppercase font-black tracking-widest text-center px-16">Browser blocked autoplay — tap or press OK</p>
                        </div>
                    )}

                    {/* ERROR */}
                    {status === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 p-8 text-center">
                            <i className="fas fa-satellite-dish text-red-500 text-5xl mb-6" />
                            <h3 className="text-white font-black uppercase text-xl mb-2">Signal Lost</h3>
                            <p className="text-white/30 text-[8px] mb-8 font-mono break-all">{resolvedUrl}</p>
                            <button
                                onClick={() => { setStatus('loading'); setPlayerKey(k => k + 1); }}
                                className="px-8 py-3 bg-white text-black font-black uppercase rounded-xl text-sm hover:bg-[#008751] hover:text-white transition-all"
                            >
                                Reconnect
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* STANDBY */
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                    <i className="fas fa-broadcast-tower text-[#008751]/15 text-8xl animate-pulse" />
                    <div className="flex flex-col items-center">
                        <span className="text-white/15 font-black italic text-3xl tracking-[0.3em]">NDR TV HUB</span>
                        <span className="mt-3 text-[9px] text-white/10 font-black uppercase tracking-[0.5em]">Awaiting Admin Command</span>
                    </div>
                </div>
            )}

            {/* ── TV OVERLAY (Bug / Ticker / Controls) ── */}
            {isActive && resolvedUrl && (
                <div className={`transition-opacity duration-700 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                    <TVOverlay
                        isPlaying={status === 'playing'}
                        onTogglePlay={() => { setStatus('loading'); setPlayerKey(k => k + 1); }}
                        channelName="NDR DIGITAL HUB"
                        news={news}
                        adminMessages={adminMessages}
                        isVisible={showControls}
                        volume={volume}
                        onVolumeChange={setVolume}
                    />
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            ` }} />
        </div>
    );
};

export default TVPlayer;
