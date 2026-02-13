
import React, { useEffect, useState } from 'react';

interface TVStingerProps {
    onComplete?: () => void;
    variant?: 'sequence' | 'loop';
    isMuted?: boolean;
    onToggleMute?: () => void;
    showControls?: boolean;
}

const TVStinger: React.FC<TVStingerProps> = ({
    onComplete,
    variant = 'sequence',
    isMuted = false,
    onToggleMute,
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
                    src="/diaspora tv.mp4"
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    loop={variant === 'loop'}
                    playsInline
                    onError={() => setVideoError(true)}
                    muted={isMuted}
                    onEnded={handleVideoEnded}
                />
            ) : (
                // Fallback Gradient if video missing
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#001a00_0%,_#000000_100%)]"></div>
            )}

            {/* 1. TOP LEFT: STATION BUG (Reduced Size & Tighter Position) - Copied from TVOverlay */}
            <div className={`absolute top-2 left-2 animate-tv-pop z-50`}>
                <div className="flex items-center bg-black/40 backdrop-blur-sm px-1.5 py-0.5 border border-white/10 shadow-lg">
                    <span className="text-[9px] font-black tracking-tighter drop-shadow-md flex italic">
                        <span className="text-[#008751]">ND</span>
                        <span className="text-white">R</span>
                        <span className="text-[#008751]">TV</span>
                    </span>
                </div>
            </div>

            {/* Conditional Controls (For Offline Mode) */}
            {showControls && onToggleMute && (
                <div className="absolute bottom-4 right-4 z-50 flex items-center space-x-2">
                    {/* Mute Toggle */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleMute();
                        }}
                        className="w-8 h-8 bg-black/60 hover:bg-white/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-95"
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? (
                            <i className="fas fa-volume-mute text-[10px] text-red-500"></i>
                        ) : (
                            <i className="fas fa-volume-up text-[10px]"></i>
                        )}
                    </button>
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
