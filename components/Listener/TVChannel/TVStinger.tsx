
import React, { useEffect, useState } from 'react';

interface TVStingerProps {
    onComplete?: () => void;
    variant?: 'sequence' | 'loop';
    isMuted?: boolean;
    onToggleMute?: () => void;
    isPlaying?: boolean;
    onTogglePlay?: () => void;
    showControls?: boolean;
}

const TVStinger: React.FC<TVStingerProps> = ({
    onComplete,
    variant = 'sequence',
    isMuted = false,
    onToggleMute,
    isPlaying = true,
    onTogglePlay,
    showControls = false
}) => {
    const [videoError, setVideoError] = useState(false);

    useEffect(() => {
        if (variant === 'loop') return;

        // Safety timeout in case video event doesn't fire
        const t = setTimeout(() => onComplete?.(), 20000);
        return () => clearTimeout(t);
    }, [onComplete, variant]);

    const handleVideoEnded = () => {
        if (variant === 'sequence') {
            onComplete?.();
        }
    };

    return (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden group">
            {/* Background Video */}
            {!videoError ? (
                <video
                    key="/diaspora tv.mp4"
                    src="/diaspora tv.mp4"
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    loop={variant === 'loop'}
                    playsInline
                    onError={() => setVideoError(true)}
                    muted={isMuted}
                    onEnded={handleVideoEnded}
                    ref={(el) => {
                        if (el) {
                            // Direct attribute sync for robustness
                            el.muted = isMuted;
                            if (isPlaying) el.play().catch(() => { });
                            else el.pause();
                        }
                    }}
                />
            ) : (
                // Fallback Gradient if video missing
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#001a00_0%,_#000000_100%)]"></div>
            )}

            {/* ... station bug ... */}

            {/* Conditional Controls */}
            {showControls && !isPlaying && (
                <div className="absolute bottom-6 right-6 z-50 flex items-center space-x-3">
                    {/* Play/Pause Toggle */}
                    {onTogglePlay && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePlay();
                            }}
                            className="w-10 h-10 bg-black/60 hover:bg-[#008751] backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-95"
                        >
                            {isPlaying ? (
                                <i className="fas fa-pause text-xs"></i>
                            ) : (
                                <i className="fas fa-play text-xs ml-0.5"></i>
                            )}
                        </button>
                    )}

                    {/* Mute Toggle */}
                    {onToggleMute && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleMute();
                            }}
                            className="w-10 h-10 bg-black/60 hover:bg-white/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-95"
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? (
                                <i className="fas fa-volume-mute text-xs text-red-500"></i>
                            ) : (
                                <i className="fas fa-volume-up text-xs"></i>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Cinematic Letterbox Bars (Optional - retained for style, or can remove if user wants 100% fullscreen) 
                Keeping them adds a "TV" feel. Removing text is the main request.
            */}
            <div className="absolute top-0 left-0 right-0 h-[10%] bg-black z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[10%] bg-black z-10 pointer-events-none"></div>
        </div>
    );
};

export default TVStinger;
