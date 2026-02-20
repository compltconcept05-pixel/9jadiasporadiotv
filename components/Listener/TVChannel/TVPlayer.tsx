import React, { useRef, useState, useEffect, useCallback } from 'react';
import _ReactPlayer from 'react-player';
const ReactPlayer = _ReactPlayer as any;
import Hls from 'hls.js';
import { supabase } from '../../../services/supabaseClient';
import { MediaFile, NewsItem, AdminMessage } from '../../../types';
import TVOverlay from './TVOverlay';

const HlsPlayer: React.FC<{
    url: string;
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    onEnded: () => void;
    onError: () => void;
    onReady: () => void;
}> = ({ url, isPlaying, isMuted, volume, onEnded, onError, onReady }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                onReady();
                if (isPlaying) video.play().catch(e => console.warn("Autoplay blocked:", e));
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.error("HLS Fatal Error:", data);
                    onError();
                }
            });
            return () => {
                hls.destroy();
            };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
                onReady();
                if (isPlaying) video.play().catch(e => console.warn("Autoplay blocked:", e));
            });
        }
    }, [url, onReady, onError]);

    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            video.muted = isMuted;
            video.volume = volume;
            if (isPlaying) {
                video.play().catch(() => { });
            } else {
                video.pause();
            }
        }
    }, [isPlaying, isMuted, volume]);

    return (
        <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            onEnded={onEnded}
        />
    );
};

interface TVPlayerProps {
    activeVideo: MediaFile | null;
    allVideos: MediaFile[];
    news: NewsItem[];
    adminMessages: AdminMessage[];
    onPlayStateChange?: (isPlaying: boolean) => void;
    onRadioPlay?: () => void; // Start radio playback from TV play button
    onVideoAdvance?: (index: number) => void; // Sync for Admin
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
    onRadioPlay,
    onVideoAdvance,
    isNewsPlaying,
    isActive,
    isAdmin = false,
    isMuted: isMutedProp = false,
    onMuteChange,
    tvPlaylist = [],
    isPreview = false
}) => {
    // ── STATE ──
    const [isPlaying, setIsPlaying] = useState(isActive);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const [isMutedInternal, setIsMutedInternal] = useState(false);
    const [volume, setVolume] = useState(1.0);
    const [showControls, setShowControls] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [playerKey, setPlayerKey] = useState(0);
    const [interactionRequired, setInteractionRequired] = useState(false);

    // ── REFS ──
    const lastActiveRef = useRef(isActive);
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [lastAdvertTimestamp, setLastAdvertTimestamp] = useState(Date.now());
    const [lastStingerTimestamp, setLastStingerTimestamp] = useState(Date.now());
    const [isAdvertPlaying, setIsAdvertPlaying] = useState(false);

    const isMuted = onMuteChange ? isMutedProp : isMutedInternal;
    const setIsMuted = (m: boolean) => {
        if (onMuteChange) onMuteChange(m);
        else setIsMutedInternal(m);
    };

    // ── HELPERS ──
    const filterSocialUrl = (url: string) => {
        if (!url) return '';
        let cleanUrl = url.trim();
        try {
            const urlObj = new URL(cleanUrl);
            const paramsToStrip = ['fbclid', 'ref', 'app', 'utm_source', 'utm_medium', 'utm_campaign', 'mibextid', 'share_id', 'share_link_id', 'rdid', 'extid', 'hash'];
            paramsToStrip.forEach(p => urlObj.searchParams.delete(p));
            if (urlObj.hostname === 'm.facebook.com') urlObj.hostname = 'www.facebook.com';
            if (urlObj.hostname === 'm.youtube.com') urlObj.hostname = 'www.youtube.com';
            if (urlObj.pathname.includes('/share/v/')) {
                const videoId = urlObj.pathname.split('/share/v/')[1]?.split('/')[0];
                if (videoId) return `https://www.facebook.com/watch?v=${videoId}`;
            }
            cleanUrl = urlObj.toString();
        } catch (e) { }
        const lowercase = cleanUrl.toLowerCase();
        if (lowercase.includes('youtube.com/shorts/')) return cleanUrl.replace('shorts/', 'watch?v=');
        if (lowercase.includes('youtu.be/')) {
            const id = cleanUrl.split('youtu.be/')[1]?.split(/[?#]/)[0];
            return id ? `https://www.youtube.com/watch?v=${id}` : cleanUrl;
        }
        return cleanUrl;
    };

    let currentVideoUrl = '';
    if (tvPlaylist.length > 0) {
        currentVideoUrl = filterSocialUrl(tvPlaylist[playlistIndex]);
    } else {
        const track = allVideos.find(v => v.id === activeVideo?.id) || activeVideo;
        currentVideoUrl = track?.url || '';
    }

    const handleAdvance = useCallback(() => {
        if (allVideos.length === 0 && tvPlaylist.length === 0) return;
        if (tvPlaylist.length > 0) {
            setPlaylistIndex((prev) => (prev + 1) % tvPlaylist.length);
        } else {
            const nextIdx = (currentIndex + 1) % allVideos.length;
            if (onVideoAdvance) onVideoAdvance(nextIdx);
            else setCurrentIndex(nextIdx);
        }
        setIsPlaying(true);
    }, [currentIndex, allVideos.length, onVideoAdvance, tvPlaylist.length]);

    const handleEnded = () => {
        console.log("🎬 [TVPlayer] Media ended.");
        if (tvPlaylist.length > 1) {
            setPlaylistIndex((prev) => (prev + 1) % tvPlaylist.length);
        } else {
            setIsPlaying(false);
        }
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
        if (!isPlaying && isMuted) setIsMuted(false);
        if (hasError) setHasError(false);
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) containerRef.current.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
    };

    const resetHideTimer = () => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        if (isPlaying) hideTimeoutRef.current = setTimeout(() => setShowControls(false), 5000);
    };

    // ── EFFECTS ──

    // Engine Key & State Reset on URL change
    useEffect(() => {
        setHasError(false);
        setIsLoading(true);
        setPlayerKey(prev => prev + 1);
        setInteractionRequired(false);
    }, [currentVideoUrl]);

    // Play State Sync
    useEffect(() => {
        if (onPlayStateChange) onPlayStateChange(isPlaying);
    }, [isPlaying, onPlayStateChange]);

    // Loading Watchdog
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLoading && isPlaying && currentVideoUrl) {
            timer = setTimeout(() => {
                if (isLoading) {
                    setHasError(true);
                    setIsLoading(false);
                }
            }, 25000);
        }
        return () => clearTimeout(timer);
    }, [isLoading, isPlaying, currentVideoUrl, hasError]);

    // Stalemate Watchdog (User Interaction)
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLoading && isPlaying && currentVideoUrl && !hasError) {
            timer = setTimeout(() => {
                if (isLoading) {
                    setInteractionRequired(true);
                    setIsLoading(false);
                }
            }, 6000); // 6s to detect blocked autoplay
        }
        return () => clearTimeout(timer);
    }, [isLoading, isPlaying, currentVideoUrl, hasError]);

    // Sync from Admin
    useEffect(() => {
        if (isActive && !isAdmin && activeVideo) {
            const idx = allVideos.findIndex(v => v.id === activeVideo.id);
            if (idx !== -1 && idx !== currentIndex) {
                setCurrentIndex(idx);
                setIsPlaying(true);
            }
        }
    }, [activeVideo?.id, allVideos, isActive, isAdmin, currentIndex]);

    // Auto-hide controls
    useEffect(() => {
        if (isPlaying) resetHideTimer();
        else setShowControls(true);
        return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
    }, [isPlaying]);

    // Timer Logic: Adverts / Stingers
    useEffect(() => {
        if (!isActive || !isPlaying || isNewsPlaying || isAdmin) return;
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastAdvertTimestamp > 10 * 60 * 1000) {
                const adverts = allVideos.filter(v => v.category === 'adverts');
                if (adverts.length > 0 && !isAdvertPlaying) {
                    setIsAdvertPlaying(true);
                    setLastAdvertTimestamp(now);
                }
            }
            if (now - lastStingerTimestamp > 15 * 60 * 1000) {
                const stingers = allVideos.filter(v => v.category === 'stinger');
                if (stingers.length > 0) {
                    setLastStingerTimestamp(now);
                    handleAdvance();
                }
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [isActive, isPlaying, isNewsPlaying, isAdmin, lastAdvertTimestamp, lastStingerTimestamp, isAdvertPlaying, allVideos, handleAdvance]);

    // ── ENGINE DETECTION ──
    const isHLS = currentVideoUrl.includes('.m3u8') || currentVideoUrl.includes('iptv');
    const isDirectVideo = !isHLS && (currentVideoUrl.match(/\.(mp4|webm|ogv|mov)$/) || currentVideoUrl.includes('supabase.co') || currentVideoUrl.startsWith('blob:'));
    const isSocial = currentVideoUrl.includes('youtube.com') || currentVideoUrl.includes('youtu.be') || currentVideoUrl.includes('facebook.com') || currentVideoUrl.includes('fb.watch') || currentVideoUrl.includes('instagram.com');

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden group select-none shadow-2xl">
            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center">
                {currentVideoUrl ? (
                    <div className="w-full h-full relative">
                        {isDirectVideo ? (
                            <video
                                key={`video-${playerKey}`}
                                src={currentVideoUrl}
                                className="w-full h-full object-contain"
                                autoPlay={isPlaying && !isNewsPlaying}
                                muted={isMuted}
                                playsInline
                                onEnded={handleEnded}
                                onError={() => setHasError(true)}
                                onCanPlay={() => setIsLoading(false)}
                                onPlay={() => { setIsPlaying(true); setIsLoading(false); setInteractionRequired(false); }}
                            />
                        ) : isHLS ? (
                            <HlsPlayer
                                key={`hls-${playerKey}`}
                                url={currentVideoUrl}
                                isPlaying={isPlaying && !isNewsPlaying}
                                isMuted={isMuted}
                                volume={volume}
                                onEnded={handleEnded}
                                onError={() => setHasError(true)}
                                onReady={() => { setIsLoading(false); setInteractionRequired(false); }}
                            />
                        ) : isSocial ? (
                            <ReactPlayer
                                key={`social-${playerKey}`}
                                url={currentVideoUrl}
                                width="100%"
                                height="100%"
                                playing={isPlaying && !isNewsPlaying}
                                muted={isMuted}
                                volume={volume}
                                onEnded={handleEnded}
                                onPlay={() => { setIsPlaying(true); setIsLoading(false); setInteractionRequired(false); }}
                                onReady={() => { setIsLoading(false); }}
                                onError={() => setHasError(true)}
                                playsinline
                                config={{ youtube: { playerVars: { autoplay: 1, rel: 0 } } }}
                            />
                        ) : (
                            <iframe
                                src={currentVideoUrl}
                                className="w-full h-full border-0 bg-white"
                                allow="autoplay; encrypted-media; fullscreen"
                                onLoad={() => setIsLoading(false)}
                            />
                        )}

                        {/* OVERLAYS */}
                        {hasError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30 p-6 text-center">
                                <i className="fas fa-satellite-dish text-red-500 text-5xl mb-4"></i>
                                <h3 className="text-white font-black uppercase text-lg mb-2">Signal Lost</h3>
                                <button
                                    onClick={() => setPlayerKey(prev => prev + 1)}
                                    className="px-8 py-3 bg-indigo-600 text-white font-black uppercase rounded-full"
                                >
                                    Hard Reset Signal
                                </button>
                                <button onClick={handleEnded} className="mt-4 text-white/40 uppercase text-[8px]">Skip Channel</button>
                            </div>
                        )}

                        {isLoading && isPlaying && !hasError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-20">
                                <div className="w-12 h-12 border-4 border-t-white border-white/20 rounded-full animate-spin"></div>
                                <span className="mt-4 text-[8px] text-white/60 font-black uppercase tracking-widest">Syncing Satellite...</span>
                            </div>
                        )}

                        {interactionRequired && isPlaying && !hasError && (
                            <div
                                onClick={() => {
                                    setInteractionRequired(false);
                                    setPlayerKey(prev => prev + 1);
                                }}
                                className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 cursor-pointer"
                            >
                                <div className="w-24 h-24 bg-[#008751] rounded-full flex items-center justify-center animate-pulse">
                                    <i className="fas fa-satellite-dish text-white text-3xl"></i>
                                </div>
                                <h2 className="mt-6 text-white font-black text-xl uppercase tracking-tighter">Satellite Connected</h2>
                                <p className="mt-1 text-white/60 text-[8px] uppercase font-bold">Tap to start audio reception</p>
                            </div>
                        )}

                        {!isPlaying && !hasError && (
                            <div
                                onClick={() => setIsPlaying(true)}
                                className="absolute inset-0 flex items-center justify-center bg-black/60 z-[45]"
                            >
                                <div className="w-20 h-20 bg-[#008751] rounded-full flex items-center justify-center shadow-2xl">
                                    <i className="fas fa-play text-white text-3xl ml-1"></i>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <span className="text-xl font-black italic text-white/40 animate-pulse tracking-widest">NDR TV STANDBY</span>
                    </div>
                )}
            </div>

            {isActive && (
                <TVOverlay
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlay}
                    onToggleFullscreen={toggleFullscreen}
                    channelName="NDRTV"
                    news={news}
                    adminMessages={adminMessages}
                    isVisible={showControls}
                    volume={volume}
                    onVolumeChange={setVolume}
                />
            )}

            <div className="absolute inset-0 z-30 pointer-events-none md:pointer-events-auto" onClick={resetHideTimer} />
        </div>
    );
};

export default TVPlayer;
