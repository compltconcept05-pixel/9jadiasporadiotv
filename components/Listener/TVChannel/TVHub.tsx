import React, { useRef } from 'react';
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
    const containerRef = useRef<HTMLDivElement>(null);

    if (!isTvActive) return null;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[500] bg-black flex flex-col overflow-hidden animate-fade-in"
        >
            {/* THE ENGINE */}
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

            {/* MINIMAL LEANBACK UI */}
            <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start pointer-events-none z-10 bg-gradient-to-b from-black/60 to-transparent">
                <div className="bg-[#008751] px-4 py-2 rounded shadow-2xl border-l-4 border-white">
                    <span className="text-white text-xl font-black italic tracking-tighter">
                        {APP_NAME} <span className="text-white/50 ml-1">TV</span>
                    </span>
                </div>

                <div className="flex flex-col items-end opacity-40">
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">Digital Satellite Link</span>
                    <div className="flex gap-1 mt-1">
                        {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-green-500 rounded-full"></div>)}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 1s ease-out forwards; }
            `}} />
        </div>
    );
};

export default TVHub;
