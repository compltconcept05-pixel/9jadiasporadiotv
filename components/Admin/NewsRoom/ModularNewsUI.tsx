
import React from 'react';
import { NewsItem } from '../../../types';
import { LEAD_ANCHOR_NAME, STATION_ABBR, STATION_NAME, TAGLINE } from '../../../constants';

interface ModularNewsUIProps {
    news: NewsItem[];
    status: string;
    isProcessing: boolean;
    manualText: string;
    onManualTextChange: (text: string) => void;
    onSaveManualScript: () => Promise<void>;
    onTriggerFavour: () => void;
    onTriggerThompson: () => void;
    onRefreshWire: () => void;
    onClearNews: () => void;
    onStop: () => void;
}

const ModularNewsUI: React.FC<ModularNewsUIProps> = ({
    news,
    status,
    isProcessing,
    manualText,
    onManualTextChange,
    onSaveManualScript,
    onTriggerFavour,
    onTriggerThompson,
    onRefreshWire,
    onClearNews,
    onStop
}) => {
    return (
        <div className="space-y-4 animate-fadeIn h-full flex flex-col bg-gradient-to-br from-green-50 to-white">
            {/* NDRTV Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 rounded-2xl shadow-lg border-b-4 border-green-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-white text-base font-black uppercase tracking-tight">{STATION_ABBR}</h1>
                        <p className="text-green-100 text-[8px] font-medium uppercase tracking-wider">{TAGLINE}</p>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={onRefreshWire}
                            className="text-[8px] bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors font-bold text-white uppercase border border-white/30"
                        >
                            <i className="fas fa-satellite-dish mr-1"></i> Sync Wire
                        </button>
                        <button
                            onClick={onClearNews}
                            className="text-[8px] bg-red-500/80 backdrop-blur-sm px-3 py-1.5 rounded-lg hover:bg-red-600/80 transition-colors font-bold text-white uppercase border border-red-700/50"
                        >
                            <i className="fas fa-trash-alt mr-1"></i> Purge
                        </button>
                    </div>
                </div>
            </div>

            {/* Sara Obosa Anchor Card */}
            <div className="bg-white border-2 border-green-200 rounded-2xl p-4 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-5">
                    <i className="fas fa-microphone text-9xl text-green-600"></i>
                </div>

                <div className="flex items-center space-x-4 relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                        <i className="fas fa-user-tie text-2xl text-white"></i>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                            </span>
                            <h3 className="text-xs font-black uppercase text-green-900 tracking-tight">Lead Anchor</h3>
                        </div>
                        <h2 className="text-xl font-black text-green-800 mb-1">{LEAD_ANCHOR_NAME}</h2>
                        <p className="text-[10px] text-green-600 font-medium uppercase tracking-wide">
                            Professional • Authoritative • BBC-Style Delivery
                        </p>
                    </div>
                </div>

                {/* Broadcast Controls */}
                <div className="mt-4 space-y-2">
                    <button
                        onClick={onTriggerFavour}
                        disabled={isProcessing}
                        className={`w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl text-xs font-black uppercase shadow-[0_4px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[2px] transition-all border-2 border-green-800 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:from-green-700 hover:to-green-800'}`}
                    >
                        {status && status.includes(STATION_ABBR) ? (
                            <><i className="fas fa-broadcast-tower mr-2 animate-pulse"></i> {LEAD_ANCHOR_NAME} ON AIR...</>
                        ) : (
                            <><i className="fas fa-play-circle mr-2"></i> Broadcast News Bulletin</>
                        )}
                    </button>

                    <div className="flex space-x-2">
                        <button
                            onClick={onStop}
                            className="flex-1 bg-black text-white py-3 rounded-xl text-[10px] font-black uppercase shadow-[0_3px_0_#333] active:shadow-none active:translate-y-[2px] transition-all border border-gray-800"
                        >
                            <i className="fas fa-stop mr-1"></i> STOP
                        </button>
                    </div>
                </div>
            </div>

            {/* Status Ticker */}
            {status && (
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 p-3 rounded-xl font-mono text-[9px] text-center shadow-lg border-2 border-yellow-600 uppercase tracking-widest overflow-hidden whitespace-nowrap">
                    <span className="inline-block animate-pulse font-black">{status}</span>
                </div>
            )}

            {/* Headline Feed */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[200px]">
                <div className="sticky top-0 bg-gradient-to-br from-green-50 to-white pb-3 z-10 border-b-2 border-green-200 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <i className="fas fa-newspaper text-green-600 text-sm"></i>
                            <span className="text-[10px] font-black text-green-800 uppercase tracking-widest">Global Wire Feed</span>
                        </div>
                        <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            {news.length} Stories
                        </span>
                    </div>
                </div>

                {news.length === 0 ? (
                    <div className="text-center py-16 opacity-40">
                        <i className="fas fa-satellite-dish text-5xl text-green-300 mb-4"></i>
                        <p className="text-green-400 text-[11px] font-medium uppercase tracking-wide">Awaiting Wire Sync...</p>
                        <p className="text-green-300 text-[10px] mt-2">Auto-scan every 15 minutes</p>
                    </div>
                ) : (
                    news.map((item, idx) => (
                        <div
                            key={item.id}
                            className={`p-4 rounded-xl border-2 mb-3 shadow-sm hover:shadow-md transition-all ${item.priority && item.priority >= 90
                                ? 'bg-red-50 border-red-200 hover:border-red-300'
                                : 'bg-white border-green-100 hover:border-green-300'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-2">
                                    {item.priority && item.priority >= 90 && (
                                        <span className="flex h-2 w-2 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                                        </span>
                                    )}
                                    <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-full ${item.priority && item.priority >= 90
                                        ? 'bg-red-600 text-white'
                                        : 'bg-green-600 text-white'
                                        }`}>
                                        {item.priority && item.priority >= 90 ? '🚨 BREAKING' : item.category || 'NEWS'}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {item.priority && (
                                        <span className="text-[7px] font-mono text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                            P{item.priority}
                                        </span>
                                    )}
                                    <span className="text-[7px] text-gray-400 font-mono">#{idx + 1}</span>
                                </div>
                            </div>
                            <h4 className="text-[10px] font-black text-gray-900 leading-tight mb-2">{item.title}</h4>
                            <p className="text-[9px] text-gray-600 line-clamp-2 leading-relaxed">{item.content}</p>
                            {item.source && (
                                <p className="text-[8px] text-gray-400 mt-2 italic">Source: {item.source}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ModularNewsUI;
