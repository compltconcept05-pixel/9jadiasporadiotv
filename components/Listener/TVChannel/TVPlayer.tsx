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

    const filterSocialUrl = (url: string) => {
        if (!url) return '';
        let cleanUrl = url.trim();

        // 1. Mobile Translation & Parameter Cleaning
        // Strip tracking junk first (?fbclid, ?ref, etc.)
        try {
            const urlObj = new URL(cleanUrl);
            const paramsToStrip = ['fbclid', 'ref', 'app', 'utm_source', 'utm_medium', 'utm_campaign', 'mibextid'];
            paramsToStrip.forEach(p => urlObj.searchParams.delete(p));

            // Translate Mobile Hostnames
            if (urlObj.hostname === 'm.facebook.com') urlObj.hostname = 'www.facebook.com';
            if (urlObj.hostname === 'm.youtube.com') urlObj.hostname = 'www.youtube.com';

            cleanUrl = urlObj.toString();
        } catch (e) {
            console.warn("⚠️ [TVPlayer] URL Parse error, using original:", cleanUrl);
        }

        const lowercase = cleanUrl.toLowerCase();

        // 2. YouTube Short URLs & Shorts
        if (lowercase.includes('youtube.com/shorts/')) return cleanUrl.replace('shorts/', 'watch?v=');
        if (lowercase.includes('youtu.be/')) {
            const id = cleanUrl.split('youtu.be/')[1]?.split(/[?#]/)[0];
            return id ? `https://www.youtube.com/watch?v=${id}` : cleanUrl;
        }

        // 3. Facebook/Instagram Reels & Watch Transformations
        if (lowercase.includes('instagram.com/reels/') || lowercase.includes('instagram.com/reel/')) {
            console.log("🎬 [TVPlayer] Transforming Instagram Reel for compatibility...");
            return cleanUrl.replace('/reels/', '/p/').replace('/reel/', '/p/');
        }

        // 4. Stories filtering
        if (lowercase.includes('/stories/')) return '';

        return cleanUrl;
    };

    let currentVideoUrl = '';
    if (tvPlaylist.length > 0) {
        currentVideoUrl = filterSocialUrl(tvPlaylist[playlistIndex]);
        if (!currentVideoUrl && tvPlaylist.length > 1) {
            const nextIdx = (playlistIndex + 1) % tvPlaylist.length;
            currentVideoUrl = filterSocialUrl(tvPlaylist[nextIdx]);
        }
    } else {
        const track = allVideos.find(v => v.id === activeVideo?.id) || activeVideo;
        currentVideoUrl = track?.url || '';
    }

    // 1. Sync Play State to Parent
    useEffect(() => {
        if (onPlayStateChange) onPlayStateChange(isPlaying);
    }, [isPlaying]);

    // 2. Loading Watchdog (25s)
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLoading && isPlaying && currentVideoUrl) {
            console.log(`⏳ [TVPlayer] Starting loading watchdog (25s) for: ${currentVideoUrl}`);
            timer = setTimeout(() => {
                if (isLoading) {
                    console.warn("⚠️ [TVPlayer] Loading timeout (25s) reached.");
                    setHasError(true);
                    setIsLoading(false);
                }
            }, 25000); // Increased to 25s for slow social SDKs
        }
        return () => clearTimeout(timer);
    }, [isLoading, isPlaying, currentVideoUrl]);

    // 3. Auto-play trigger & Aggressive Loading Bypass
    useEffect(() => {
        if (currentVideoUrl && (isActive || isPreview)) {
            setIsPlaying(true);
            setHasError(false);
            setIsLoading(true);

            // AGGRESSIVE BYPASS: Force hide spinner after 2s to show native player
            const bypassTimer = setTimeout(() => {
                if (isLoading) {
                    console.log("🚀 [TVPlayer] Aggressive Bypass: Hiding spinner to show native player");
                    setIsLoading(false);
                }
            }, 2000);
            return () => clearTimeout(bypassTimer);
        }
    }, [currentVideoUrl, isActive, isPreview]);

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
                                        origin: window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin
                                    }
                                },
                                facebook: { appId: '966242223397117' }
                            }}
                        />

                        {/* ERROR OVERLAY */}
                        {hasError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl z-30 p-6 text-center">
                                <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4 animate-pulse"></i>
                                <h3 className="text-white font-black uppercase tracking-widest text-sm mb-2">Signal Lost</h3>
                                <p className="text-white/60 text-[10px] leading-relaxed max-w-[200px] mb-4">
                                    Unable to stream this source. The link might be private, restricted, or in an unsupported format (like some Reels).
                                </p>

                                {isAdmin && (
                                    <div className="bg-white/5 p-2 rounded border border-white/10 mb-4 w-full overflow-hidden">
                                        <p className="text-[7px] text-white/40 uppercase mb-1 font-bold">Admin Diagnostic URL:</p>
                                        <p className="text-[8px] text-indigo-400 break-all font-mono">{currentVideoUrl}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => {
                                            setHasError(false);
                                            setIsLoading(true);
                                            // Trigger a state change to force-reload the player
                                            setIsPlaying(false);
                                            setTimeout(() => setIsPlaying(true), 100);
                                        }}
                                        className="px-6 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        Retry Link
                                    </button>
                                    <button
                                        onClick={() => handleEnded()}
                                        className="px-6 py-2 bg-red-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg hover:bg-red-700 transition-colors"
                                    >
                                        Try Next Channel
                                    </button>
                                </div>
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsPlaying(true);
                                }}
                                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer hover:bg-black/20 transition-all z-[45] group"
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
