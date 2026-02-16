import React, { useRef, useState, useEffect } from 'react';
import { MediaFile, NewsItem, AdminMessage } from '../../../types';
import TVOverlay from './TVOverlay';
import TVStinger from './TVStinger';

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
    onMuteChange
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showStinger, setShowStinger] = useState(false);
    const [isMutedInternal, setIsMutedInternal] = useState(false);
    const isMuted = onMuteChange ? isMutedProp : isMutedInternal;
    const setIsMuted = (m: boolean) => {
        if (onMuteChange) onMuteChange(m);
        else setIsMutedInternal(m);
    };

    const [volume, setVolume] = useState(1.0);
    const [showControls, setShowControls] = useState(true); // Auto-hide controls
    const videoRef = useRef<HTMLVideoElement>(null);
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

    // Apply volume to video element
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
        }
    }, [volume]);

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
                        if (videoRef.current) videoRef.current.currentTime = 0;
                    }
                } else {
                    setLastAdvertTimestamp(now); // Reset if no ads found to prevent loop
                }
            }

            // 2. STINGER TIMER (7 minutes = 420,000ms)
            if (now - lastStingerTimestamp >= 420000) {
                console.log("🎬 [TVPlayer] Triggering Scheduled Stinger (7m interval)...");
                setShowStinger(true);
                setLastStingerTimestamp(now);
            }
        }, 5000); // Check every 5s

        return () => clearInterval(interval);
    }, [isActive, isPlaying, isNewsPlaying, isAdmin, lastAdvertTimestamp, lastStingerTimestamp, isAdvertPlaying, allVideos, currentIndex]);

    // 2. Sync with Admin Broadcast & Active State (Force Stinger on Start)
    useEffect(() => {
        if (!isActive) {
            setIsPlaying(false);
            setShowStinger(false);
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

    // 3. Playback Logic
    useEffect(() => {
        if (videoRef.current) {
            const shouldPlayVideo = isPlaying && !isNewsPlaying && isActive && !showStinger;
            if (shouldPlayVideo) {
                videoRef.current.play().catch(e => {
                    console.debug("Playback failed", e);
                    setIsPlaying(false);
                });
            } else {
                videoRef.current.pause();
            }
        }
    }, [isPlaying, currentIndex, isNewsPlaying, isActive, showStinger]);

    // 4. Endless Loop & Stinger Transition Logic
    const handleStingerComplete = () => {
        setShowStinger(false);
        // Advance to next video
        const nextIndex = (currentIndex + 1) % allVideos.length;
        setCurrentIndex(nextIndex);
        setIsPlaying(true);

        // ADMIN SYNC: Signal all listeners to advance
        if (isAdmin && onVideoAdvance) {
            onVideoAdvance(nextIndex);
        }
    };

    const handleEnded = () => {
        if (isAdvertPlaying) {
            console.log("📺 [TVPlayer] Advert completed, returning to main sequence...");
            setCurrentIndex(originalTrackIndex);
            setIsAdvertPlaying(false);
            setShowStinger(true);
        } else if (allVideos.length > 0) {
            // Video ended -> Show Stinger
            setShowStinger(true);
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

    const currentTrack = allVideos[currentIndex] || activeVideo;

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden group select-none shadow-2xl">
            {/* STRICT OVERFLOW CONTROL */}
            {/* 1. TV SECTION */}
            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center space-y-4">
                {(!isActive || !currentTrack) ? (
                    <>
                        <span className="text-xl font-black italic text-white/20">NDR TV</span>
                        {isActive && !currentTrack && (
                            <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-[8px] font-bold text-white/80 uppercase tracking-widest">Signal Offline</span>
                            </div>
                        )}
                    </>
                ) : (
                    <video
                        ref={videoRef}
                        key={currentTrack.url}
                        src={currentTrack.url}
                        className="w-full h-full object-cover pointer-events-none"
                        autoPlay={false}
                        muted={isMuted}
                        playsInline
                        onEnded={handleEnded}
                    />
                )}
            </div>

            {/* 2. STINGER LAYER */}
            {showStinger && (
                <div className="absolute inset-0 z-50">
                    <TVStinger
                        variant="sequence"
                        onComplete={handleStingerComplete}
                        isMuted={isMuted}
                    />
                </div>
            )}


            {/* Overlays (ON AIR MODE: Integrated news ticker) */}
            {isActive && !showStinger && (
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
