import React from 'react';
import { NewsItem, AdminMessage } from '../../../types';
import { CHANNEL_INTRO } from '../../../constants';

interface TVOverlayProps {
    isPlaying: boolean;
    onTogglePlay: () => void;
    onToggleFullscreen?: () => void;
    channelName: string;
    news: NewsItem[];
    adminMessages: AdminMessage[];
    isVisible?: boolean;
    volume?: number;
    onVolumeChange?: (volume: number) => void;
}

const TVOverlay: React.FC<TVOverlayProps> = ({
    isPlaying,
    onTogglePlay,
    onToggleFullscreen,
    channelName,
    news,
    adminMessages,
    isVisible = true,
    volume = 1,
    onVolumeChange
}) => {
    return (
        <div className="absolute inset-0 z-40 pointer-events-none group select-none">
            {/* 1. TOP LEFT: STATION BUG (Clean floating text) */}
            <div className={`absolute top-4 left-4 animate-tv-pop z-20 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center scale-150 origin-left">
                    <span className="text-[11px] font-black tracking-tighter flex italic uppercase text-white">
                        <span className="text-[#008751]">ND</span>
                        <span>R</span>
                        <span className="text-[#008751]">TV</span>
                    </span>
                </div>
            </div>

            {/* 2. TOP RIGHT: STATUS (Reduced Size & Tighter Position) */}
            <div className={`absolute top-2 right-2 z-20 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center space-x-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 border border-white/10 shadow-lg">
                    <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                    <span className="text-[6px] font-black text-white/90 uppercase tracking-[0.1em]">ON-AIR</span>
                </div>
            </div>

            {/* 3. BOTTOM: INTEGRATED NEWS TICKER (Inside Screen) */}
            <div className={`absolute bottom-0 inset-x-0 h-6 bg-[#008751] backdrop-blur-md border-t border-white/20 flex items-center overflow-hidden z-20 transition-opacity duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}>
                {/* ... flag ... */}
                <div className="flex h-full px-2 items-center bg-black/20 border-r border-white/10 shrink-0">
                    <div className="flex w-4 h-2.5 rounded-[1px] overflow-hidden shadow-sm">
                        <div className="flex-1 bg-[#008751]"></div>
                        <div className="flex-1 bg-white"></div>
                        <div className="flex-1 bg-[#008751]"></div>
                    </div>
                </div>

                <div className={`flex whitespace-nowrap items-center ${isPlaying ? 'animate-tv-marquee' : 'opacity-50'}`}>
                    <span className="text-[7px] font-black text-white uppercase px-6 tracking-widest inline-block">{CHANNEL_INTRO}</span>
                    {adminMessages.map((msg, i) => (
                        <span key={`tv-admin-${i}`} className="text-[7px] text-red-100 font-black uppercase px-6 flex items-center inline-block">
                            <i className="fas fa-bullhorn mr-2"></i> {msg.text}
                            <span className="ml-6 text-white/40">|</span>
                        </span>
                    ))}
                    {news.map((n, i) => (
                        <span key={`tv-ticker-${i}`} className="text-[7px] text-white font-bold uppercase px-6 flex items-center inline-block">
                            <span className="w-1 h-1 bg-red-400 rounded-full mr-2 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span>
                            {n.title}
                            <span className="ml-6 text-white/40">|</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* 4. CONTROLS DECK (BOTTOM CORNERS) */}
            <div className={`absolute bottom-8 inset-x-4 flex justify-between items-end pointer-events-none z-50 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                {/* LEFT: PLAY/PAUSE */}
                <div className="pointer-events-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePlay();
                        }}
                        className="w-11 h-11 bg-white/20 hover:bg-green-600/90 backdrop-blur-2xl border-2 border-white/40 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all active:scale-90"
                        title={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? (
                            <i className="fas fa-pause text-xs"></i>
                        ) : (
                            <i className="fas fa-play text-xs ml-1"></i>
                        )}
                    </button>
                </div>

                {/* CENTER-ISH: VOLUME SLIDER (TV Style - Horizontal Bottom Right) */}
                <div className="pointer-events-auto flex items-center bg-black/60 backdrop-blur-md px-3 py-2 rounded-full border border-white/20 shadow-2xl mr-12 mb-0.5">
                    <i className="fas fa-volume-down text-[10px] text-white/80 mr-3"></i>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
                        className="w-24 h-1 appearance-none bg-white/20 rounded-full outline-none accent-[#008751] cursor-pointer"
                    />
                    <i className="fas fa-volume-up text-[10px] text-white/80 ml-3"></i>
                </div>

                {/* RIGHT: FULLSCREEN */}
                <div className="pointer-events-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFullscreen?.();
                        }}
                        className="w-11 h-11 bg-white/20 hover:bg-white/40 backdrop-blur-2xl border-2 border-white/40 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all active:scale-90"
                        title="Fullscreen"
                    >
                        <i className="fas fa-expand text-xs"></i>
                    </button>
                </div>
            </div>

            {/* Subtle Gradient Overlays */}
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent"></div>
            <div className="absolute inset-x-0 bottom-6 h-12 bg-gradient-to-t from-black/40 to-transparent"></div>

            {/* Marquee Animation */}
            <style dangerouslySetInnerHTML={{
                __html: `
                 @keyframes tv-marquee { 
                    0% { transform: translateX(0); } 
                    100% { transform: translateX(-50%); } 
                }
                @keyframes earth-spin {
                    from { background-position: 0% center; }
                    to { background-position: -200% center; }
                }
                .animate-tv-marquee { 
                    display: inline-flex; 
                    animation: tv-marquee 40s linear infinite; 
                }
                .animate-earth-spin {
                    animation: earth-spin 20s linear infinite;
                }
            `}} />
        </div>
    );
};

export default TVOverlay;
