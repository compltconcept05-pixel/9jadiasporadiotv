import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;
import { MediaFile, NewsItem, AdminMessage } from '../../../types';
import TVOverlay from './TVOverlay';

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
    const [isPlaying, setIsPlaying] = useState(isActive);
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const prevPlaylistRef = useRef<string[]>([]);
    const lastActiveRef = useRef(isActive);
    const [isMutedInternal, setIsMutedInternal] = useState(false);
    const isMuted = onMuteChange ? isMutedProp : isMutedInternal;
    const setIsMuted = (m: boolean) => {
        if (onMuteChange) onMuteChange(m);
        else setIsMutedInternal(m);
    };

    const [volume, setVolume] = useState(1.0);
    const [showControls, setShowControls] = useState(true); // Auto-hide controls
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    };

    const resetHideTimer = () => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        if (isPlaying) {
            hideTimeoutRef.current = setTimeout(() => setShowControls(false), 5000); // 5s timeout
        } else {
            setShowControls(true); // Persist controls when "black" or paused
        }
    };

    // Auto-hide controls when playing
    useEffect(() => {
        if (isPlaying) {
            resetHideTimer();
        } else {
            setShowControls(true);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        }
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [isPlaying]);

    // Volume effect removed - volume prop handles this

    const [lastAdvertTimestamp, setLastAdvertTimestamp] = useState(Date.now());
    const [lastStingerTimestamp, setLastStingerTimestamp] = useState(Date.now());
    const [isAdvertPlaying, setIsAdvertPlaying] = useState(false);
    const [originalTrackIndex, setOriginalTrackIndex] = useState(0);

    // 1. Sync Play State to Parent
    useEffect(() => {
        onPlayStateChange?.(isPlaying);
    }, [isPlaying, onPlayStateChange]);

    // AUTO-START: When a new social media playlist arrives, reset index and start playing
    useEffect(() => {
        const prev = prevPlaylistRef.current;
        const isNewPlaylist = tvPlaylist.length > 0 && (
            prev.length !== tvPlaylist.length ||
            tvPlaylist.some((url, i) => url !== prev[i])
        );
        if (isNewPlaylist) {
            console.log('📺 [TVPlayer] New playlist received, auto-starting:', tvPlaylist);
            prevPlaylistRef.current = tvPlaylist;
            setPlaylistIndex(0);
            setIsPlaying(true);
        }
    }, [tvPlaylist]);

    // FALLBACK AUTO-PLAY: If active but no video is playing, start the first one
    useEffect(() => {
        if (isActive && !isPlaying && !hasError && !isNewsPlaying) {
            if (activeVideo || allVideos.length > 0 || tvPlaylist.length > 0) {
                console.log('📺 [TVPlayer] Auto-starting playback...');
                setIsPlaying(true);
            }
        }

        // If becoming active, force play
        if (isActive && !lastActiveRef.current) {
            setIsPlaying(true);
        }
        lastActiveRef.current = isActive;
    }, [isActive, isPlaying, hasError, isNewsPlaying, activeVideo, allVideos, tvPlaylist]);

    // TIMER LOGIC: Adverts (10m) and Stingers (15m)
    useEffect(() => {
        if (!isActive || !isPlaying || isNewsPlaying || !isAdmin || isPreview) return;

        const interval = setInterval(() => {
            const now = Date.now();

            // 1. ADVERT TIMER (10 minutes = 600,000ms)
            // Only play if we have adverts and enough time passed
            if (!isAdvertPlaying && (now - lastAdvertTimestamp >= 600000)) {
                const adverts = allVideos.filter(v => v.category === 'adverts');
                if (adverts.length > 0) {
                    console.log("📺 [TVPlayer] Triggering Advert Rotation...");
                    const randomAd = adverts[Math.floor(Math.random() * adverts.length)];
                    const adIndex = allVideos.findIndex(v => v.id === randomAd.id);
                    if (adIndex !== -1) {
                        setOriginalTrackIndex(currentIndex); // Remember where we were
                        setCurrentIndex(adIndex);
                        setIsAdvertPlaying(true);
                        setLastAdvertTimestamp(now);
                        // No stinger for ads, just cut to them for seamless feel
                    }
                } else {
                    setLastAdvertTimestamp(now); // Reset if no ads found to prevent loop
                }
            }

            // 2. STINGER TIMER -> Direct Advance (7 minutes = 420,000ms)
            if (now - lastStingerTimestamp >= 420000) {
                console.log("🎬 [TVPlayer] Auto-Advancing (7m interval)...");
                handleAdvance();
                setLastStingerTimestamp(now);
            }
        }, 5000); // Check every 5s

        return () => clearInterval(interval);
    }, [isActive, isPlaying, isNewsPlaying, isAdmin, lastAdvertTimestamp, lastStingerTimestamp, isAdvertPlaying, allVideos, currentIndex]);

    // 2. Sync with Admin Broadcast & Active State
    useEffect(() => {
        // If inactive, stop EVERYTHING immediately
        if (!isActive) {
            setIsPlaying(false);
            return;
        }

        // If active and we have a specific video from parent
        if (activeVideo) {
            const idx = allVideos.findIndex(v => v.id === activeVideo.id);
            if (idx !== -1) {
                if (currentIndex !== idx || !isPlaying) {
                    setCurrentIndex(idx);
                    setLastStingerTimestamp(Date.now());
                    setIsPlaying(true);
                }
            }
        }
    }, [activeVideo?.id, allVideos, isActive]);

    const handleAdvance = useCallback(() => {
        if (allVideos.length === 0 && tvPlaylist.length === 0) return;

        if (tvPlaylist.length > 0) {
            const nextIdx = (playlistIndex + 1) % tvPlaylist.length;
            setPlaylistIndex(nextIdx);
        } else if (allVideos.length > 0) {
            const nextIndex = (currentIndex + 1) % allVideos.length;
            setCurrentIndex(nextIndex);
            setPlaylistIndex(nextIndex); // This is local, okay for preview
            if (isAdmin && onVideoAdvance && !isPreview) {
                onVideoAdvance(nextIndex);
            }
        }
        setIsPlaying(true);
    }, [currentIndex, allVideos.length, isAdmin, onVideoAdvance, tvPlaylist.length, playlistIndex]);

    // Playback and pause are handled directly by the playing prop in ReactPlayer


    const filterSocialUrl = (url: string) => {
        if (!url) return '';
        const lowercase = url.toLowerCase();

        // 1. YouTube Shorts Transformation
        // shorts/VIDEO_ID -> watch?v=VIDEO_ID
        if (lowercase.includes('youtube.com/shorts/')) {
            console.log("📺 [TVPlayer] Transforming YouTube Short to Watch URL:", url);
            return url.replace('shorts/', 'watch?v=');
        }

        // 2. Stories filtering (usually vertical/unstable)
        if (lowercase.includes('/stories/')) {
            console.warn("🚫 [TVPlayer] Filtering out Story:", url);
            return '';
        }
        return url;
    };

    const handleEnded = () => {
        setHasError(false);
        setIsLoading(true);
        if (isAdvertPlaying) {
            console.log("📺 [TVPlayer] Advert completed, returning to main sequence...");
            setCurrentIndex(originalTrackIndex);
            setIsAdvertPlaying(false);
            handleAdvance();
        } else if (tvPlaylist.length > 0) {
            const nextIdx = playlistIndex + 1;
            if (nextIdx < tvPlaylist.length) {
                console.log("⏭️ [TVPlayer] Advancing Playlist:", nextIdx);
                setPlaylistIndex(nextIdx);
                setIsPlaying(true);
            } else {
                console.log("⏹️ [TVPlayer] Playlist completed.");
                setPlaylistIndex(0); // Loop or Stop? Let's loop for now unless user said otherwise
                setIsPlaying(true);
            }
        } else if (allVideos.length > 0) {
            handleAdvance();
        }
    };

    const togglePlay = () => {
        const newIsPlaying = !isPlaying;
        setIsPlaying(newIsPlaying);
        if (newIsPlaying && isMuted) {
            setIsMuted(false);
        }
        if (hasError) setHasError(false); // Retry on play
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    let currentVideoUrl = '';
    if (tvPlaylist.length > 0) {
        currentVideoUrl = filterSocialUrl(tvPlaylist[playlistIndex]);
        // If current is filtered, try next
        if (!currentVideoUrl && tvPlaylist.length > 1) {
            const nextIdx = (playlistIndex + 1) % tvPlaylist.length;
            currentVideoUrl = filterSocialUrl(tvPlaylist[nextIdx]);
        }
    } else {
        const track = allVideos.find(v => v.id === activeVideo?.id) || activeVideo || allVideos.find(v => v.type === 'video');
        currentVideoUrl = track?.url || '';
    }

    // BROADCAST SYNC: If admin just switched track, ensure we follow
    useEffect(() => {
        if (activeVideo && !isAdmin) {
            const idx = allVideos.findIndex(v => v.id === activeVideo.id);
            if (idx !== -1 && idx !== currentIndex) {
                setCurrentIndex(idx);
            }
        }
    }, [activeVideo, isAdmin, allVideos]);

    // Reset error state if URL changes
    useEffect(() => {
        setHasError(false);
        setIsLoading(true);
    }, [currentVideoUrl]);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden group select-none shadow-2xl">
            {/* 1. TV SECTION */}
            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center space-y-4">
                {currentVideoUrl ? (
                    /* ── HAS A URL: show the embedded player ── */
                    <div className="w-full h-full relative group">
                        <Player
                            url={currentVideoUrl}
                            className="react-player"
                            width="100%"
                            height="100%"
                            playing={isPlaying && !isNewsPlaying}
                            muted={isMuted}
                            volume={volume}
                            onEnded={handleEnded}
                            onPlay={() => { setIsPlaying(true); setIsLoading(false); }}
                            onPause={() => setIsPlaying(false)}
                            onBuffer={() => setIsLoading(true)}
                            onBufferEnd={() => setIsLoading(false)}
                            onReady={() => setIsLoading(false)}
                            onError={(e: any) => {
                                console.error("❌ [TVPlayer] ReactPlayer Error:", e);
                                setHasError(true);
                                setIsLoading(false);
                            }}
                            playsinline
                            config={{
                                youtube: {
                                    playerVars: {
                                        autoplay: 1,
                                        rel: 0,
                                        modestbranding: 1,
                                        origin: window.location.origin
                                    }
                                },
                                facebook: { appId: '966242223397117' }
                            }}
                        />

                        {/* ERROR OVERLAY */}
                        {hasError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-30 p-6 text-center">
                                <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                                <h3 className="text-white font-black uppercase tracking-widest text-sm mb-2">Signal Lost</h3>
                                <p className="text-white/60 text-[10px] leading-relaxed max-w-[200px]">
                                    Unable to stream this source. It may be restricted or private.
                                </p>
                                <button
                                    onClick={() => handleEnded()}
                                    className="mt-4 px-6 py-2 bg-red-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg"
                                >
                                    Try Next Channel
                                </button>
                            </div>
                        )}

                        {/* LOADING OVERLAY */}
                        {isLoading && isPlaying && !hasError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-20">
                                <div className="w-12 h-12 border-4 border-[#008751]/30 border-t-[#008751] rounded-full animate-spin"></div>
                            </div>
                        )}

                        {/* PLAY BUTTON OVERLAY */}
                        {!isPlaying && !hasError && (
                            <div
                                onClick={() => setIsPlaying(true)}
                                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer hover:bg-black/20 transition-all z-20"
                            >
                                <div className="w-20 h-20 bg-[#008751] rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20 transform hover:scale-110 transition-transform">
                                    <i className="fas fa-play text-white text-3xl ml-1"></i>
                                </div>
                                <div className="absolute bottom-10 text-white font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">
                                    Click to Play NDR TV
                                </div>
                            </div>
                        )}
                    </div>
                ) : isActive ? (
                    /* ── ACTIVE but no URL yet: standby ── */
                    <div className="flex flex-col items-center space-y-4">
                        <span className="text-xl font-black italic text-white/40 animate-pulse tracking-widest">NDR TV STANDBY</span>
                        <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            <span className="text-[8px] font-bold text-white/80 uppercase tracking-widest">Connecting to Satellite...</span>
                        </div>
                    </div>
                ) : (
                    /* ── IDLE: not active, no URL ── */
                    <span className="text-xl font-black italic text-white/20">NDR TV</span>
                )}
            </div>

            {/* Overlays (ON AIR MODE: Integrated news ticker) */}
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

            {/* Tap surface to show controls */}
            <div
                className="absolute inset-0 z-30 cursor-pointer"
                onClick={resetHideTimer}
                onMouseMove={resetHideTimer}
            />
        </div>
    );
};

export default TVPlayer;
