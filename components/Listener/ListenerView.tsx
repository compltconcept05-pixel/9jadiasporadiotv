import React, { useState, useEffect, useCallback, useRef } from 'react';
import TVPlayer from './TVChannel/TVPlayer';
import { NewsItem, MediaFile, AdminMessage, ListenerReport } from '../../types';
import { dbService } from '../../services/dbService';
import { CHANNEL_INTRO, DESIGNER_NAME, APP_NAME } from '../../constants';

interface ListenerViewProps {
  stationState: any;
  news: NewsItem[];
  adminMessages: AdminMessage[];
  reports: ListenerReport[];
  onPlayTrack: (track: MediaFile) => void;
  onPlayVideo: (video: MediaFile) => void;
  activeVideo: MediaFile | null;
  isNewsPlaying: boolean;
  isTvActive: boolean;
  allVideos: MediaFile[];
  isRadioPlaying: boolean;
  onRadioToggle: (play: boolean) => void;
  onTvToggle: (active: boolean) => void;
  onVideoAdvance?: (index: number) => void;
  isAdmin?: boolean;
  onReport?: (report: ListenerReport) => Promise<void>;
}

const ListenerView: React.FC<ListenerViewProps> = ({
  stationState,
  news,
  adminMessages = [],
  reports,
  onPlayTrack,
  onPlayVideo,
  activeVideo,
  isNewsPlaying,
  isTvActive,
  allVideos,
  isRadioPlaying,
  onRadioToggle,
  onTvToggle,
  onVideoAdvance,
  isAdmin = false,
  onReport
}) => {
  const [location, setLocation] = useState<string>('Syncing...');
  const [localTime, setLocalTime] = useState<string>('');
  const [reportText, setReportText] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [shareFeedback, setShareFeedback] = useState('');
  const [isTvPlaying, setIsTvPlaying] = useState(false);

  const timerRef = useRef<number | null>(null);

  const nextAd = useCallback(() => {
    if (allVideos.length > 0) {
      setAdIndex((prev) => (prev + 1) % allVideos.length);
    }
  }, [allVideos.length]);

  useEffect(() => {
    if (allVideos.length > 0) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        nextAd();
      }, 20000);
    }
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [adIndex, allVideos.length, nextAd]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => setLocation(`Node: ${pos.coords.latitude.toFixed(1)}, ${pos.coords.longitude.toFixed(1)}`), () => setLocation('Global Diaspora'));
    }
    const timer = setInterval(() => setLocalTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleShare = async () => {
    const text = "📻 Tune in to Nigeria Diaspora Radio (NDR)! The voice of Nigerians abroad. Live news and culture. Listen here: ";
    const url = window.location.href.split('?')[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Nigeria Diaspora Radio', text, url });
        setShareFeedback('Shared!');
      } else {
        await navigator.clipboard.writeText(`${text}${url}`);
        setShareFeedback('Link Copied!');
      }
    } catch (err) {
      console.warn("Share failed", err);
    } finally {
      setTimeout(() => setShareFeedback(''), 3000);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    const reportData = {
      id: Math.random().toString(36).substring(2, 9),
      reporterName: 'Listener',
      location,
      content: reportText,
      timestamp: Date.now()
    };
    if (onReport) {
      await onReport(reportData);
    } else {
      await dbService.addReport(reportData);
    }
    setReportText('');
    setIsReporting(false);
    setShareFeedback('Report Sent!');
    setTimeout(() => setShareFeedback(''), 3000);
  };

  const currentAd = allVideos[adIndex];

  return (
    <div className="flex-grow flex flex-col pt-2 pb-8 px-5 text-[#008751] space-y-4">
      {/* 2. INVITE FRIENDS / LOCATION (MATCHING SCREENSHOT POSITION) */}
      <div className="flex justify-between items-center bg-white/40 p-3 rounded-2xl border border-green-50 shadow-sm relative overflow-hidden shrink-0 mt-2">
        <div className="flex flex-col z-10">
          <span className="text-[8px] font-black uppercase tracking-widest text-green-600/60">{location}</span>
          <span className="text-[9px] font-mono text-green-900/40 font-black">{localTime}</span>
        </div>
        <button
          onClick={handleShare}
          className="relative z-10 bg-[#008751]/80 hover:bg-green-700 text-white px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all flex items-center space-x-1"
        >
          <i className="fas fa-paper-plane text-[8px]"></i>
          <span>{shareFeedback || 'Invite Friends'}</span>
        </button>
      </div>

      {/* 3. NEWS TICKER */}
      <section className={`bg-green-50/10 rounded-xl border border-green-100/30 h-8 flex items-center overflow-hidden shrink-0 transition-opacity duration-500 ${isRadioPlaying ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`flex whitespace-nowrap items-center ${isRadioPlaying ? 'animate-marquee' : ''}`}>
          <span className="text-[10px] font-black text-green-800 uppercase px-12 tracking-widest inline-block">{CHANNEL_INTRO}</span>
          {adminMessages.map((msg, i) => (
            <span key={`admin-${i}`} className="text-[10px] text-red-600 font-black uppercase px-12 flex items-center inline-block">
              <i className="fas fa-bullhorn mr-2"></i> {msg.text}
              <span className="ml-12 text-green-200">|</span>
            </span>
          ))}
          {news.map((n, i) => (
            <span key={`ticker-${i}`} className="text-[10px] text-green-700 font-bold uppercase px-12 flex items-center inline-block">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-3 animate-pulse"></span>
              {n.title}
              <span className="ml-12 text-green-200">|</span>
            </span>
          ))}
        </div>
      </section>

      {/* 4. TV / SPONSORED HIGHLIGHTS */}
      <section className="shrink-0 w-full mt-2 group">
        <div className="flex items-center space-x-2 px-1 mb-2">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
          <h3 className="text-[9px] font-black uppercase text-green-700/60 tracking-[0.2em]">Sponsored Highlights</h3>
        </div>
        <div className={`bg-black shadow-2xl w-full overflow-hidden rounded-3xl border-4 border-white/50 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] h-[180px]`}>
          <TVPlayer
            activeVideo={activeVideo}
            allVideos={allVideos.filter(v => v.type === 'video')}
            news={news}
            adminMessages={adminMessages}
            onPlayStateChange={(playing) => {
              setIsTvPlaying(playing);
              if (playing) {
                onRadioToggle(false);
                onTvToggle(true);
              }
            }}
            onRadioPlay={() => {
              onRadioToggle(true);
            }}
            onVideoAdvance={onVideoAdvance}
            isNewsPlaying={isNewsPlaying}
            isActive={isTvActive}
            isAdmin={isAdmin}
          />
        </div>
      </section>

      {/* 5. ADS */}
      <section className="shrink-0 bg-white border border-gray-100 rounded-3xl p-5 flex items-center justify-between overflow-hidden shadow-sm mt-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-gray-800 uppercase leading-none tracking-widest">Premium African Fashion</span>
          <span className="text-[9px] text-gray-400 font-medium mt-1 uppercase italic">Shop the latest styles direct from Lagos</span>
        </div>
        <button className="bg-blue-600 text-white text-[9px] px-5 py-2 rounded-full font-black uppercase tracking-widest shadow-lg">Shop Now</button>
      </section>

      {/* 6. GLOBAL FEED */}
      <section className="flex flex-col space-y-3 mt-4">
        <div className="flex items-center space-x-2 px-1">
          <i className="fas fa-globe-africa text-green-700/60 text-[9px]"></i>
          <h3 className="text-[9px] font-black uppercase text-green-700/60 tracking-widest">Global Community Feed</h3>
        </div>
        <div className="bg-white/40 border border-green-50 rounded-2xl p-4 shadow-inner flex flex-col">
          {reports.length > 0 ? (
            <div className="space-y-1.5 overflow-y-auto no-scrollbar">
              {reports.slice(0, 4).map((r) => (
                <div key={r.id} className="bg-white/80 p-4 rounded-2xl border border-green-50/50 shadow-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-green-900 uppercase flex items-center">
                      <i className="fas fa-map-marker-alt mr-2 text-red-500"></i> {r.location}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-green-950 leading-relaxed font-medium italic">"{r.content}"</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
              <span className="text-[5px] font-black uppercase tracking-widest">Feed syncing...</span>
            </div>
          )}
        </div>
      </section>

      {/* 6. JOURNALIST HQ */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase text-green-700/60 tracking-widest px-1">Journalist HQ</h3>
        <div className="bg-white/40 border border-dashed border-green-200/50 rounded-2xl p-4 shadow-sm">
          {!isReporting ? (
            <button
              onClick={() => setIsReporting(true)}
              className="w-full py-4 text-[10px] font-black text-green-800 uppercase tracking-widest flex items-center justify-center bg-white/80 rounded-2xl border border-green-50 shadow-md active:scale-95 transition-all"
            >
              <i className="fas fa-microphone-alt mr-3 text-red-500 text-[10px]"></i> Report City Happenings
            </button>
          ) : (
            <form onSubmit={handleReport} className="flex flex-col space-y-3 animate-scale-in">
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="What's happening?..."
                className="bg-green-50/50 border border-green-100 rounded-2xl p-4 text-xs h-32 outline-none focus:border-green-400 font-medium resize-none shadow-inner"
              />
              <div className="flex space-x-3">
                <button type="submit" className="flex-1 bg-green-800 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl">
                  Broadcast
                </button>
                <button type="button" onClick={() => setIsReporting(false)} className="px-6 bg-white text-green-900 py-3 rounded-xl text-[10px] font-black border border-green-100">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER - Spec-aligned single line at the absolute bottom */}
      <footer className="w-full text-center pb-4 pt-10 mt-auto flex flex-col items-center space-y-4">
        {/* DOWNLOAD SECTION */}
        <div className="flex flex-col items-center space-y-2">
          <span className="text-[8px] font-black uppercase text-green-800/40 tracking-widest">Get the Official App</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.open('https://github.com/thompsonway03-netizen/diasporadio.tv/raw/main/diaspora-radio.apk', '_blank')}
              className="bg-black text-white px-4 py-2 rounded-xl flex items-center space-x-2 shadow-lg active:scale-95 transition-all border border-white/10"
            >
              <i className="fab fa-android text-xl text-green-400"></i>
              <div className="flex flex-col items-start translate-y-[-1px]">
                <span className="text-[6px] font-black uppercase leading-none opacity-60">Download for</span>
                <span className="text-[10px] font-black leading-none">Android APK</span>
              </div>
            </button>
            <button
              className="bg-black text-white px-4 py-2 rounded-xl flex items-center space-x-2 shadow-lg opacity-40 cursor-not-allowed border border-white/10"
            >
              <i className="fab fa-apple text-xl text-blue-400"></i>
              <div className="flex flex-col items-start translate-y-[-1px]">
                <span className="text-[6px] font-black uppercase leading-none opacity-60">Coming soon to</span>
                <span className="text-[10px] font-black leading-none">iOS App Store</span>
              </div>
            </button>
          </div>
        </div>

        <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-black/5 backdrop-blur-md rounded-full border border-green-900/10 shadow-sm mx-auto">
          <span className="text-[7.5px] font-black uppercase text-green-950/60 tracking-tighter">{APP_NAME}</span>
          <span className="text-green-900/10 scale-y-125 px-0.5">|</span>
          <span className="text-[7.5px] text-green-700/60 font-mono tracking-tighter">© 2026</span>
          <span className="text-green-900/10 scale-y-125 px-0.5">|</span>
          <span className="text-[7.5px] font-bold text-green-800/80 uppercase tracking-tighter">Designed by {DESIGNER_NAME}</span>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: inline-flex; animation: marquee 50s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div >
  );
};

export default ListenerView;
