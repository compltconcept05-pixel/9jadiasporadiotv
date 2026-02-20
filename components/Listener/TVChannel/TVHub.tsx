import React, { useState, useEffect, useRef, useCallback } from 'react';
import TVPlayer from './TVPlayer';
import { NewsItem, AdminMessage, MediaFile } from '../../../types';
import { APP_NAME } from '../../../constants';

interface TVHubProps {
    activeVideo: MediaFile | null;
    allVideos: MediaFile[];
    news: NewsItem[];
    adminMessages: AdminMessage[];
    isTvActive: boolean;
    tvPlaylist: string[];
    onVideoAdvance?: (index: number) => void;
    isNewsPlaying: boolean;
    isAdmin?: boolean;
    isMuted?: boolean;
}

const TVHub: React.FC<TVHubProps> = ({
    activeVideo,
    allVideos,
    news,
    adminMessages,
    isTvActive,
    tvPlaylist,
    onVideoAdvance,
    isNewsPlaying,
    isAdmin = false,
    isMuted = false
}) => {
    const [lastZapTime, setLastZapTime] = useState<number>(0);
    const [showZapOverlay, setShowZapOverlay] = useState(false);
    const [zapMessage, setZapMessage] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // 1. ZAP NOTIFICATION: When the playlist or video changes, show a sleek TV-style popup
    useEffect(() => {
        if (isTvActive && (activeVideo || tvPlaylist.length > 0)) {
            const now = Date.now();
            if (now - lastZapTime > 2000) { // Throttle zap notifications
                setZapMessage(tvPlaylist.length > 0 ? "NEW STREAM INCOMING" : "BROADCAST TUNING...");
                setShowZapOverlay(true);
                setLastZapTime(now);
                const timer = setTimeout(() => setShowZapOverlay(false), 4000);
                return () => clearTimeout(timer);
            }
        }
    }, [activeVideo, tvPlaylist, isTvActive]);

    if (!isTvActive) return null;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center overflow-hidden animate-fade-in"
        >
            {/* --- MAIN RECEIVER ENGINE --- */}
            <div className="absolute inset-0 w-full h-full">
                <TVPlayer
                    activeVideo={activeVideo}
                    allVideos={allVideos}
                    news={news}
                    adminMessages={adminMessages}
                    isNewsPlaying={isNewsPlaying}
                    isActive={isTvActive}
                    isAdmin={isAdmin}
                    isMuted={isMuted}
                    tvPlaylist={tvPlaylist}
                    onVideoAdvance={onVideoAdvance}
                />
            </div>

            {/* --- LEANBACK OVERLAYS (Android TV Style) --- */}

            {/* 1. TOP STATUS BAR */}
            <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start pointer-events-none z-[510] bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center space-x-4">
                    <div className="bg-[#008751] px-4 py-1.5 rounded-sm shadow-xl border-l-4 border-white/50">
                        <span className="text-white text-xl font-black italic tracking-tighter">{APP_NAME} <span className="text-white/50 ml-1">TV</span></span>
                    </div>
                    {isNewsPlaying && (
                        <div className="bg-red-600 px-3 py-1 animate-pulse flex items-center space-x-2">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            <span className="text-white text-[10px] font-black uppercase tracking-widest">Live News Breaking</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-white/40 text-[10px] font-bold tracking-widest uppercase">Global Reception</span>
                    <div className="flex items-center space-x-1 mt-1">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`w-1 h-3 rounded-full ${i <= 3 ? 'bg-green-500' : 'bg-white/20'}`}></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. ZAP NOTIFICATION POPUP */}
            {showZapOverlay && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-10 py-5 bg-black/80 backdrop-blur-3xl border-l-8 border-[#008751] shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[520] flex items-center space-x-6 animate-slide-up">
                    <div className="p-3 bg-white/5 rounded-full ring-1 ring-white/10">
                        <i className="fas fa-satellite-dish text-[#008751] text-2xl animate-pulse"></i>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em]">Signal Optimized</span>
                        <span className="text-white text-2xl font-black uppercase tracking-tighter">{zapMessage}</span>
                    </div>
                </div>
            )}

            {/* 3. BOTTOM NEWS TICKER (Only if not in Social mode or if preferred) */}
            {news.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-md border-t border-white/5 z-[515] flex items-center">
                    <div className="bg-red-700 h-full px-8 flex items-center justify-center shrink-0">
                        <span className="text-white font-black text-sm italic tracking-widest">WIRE</span>
                    </div>
                    <div className="flex-grow overflow-hidden relative">
                        <div className="flex whitespace-nowrap animate-marquee-tv py-2">
                            {news.map((item, idx) => (
                                <div key={idx} className="inline-flex items-center mx-12">
                                    <span className="text-yellow-400 text-xs font-black uppercase mr-4">[{item.category}]</span>
                                    <span className="text-white text-base font-bold tracking-tight">{item.title}</span>
                                </div>
                            ))}
                            {/* Duplicate for seamless loop */}
                            {news.map((item, idx) => (
                                <div key={`loop-${idx}`} className="inline-flex items-center mx-12">
                                    <span className="text-yellow-400 text-xs font-black uppercase mr-4">[{item.category}]</span>
                                    <span className="text-white text-base font-bold tracking-tight">{item.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-up { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
                @keyframes marquee-tv {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-fade-in { animation: fade-in 1s ease-out forwards; }
                .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .animate-marquee-tv { animation: marquee-tv 40s linear infinite; }
            `}} />
        </div>
    );
};

export default TVHub;
