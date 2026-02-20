import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { MediaFile, NewsItem, AdminMessage } from '../../../types';
import TVOverlay from './TVOverlay';

interface TVPlayerProps {
    activeVideo: MediaFile | null;
    allVideos: MediaFile[];
    news: NewsItem[];
    adminMessages: AdminMessage[];
    onPlayStateChange?: (isPlaying: boolean) => void;
    onVideoAdvance?: (index: number) => void;
    isNewsPlaying: boolean;
    isActive: boolean;
    isAdmin?: boolean;
    isMuted?: boolean;
    onMuteChange?: (muted: boolean) => void;
    tvPlaylist?: string[];
    isPreview?: boolean;
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
    isPreview = false
}) => {
    // ── BASIC STATE ──
    const [isPlaying, setIsPlaying] = useState(isActive);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [interactionRequired, setInteractionRequired] = useState(false);
    const [volume, setVolume] = useState(1.0);
    const [showControls, setShowControls] = useState(true);
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const [engineKey, setEngineKey] = useState(0); // Force full remount on zap

    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isMuted = onMuteChange ? isMutedProp : false;

    // ── URL RESOLUTION ──
    const getActiveUrl = () => {
        if (tvPlaylist && tvPlaylist.length > 0) {
            return tvPlaylist[playlistIndex] || '';
        }
        return activeVideo?.url || '';
    };

    const currentUrl = getActiveUrl();

    // ── ACTIONS ──
    const handleEnded = () => {
        console.log("🎬 [TVPlayer] Stream Ended");
        if (tvPlaylist && tvPlaylist.length > 1) {
            setPlaylistIndex(prev => (prev + 1) % tvPlaylist.length);
        } else if (allVideos.length > 0 && onVideoAdvance) {
            onVideoAdvance((allVideos.findIndex(v => v.id === activeVideo?.id) + 1) % allVideos.length);
        } else {
            setIsPlaying(false);
        }
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
        setHasError(false);
    };

    const resetHideTimer = () => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        if (isPlaying) {
            hideTimeoutRef.current = setTimeout(() => setShowControls(false), 5000);
        }
    };

    // COMMAND SYNC: Force reload on any URL change
    useEffect(() => {
        if (tvPlaylist && tvPlaylist.length > 0) {
            setPlaylistIndex(0); // Always start from beginning on new zap
        }
    }, [tvPlaylist?.length, tvPlaylist?.[0]]);

    // COMMAND SYNC: Force reload on any URL change
    useEffect(() => {
        if (currentUrl) {
            console.log("🚀 [TVPlayer] COMMAND RECEIVED: Zapping to", currentUrl);
            setIsLoading(true);
            setHasError(false);
            setInteractionRequired(false);
            setIsPlaying(true);
            setEngineKey(prev => prev + 1); // Atomic Reset
        }
    }, [currentUrl, activeVideo?.id]);

    useEffect(() => {
        if (isPlaying) resetHideTimer();
        else setShowControls(true);
        return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
    }, [isPlaying]);

    // Interaction bridge: longer timeout for Android TV hardware slowness
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLoading && isPlaying && currentUrl && !hasError) {
            timer = setTimeout(() => {
                if (isLoading) {
                    console.warn("🆘 [TVPlayer] Interaction likely required to bypass Autoplay Block");
                    setInteractionRequired(true);
                    setIsLoading(false);
                }
            }, 10000); // 10s wait
        }
        return () => clearTimeout(timer);
    }, [isLoading, isPlaying, currentUrl, hasError]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black overflow-hidden group select-none"
            onClick={resetHideTimer}
            onMouseMove={resetHideTimer}
        >
            {/* THE ENGINE LAYER */}
            <div className="absolute inset-0 z-0">
                {currentUrl ? (
                    <div className="w-full h-full relative" key={`engine-${engineKey}`}>
                        <ReactPlayer
                            url={currentUrl}
                            width="100%"
                            height="100%"
                            playing={isPlaying && !isNewsPlaying}
                            muted={isMuted}
                            volume={volume}
                            onReady={() => {
                                console.log("✅ [TVPlayer] Engine Ready");
                                setIsLoading(false);
                                setInteractionRequired(false);
                            }}
                            onBuffer={() => setIsLoading(true)}
                            onBufferEnd={() => setIsLoading(false)}
                            onPlay={() => {
                                setIsLoading(false);
                                setInteractionRequired(false);
                            }}
                            onEnded={handleEnded}
                            onError={(e) => {
                                console.error("❌ [TVPlayer] Engine Error:", e);
                                setHasError(true);
                                setIsLoading(false);
                            }}
                            playsinline
                            config={{
                                youtube: { playerVars: { autoplay: 1, rel: 0, modestbranding: 1 } },
                                file: {
                                    forceHLS: currentUrl.includes('.m3u8'),
                                    attributes: {
                                        style: { width: '100%', height: '100%', objectFit: 'contain' },
                                        playsInline: true
                                    }
                                }
                            }}
                        />

                        {/* STATUS OVERLAYS */}
                        {isLoading && isPlaying && !hasError && !interactionRequired && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-10 transition-opacity">
                                <div className="w-16 h-16 border-4 border-white/5 border-t-[#008751] rounded-full animate-spin"></div>
                                <span className="mt-6 text-[11px] text-white/50 font-black uppercase tracking-[0.4em] animate-pulse">Establishing Signal...</span>
                            </div>
                        )}

                        {interactionRequired && isPlaying && !hasError && (
                            <div
                                onClick={() => {
                                    setInteractionRequired(false);
                                    setIsLoading(true);
                                    setEngineKey(prev => prev + 1); // Attempt restart with gesture
                                }}
                                className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 cursor-pointer animate-fade-in"
                            >
                                <div className="w-32 h-32 bg-[#008751] rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(0,135,81,0.6)] border-8 border-white/10 animate-bounce">
                                    <i className="fas fa-play text-white text-5xl ml-2"></i>
                                </div>
                                <h2 className="mt-10 text-white font-black text-3xl uppercase tracking-tighter text-center px-10">
                                    Tap to Wake Signal
                                </h2>
                                <p className="mt-3 text-white/40 text-[10px] uppercase font-black tracking-widest text-center px-20">
                                    Browser is blocking automatic playback with sound
                                </p>
                            </div>
                        )}

                        {hasError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30 p-10 text-center animate-fade-in">
                                <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center border border-red-600/20 mb-6 shadow-2xl">
                                    <i className="fas fa-satellite-dish text-red-600 text-5xl"></i>
                                </div>
                                <h3 className="text-white font-black uppercase text-2xl tracking-[0.2em] mb-3">Signal Lost</h3>
                                <p className="text-white/30 text-[10px] mb-10 max-w-sm font-bold uppercase tracking-widest">{currentUrl}</p>
                                <div className="flex flex-col gap-4 w-full max-w-xs">
                                    <button
                                        onClick={() => { setHasError(false); setIsLoading(true); setEngineKey(prev => prev + 1); }}
                                        className="w-full py-5 bg-white text-black font-black uppercase tracking-widest text-sm rounded-xl shadow-2xl hover:bg-[#008751] hover:text-white transition-all transform active:scale-95"
                                    >
                                        Reconnect Satellite
                                    </button>
                                    <button
                                        onClick={handleEnded}
                                        className="w-full py-4 bg-white/5 text-white/40 font-black uppercase tracking-widest text-[9px] rounded-xl border border-white/5 hover:bg-white/10"
                                    >
                                        Skip Channel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center space-y-8 animate-pulse">
                        <i className="fas fa-broadcast-tower text-[#008751]/20 text-8xl"></i>
                        <div className="flex flex-col items-center">
                            <span className="text-white/20 font-black italic text-3xl tracking-[0.3em]">NDR TV HUB</span>
                            <span className="mt-4 text-[10px] text-white/10 font-black uppercase tracking-[0.5em]">Awaiting Admin Command</span>
                        </div>
                    </div>
                )}
            </div>

            {/* OVERLAY LAYER (Controls & Ticker) */}
            {isActive && (
                <div className={`transition-opacity duration-1000 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                    <TVOverlay
                        isPlaying={isPlaying}
                        onTogglePlay={togglePlay}
                        onToggleFullscreen={() => { }}
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
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}} />
        </div>
    );
};

export default TVPlayer;
