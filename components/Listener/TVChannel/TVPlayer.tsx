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
    tvPlaylist = []
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMutedInternal, setIsMutedInternal] = useState(false);
    const isMuted = onMuteChange ? isMutedProp : isMutedInternal;
    const setIsMuted = (m: boolean) => {
        if (onMuteChange) onMuteChange(m);
        else setIsMutedInternal(m);
    };

    const [volume, setVolume] = useState(1.0);
    const [showControls, setShowControls] = useState(true); // Auto-hide controls
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

    // TIMER LOGIC: Adverts (10m) and Stingers (15m)
    useEffect(() => {
        if (!isActive || !isPlaying || isNewsPlaying || !isAdmin) return;

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

    // 2. Sync with Admin Broadcast & Active State (Force Stinger on Start)
    useEffect(() => {
        if (!isActive) {
            setIsPlaying(false);
        } else if (activeVideo) {
            // Check if this is a "Fresh" start of TV execution
            // We can infer this if we weren't playing before
            const idx = allVideos.findIndex(v => v.id === activeVideo.id);
            if (idx !== -1) {
                // ONLY RESET IF ID CHANGED OR WE ARE STARTING
                if (currentIndex !== idx || !isPlaying) {
                    setCurrentIndex(idx);
                    // ONLY SHOW STINGER IF NOT ADMIN - Admins already hear it/see it on their monitor, avoids double sound
                    // ONLY SHOW STINGER IF NOT ADMIN AND 7 MINUTES ELAPSED
                    // Removed initial trigger
                    setLastStingerTimestamp(Date.now());
                    setIsPlaying(true);
                }
            }
        }
    }, [activeVideo?.id, allVideos, isActive]);

    const handleAdvance = useCallback(() => {
        const nextIndex = (currentIndex + 1) % allVideos.length;
        setCurrentIndex(nextIndex);
        setIsPlaying(true);
        if (isAdmin && onVideoAdvance) {
            onVideoAdvance(nextIndex);
        }
    }, [currentIndex, allVideos.length, isAdmin, onVideoAdvance]);

    // Playback and pause are handled directly by the playing prop in ReactPlayer

    const filterSocialUrl = (url: string) => {
        if (!url) return '';
        const lowercase = url.toLowerCase();
        // Skip Shorts or Stories
        if (lowercase.includes('/shorts/') || lowercase.includes('/stories/')) {
            console.warn("🚫 [TVPlayer] Filtering out Short/Story:", url);
            return '';
        }
        return url;
    };

    const handleEnded = () => {
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

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden group select-none shadow-2xl">
            {/* STRICT OVERFLOW CONTROL */}
            {/* 1. TV SECTION */}
            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center space-y-4">
                {(isActive && !currentVideoUrl) ? (
                    <div className="flex flex-col items-center space-y-4">
                        <span className="text-xl font-black italic text-white/40 animate-pulse tracking-widest">NDR TV STANDBY</span>
                        <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            <span className="text-[8px] font-bold text-white/80 uppercase tracking-widest">Connecting to Satellite...</span>
                        </div>
                    </div>
                ) : !isActive ? (
                    <>
                        <span className="text-xl font-black italic text-white/20">NDR TV</span>
                        {isActive && !currentVideoUrl && (
                            <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-[8px] font-bold text-white/80 uppercase tracking-widest">Signal Offline</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full relative group">
                        <Player
                            url={currentVideoUrl}
                            className="react-player"
                            width="100%"
                            height="100%"
                            playing={isPlaying && !isNewsPlaying && isActive}
                            muted={isMuted}
                            volume={volume}
                            onEnded={handleEnded}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            playsinline
                        />

                        {/* PLAY BUTTON OVERLAY (Visible when not playing or on standby) */}
                        {(!isPlaying || !isActive) && (
                            <div
                                onClick={() => {
                                    setIsPlaying(true);
                                    if (!isActive && isAdmin) setIsPlaying(true);
                                }}
                                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer group-hover:bg-black/20 transition-all z-20"
                            >
                                <div className="w-20 h-20 bg-[#008751] rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20 transform group-hover:scale-110 transition-transform">
                                    <i className="fas fa-play text-white text-3xl ml-1"></i>
                                </div>
                                <div className="absolute bottom-10 text-white font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">
                                    Click to Play NDR TV
                                </div>
                            </div>
                        )}
                    </div>
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
