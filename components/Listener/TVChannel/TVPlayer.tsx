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

        // 1. WhatsApp-style Link Pre-processing
        try {
            const urlObj = new URL(cleanUrl);
            const paramsToStrip = [
                'fbclid', 'ref', 'app', 'utm_source', 'utm_medium', 'utm_campaign',
                'mibextid', 'share_id', 'share_link_id', 'rdid', 'extid', 'hash'
            ];
            paramsToStrip.forEach(p => urlObj.searchParams.delete(p));

            // Translate Hostnames
            if (urlObj.hostname === 'm.facebook.com') urlObj.hostname = 'www.facebook.com';
            if (urlObj.hostname === 'm.youtube.com') urlObj.hostname = 'www.youtube.com';

            // 2. Facebook Share/Video Link Expansion
            // Handles: facebook.com/share/v/[ID]/ or facebook.com/share/r/[ID]/
            if (urlObj.pathname.includes('/share/v/') || urlObj.pathname.includes('/share/r/')) {
                const parts = urlObj.pathname.split('/');
                const idIndex = parts.findIndex(p => p === 'v' || p === 'r') + 1;
                const videoId = parts[idIndex];
                if (videoId) {
                    console.log("🎬 [TVPlayer] Expanding Facebook Share link:", videoId);
                    return `https://www.facebook.com/watch/?v=${videoId}`;
                }
            }

            // 3. YouTube Studio & Channel Handling
            // YouTube Studio: studio.youtube.com/video/[ID]/edit -> watch?v=[ID]
            if (urlObj.hostname === 'studio.youtube.com') {
                if (urlObj.pathname.includes('/video/')) {
                    const videoId = urlObj.pathname.split('/video/')[1]?.split('/')[0];
                    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
                }
                if (urlObj.pathname.includes('/channel/')) {
                    const channelId = urlObj.pathname.split('/channel/')[1]?.split('/')[0];
                    if (channelId && channelId.startsWith('UC')) {
                        const uploadPlaylistId = channelId.replace('UC', 'UU');
                        return `https://www.youtube.com/playlist?list=${uploadPlaylistId}`;
                    }
                }
            }

            // YouTube Channels (The user wants to "play all" - we point to the uploads playlist)
            // Detect /channel/UC[ID]
            if (urlObj.hostname.includes('youtube.com') && (urlObj.pathname.includes('/channel/') || urlObj.pathname.includes('/c/') || urlObj.pathname.includes('/@'))) {
                const channelId = urlObj.pathname.split('/channel/')[1]?.split('/')[0];
                if (channelId && channelId.startsWith('UC')) {
                    const uploadPlaylistId = channelId.replace('UC', 'UU');
                    console.log("🎬 [TVPlayer] Converting Channel to Uploads Playlist:", uploadPlaylistId);
                    return `https://www.youtube.com/playlist?list=${uploadPlaylistId}`;
                }
                // For handles (@name) or custom IDs, we try to pass them through as is, 
                // but usually they need a specific ID for the UU trick.
            }

            // 4. Facebook Profile Detection (Informative only)
            if (urlObj.hostname.includes('facebook.com') && (urlObj.pathname.includes('profile.php') || !urlObj.pathname.includes('/videos/'))) {
                console.warn("⚠️ [TVPlayer] Profile link detected. Specific video links are recommended.");
            }

            cleanUrl = urlObj.toString();
        } catch (e) {
            console.warn("⚠️ [TVPlayer] URL Parse error, using original:", cleanUrl);
        }

        const lowercase = cleanUrl.toLowerCase();

        // 4. YouTube Short URLs & Shorts
        if (lowercase.includes('youtube.com/shorts/')) return cleanUrl.replace('shorts/', 'watch?v=');
        if (lowercase.includes('youtu.be/')) {
            const id = cleanUrl.split('youtu.be/')[1]?.split(/[?#]/)[0];
            return id ? `https://www.youtube.com/watch?v=${id}` : cleanUrl;
        }

        // 5. Facebook/Instagram Reels & Watch Transformations
        if (lowercase.includes('instagram.com/reels/') || lowercase.includes('instagram.com/reel/')) {
            console.log("🎬 [TVPlayer] Transforming Instagram Reel for compatibility...");
            return cleanUrl.replace('/reels/', '/p/').replace('/reel/', '/p/');
        }

        if (lowercase.includes('facebook.com/reels/')) {
            console.log("🎬 [TVPlayer] Transforming Facebook Reel...");
            // FB Reels often work best if we just let ReactPlayer attempt it with the clean URL
        }

        // 6. Stories filtering
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
                        {/* DUAL-ENGINE: If URL contains supabase or is direct file, use native video tag */}
                        {(currentVideoUrl.includes('supabase.co') || currentVideoUrl.includes('.mp4') || currentVideoUrl.includes('.webm') || currentVideoUrl.startsWith('blob:')) ? (
                            <video
                                src={currentVideoUrl}
                                className="w-full h-full object-contain"
                                autoPlay={isPlaying && !isNewsPlaying}
                                muted={isMuted}
                                playsInline
                                onEnded={handleEnded}
                                onError={(e) => {
                                    console.error("❌ [TVPlayer] Native Video Error:", e);
                                    setHasError(true);
                                    setIsLoading(false);
                                }}
                                onCanPlay={() => setIsLoading(false)}
                                onLoadStart={() => setIsLoading(true)}
                                onPlay={() => { setIsPlaying(true); setIsLoading(false); }}
                                onPause={() => setIsPlaying(false)}
                            />
                        ) : (
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
                        )}

                        {/* ERROR OVERLAY */}
                        {hasError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl z-30 p-6 text-center">
                                <div className="p-5 bg-red-500/10 rounded-full mb-4 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                                    <i className="fas fa-satellite-dish text-red-500 text-5xl animate-pulse"></i>
                                </div>
                                <h3 className="text-white font-black uppercase tracking-[0.3em] text-lg mb-2">Signal Lost</h3>
                                <p className="text-white/60 text-[10px] leading-relaxed max-w-[250px] mb-6 font-medium">
                                    Unable to stream this source. The media might be restricted, private, or temporarily unavailable.
                                    {currentVideoUrl.includes('facebook') && !currentVideoUrl.includes('v=') && " Try pasting a direct video link instead of a profile."}
                                    {currentVideoUrl.includes('studio.youtube') && " This looks like an internal studio link. Use a public watch link."}
                                </p>

                                {isAdmin && (
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 mb-6 w-full max-w-[300px] overflow-hidden">
                                        <p className="text-[7px] text-white/40 uppercase mb-1.5 font-bold tracking-widest">Admin Diagnostic Link:</p>
                                        <p className="text-[8px] text-indigo-400 break-all font-mono leading-tight">{currentVideoUrl}</p>
                                    </div>
                                )}

                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={() => {
                                            setHasError(false);
                                            setIsLoading(true);
                                            // Trigger a state change to force-reload the player
                                            setIsPlaying(false);
                                            setTimeout(() => setIsPlaying(true), 100);
                                        }}
                                        className="px-8 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full shadow-lg hover:bg-indigo-700 transition-all active:scale-95 border-b-4 border-indigo-800"
                                    >
                                        Retry Signal
                                    </button>
                                    <button
                                        onClick={() => handleEnded()}
                                        className="px-8 py-3 bg-white/10 text-white text-[10px] font-black uppercase rounded-full shadow-lg hover:bg-white/20 transition-all active:scale-95 border-b-4 border-white/5"
                                    >
                                        Skip Channel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* LOADING OVERLAY */}
                        {isLoading && isPlaying && !hasError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[4px] z-20">
                                <div className="w-16 h-16 border-4 border-[#008751]/10 border-t-[#008751] rounded-full animate-spin"></div>
                                <span className="mt-4 text-[8px] font-black text-white/40 uppercase tracking-[0.4em] animate-pulse">Synchronizing Satellite...</span>
                            </div>
                        )}

                        {/* PLAY BUTTON OVERLAY */}
                        {!isPlaying && !hasError && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsPlaying(true);
                                }}
                                className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[8px] cursor-pointer hover:bg-black/40 transition-all z-[45] group"
                            >
                                <div className="w-24 h-24 bg-[#008751] rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(0,135,81,0.5)] border-4 border-white/10 transform group-hover:scale-110 transition-transform duration-500">
                                    <i className="fas fa-play text-white text-4xl ml-2"></i>
                                </div>
                                <div className="absolute bottom-12 text-white font-black uppercase tracking-[0.5em] text-[11px] animate-pulse bg-black/40 px-6 py-2 rounded-full border border-white/10">
                                    Live Stream • Tap to Watch
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
