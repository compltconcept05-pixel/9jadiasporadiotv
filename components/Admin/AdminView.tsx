
import React, { useState, useRef } from 'react';
import { AdminLog, MediaFile, AdminMessage, NewsItem, ListenerReport } from '../../types';
import { dbService } from '../../services/dbService';
import { NEWSCASTER_NAME } from '../../constants';
import ModularNewsUI from './NewsRoom/ModularNewsUI';
import TVPlayer from '../Listener/TVChannel/TVPlayer';

interface AdminViewProps {
  onRefreshData: () => void;
  logs: AdminLog[];
  onPlayTrack: (track: MediaFile) => void;
  isRadioPlaying: boolean;
  onToggleRadio: (play: boolean) => void;
  currentTrackName: string;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  onPlayAll: () => void;
  onSkipNext: () => void;
  onPushBroadcast: (text: string) => Promise<void>;
  onPlayJingle?: (index: 1 | 2) => Promise<void>;
  news?: NewsItem[];
  onTriggerFullBulletin?: () => Promise<void>;
  onTriggerManualBroadcast?: () => Promise<void>;
  onTriggerPodcast?: (text: string) => Promise<void>; // Deprecated but kept for compatibility
  onPlayPodcastFile?: (file: File) => Promise<void>; // New
  onPlayDirectTTS?: (text: string) => Promise<void>; // New
  onSaveManualScript?: (script: string) => Promise<void>; // New
  onClearNews?: () => void; // New
  onStopNews?: () => void; // New
  manualScript?: string; // New
  newsHistory?: NewsItem[]; // New
  onManualBroadcast?: (item: NewsItem) => void; // New
  onAddNews?: (item: NewsItem) => void; // New
  onUpdateNews?: (item: NewsItem) => void; // New
  onDeleteNews?: (id: string) => void; // New
  mediaFiles: MediaFile[];
  status?: string;
  onRefreshWire?: () => void;
  activeVideoId?: string | null;
  onPlayVideo?: (track: MediaFile | number | string, isLive?: boolean) => void;
  previewVideoId?: string | null;
  previewPlaylist?: string[];
  tvPlaylist?: string[];
  onUpdatePlaylist?: (playlist: string[]) => void;
  isTvActive?: boolean;
  onToggleTv?: (active: boolean) => void;
  onResetSync?: () => void;
  onLogAdd?: (action: string) => void;
  reports?: ListenerReport[];
  onDeleteMedia?: (id: string, fileName?: string) => Promise<void>;
}

type Tab = 'command' | 'bulletin' | 'manual' | 'media' | 'inbox' | 'logs' | 'podcast';
type MediaSubTab = 'audio' | 'video';

const AdminView: React.FC<AdminViewProps> = ({
  onRefreshData,
  logs,
  onPlayTrack,
  isRadioPlaying,
  onToggleRadio,
  currentTrackName,
  isShuffle,
  onToggleShuffle,
  onPlayAll,
  onSkipNext,
  onPushBroadcast,
  onPlayJingle,
  news = [],
  onTriggerFullBulletin,
  onTriggerManualBroadcast,
  onTriggerPodcast,
  onPlayPodcastFile,
  onPlayDirectTTS,
  onSaveManualScript,
  onClearNews,
  onStopNews,
  manualScript = '',
  newsHistory = [],
  onManualBroadcast,
  onAddNews,
  onUpdateNews,
  onDeleteNews,
  mediaFiles = [], status, onRefreshWire, activeVideoId, onPlayVideo, previewVideoId, previewPlaylist, tvPlaylist = [], onUpdatePlaylist, isTvActive, onToggleTv, onResetSync, onDeleteMedia, onLogAdd, reports
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('command');
  const [mediaSubTab, setMediaSubTab] = useState<MediaSubTab>('audio');
  const [reportsSearch, setReportsSearch] = useState('');
  const [reportFilter, setReportFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

  const TV_PRESETS = [
    { name: 'Channels TV', url: 'https://www.youtube.com/watch?v=vv_8S9C2m1Q', icon: '📺' },
    { name: 'NTA News 24', url: 'https://www.youtube.com/watch?v=FjS6oExf_Bw', icon: '🇳🇬' },
    { name: 'Arise News', url: 'https://www.youtube.com/watch?v=tI9eO9rYq9I', icon: '🌍' },
    { name: 'TVC News', url: 'https://www.youtube.com/watch?v=gT5_yK4N8A0', icon: '📡' },
    { name: 'France 24', url: 'https://www.youtube.com/watch?v=g25G1mL2t9w', icon: '🇫🇷' },
    { name: 'Al Jazeera', url: 'https://www.youtube.com/watch?v=gCneWGVz8a8', icon: '🌙' }
  ];
  const [isProcessing, setIsProcessing] = useState(false);
  const [internalStatus, setInternalStatus] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [podcastText, setPodcastText] = useState('');
  const [manualText, setManualText] = useState(manualScript);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<{ title: string; content: string; category: NewsItem['category'] }>({ title: '', content: '', category: 'Manual' });
  const [selectedJingleUrl, setSelectedJingleUrl] = useState<string>('');
  const [uploadedAppUrl, setUploadedAppUrl] = useState<string>('');
  const [socialLinks, setSocialLinks] = useState<string[]>(['', '', '']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLSelectElement>(null);

  // Auto-sync manualText and socialLinks when props change
  React.useEffect(() => {
    setManualText(manualScript);
    if (tvPlaylist && tvPlaylist.length > 0) {
      const newLinks = [...socialLinks];
      tvPlaylist.forEach((link, i) => { if (i < 3) newLinks[i] = link; });
      setSocialLinks(newLinks);
    }
  }, [manualScript, tvPlaylist]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, isFolder: boolean = false) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setInternalStatus(`Uploading ${files.length} items...`);

    try {
      console.log('🚀 Starting upload for', files.length, 'files');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let type: 'audio' | 'video' | 'image' = 'audio';
        if (file.type.startsWith('video')) type = 'video';
        else if (file.type.startsWith('image')) type = 'image';

        // Detect if we are uploading to the Adverts folder
        const category = activeTab === 'media' && mediaSubTab === 'video' && folderInputRef.current?.value === 'adverts' ? 'adverts' : undefined;

        const folder = category === 'adverts' ? 'adverts' : (type === 'audio' ? 'music' : type === 'video' ? 'videos' : 'images');
        setInternalStatus(`Uploading ${file.name}...`);

        console.log(`📤 Uploading file: ${file.name} to folder: ${folder}`);
        const publicUrl = await dbService.uploadMediaToCloud(file, folder);

        if (!publicUrl) {
          throw new Error(`Upload failed: Storage returned no URL for ${file.name}`);
        }

        console.log(`✅ File uploaded to Storage. URL: ${publicUrl}`);
        setInternalStatus(`Saving ${file.name} to database...`);

        const newMedia: MediaFile = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: publicUrl,
          type: type,
          category: category,
          timestamp: Date.now(),
          likes: 0
        };

        await dbService.addMediaCloud(newMedia);
        console.log(`✅ Database record created for: ${file.name}`);
      }
      onRefreshData();
      setInternalStatus('✅ Cloud Upload complete!');
    } catch (error: any) {
      console.error('❌ Cloud Process failed:', error);
      setInternalStatus(`❌ Error: ${error.message || 'Check connection'}`);
    } finally {
      setIsProcessing(false);
      // Increased timeout for errors
      const isErr = internalStatus && internalStatus.includes('❌');
      setTimeout(() => setInternalStatus(''), isErr ? 15000 : 3000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAppUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.apk')) {
      alert('❌ Error: Only .apk files are allowed for app updates.');
      if (appFileInputRef.current) appFileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setInternalStatus(`Uploading Android App (${file.name})...`);

    try {
      console.log('🚀 Starting App Update upload:', file.name);
      const publicUrl = await dbService.uploadAppToCloud(file);

      if (!publicUrl) {
        throw new Error('Upload failed: Storage returned no URL');
      }

      console.log(`✅ App updated in Storage. URL: ${publicUrl}`);
      setUploadedAppUrl(publicUrl);
      setInternalStatus('✅ App Upload complete!');
      onLogAdd?.(`System: Android App updated to version ${file.name}`);
    } catch (error: any) {
      console.error('❌ App Update failed:', error);
      setInternalStatus(`❌ App Update Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setInternalStatus(''), 8000);
      if (appFileInputRef.current) appFileInputRef.current.value = '';
    }
  };

  const handleLiveBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setIsProcessing(true);
    setInternalStatus('Broadcasting...');
    try {
      await onPushBroadcast(broadcastText);
      setBroadcastText('');
      setInternalStatus('Broadcast Sent!');
    } catch (e) {
      setInternalStatus('Error broadcasting');
    }
    setIsProcessing(false);
    setTimeout(() => setInternalStatus(''), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-green-50/50 p-2 space-y-3 overflow-y-auto custom-scrollbar">
      {/* --- THEATER MODE: DUAL MONITOR SYSTEM --- */}
      <div className="grid grid-cols-2 gap-3 w-full shrink-0">
        {/* 1. PREVIEW MONITOR */}
        <div className="flex flex-col space-y-2">
          <div className="aspect-video bg-black rounded-xl border-2 border-blue-400 shadow-2xl relative overflow-hidden group">
            <TVPlayer
              activeVideo={mediaFiles.find(m => m.id === previewVideoId) || null}
              allVideos={mediaFiles.filter(v => v.type === 'video')}
              news={[]}
              adminMessages={[]}
              isNewsPlaying={false}
              isActive={true}
              isAdmin={true}
              isMuted={false}
              tvPlaylist={previewPlaylist}
              isPreview={true}
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 text-white text-[7px] font-black rounded uppercase tracking-widest z-40 opacity-90 shadow-sm">Preview Monitor</div>
            <div className="absolute bottom-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-40">
              <span className="bg-black/60 text-white p-1 rounded text-[6px] font-bold">Local Only</span>
            </div>
          </div>
        </div>

        {/* 2. LIVE MONITOR */}
        <div className="flex flex-col space-y-2">
          <div className="aspect-video bg-black rounded-xl border-2 border-red-500 shadow-2xl relative overflow-hidden group">
            <TVPlayer
              activeVideo={mediaFiles.find(m => m.id === activeVideoId) || null}
              allVideos={mediaFiles.filter(v => v.type === 'video')}
              news={[]}
              adminMessages={[]}
              isNewsPlaying={false}
              isActive={!!isTvActive}
              isAdmin={true}
              isMuted={true}
              tvPlaylist={tvPlaylist}
            />
            {isTvActive && (
              <>
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-white text-[7px] font-black rounded uppercase tracking-widest z-40 animate-pulse shadow-sm">Live Broadcast</div>
                <div className="absolute top-2 right-2 flex items-center space-x-1 z-40">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-white text-[6px] font-black uppercase tracking-tighter shadow-black">On Air</span>
                </div>
              </>
            )}
            {!isTvActive && (
              <div className="absolute top-2 right-2 flex items-center space-x-1 z-40">
                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                <span className="text-white text-[6px] font-black uppercase tracking-tighter shadow-black">Off Air</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MASTER BROADCAST HUB --- */}
      <div className="bg-white p-3 rounded-2xl border border-green-100 shadow-lg flex items-center justify-between gap-4 shrink-0">
        <div className="flex-1 grid grid-cols-2 gap-3">
          {/* TV CONTROL BLOCK */}
          <div className="space-y-1">
            <label className="text-[7px] font-black text-indigo-700 uppercase ml-1">TV Station Management</label>
            <button
              onClick={() => onToggleTv?.(!isTvActive)}
              className={`w-full py-4 rounded-xl text-white font-black text-[11px] uppercase shadow-md transition-all active:scale-95 flex items-center justify-center space-x-3 ${isTvActive ? 'bg-red-600 hover:bg-red-700 border-red-800' : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-800'} border-b-4`}
            >
              <i className={`fas ${isTvActive ? 'fa-video-slash' : 'fa-video'} text-lg`}></i>
              <span>{isTvActive ? 'Stop TV Broadcast' : 'Go Live on TV'}</span>
            </button>
          </div>

          {/* RADIO CONTROL BLOCK */}
          <div className="space-y-1">
            <label className="text-[7px] font-black text-green-700 uppercase ml-1">Radio Station Management</label>
            <button
              onClick={() => onToggleRadio(!isRadioPlaying)}
              className={`w-full py-4 rounded-xl text-white font-black text-[11px] uppercase shadow-md transition-all active:scale-95 flex items-center justify-center space-x-3 ${isRadioPlaying ? 'bg-red-500 hover:bg-red-600 border-red-700' : 'bg-[#008751] hover:bg-green-700 border-green-900'} border-b-4`}
            >
              <i className={`fas ${isRadioPlaying ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
              <span>{isRadioPlaying ? 'Stop Radio' : 'Start Radio'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <button
            onClick={onResetSync}
            className="px-3 py-2 bg-red-50 text-red-700 rounded-lg shadow-sm border border-red-100 hover:bg-red-100 transition-colors text-[7px] font-black uppercase flex items-center gap-2"
          >
            <i className="fas fa-sync"></i> Re-Sync
          </button>
          <div className="relative group">
            <button
              onClick={async () => {
                setInternalStatus('Generating Update Link...');
                try {
                  const url = await dbService.getAppDownloadUrl();
                  if (url) {
                    onLogAdd?.(`System: Android App update broadcasted to all users.`);
                    setInternalStatus('✅ Update Link Shared!');
                  }
                } catch (e) {
                  setInternalStatus('❌ Update Error');
                }
                setTimeout(() => setInternalStatus(''), 3000);
              }}
              className="px-3 py-2 bg-[#3DDC84] text-white rounded-lg shadow-sm border border-[#2fb86c] hover:bg-[#32c072] transition-colors text-[7px] font-black uppercase flex items-center gap-2"
            >
              <i className="fab fa-android"></i> App Update
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap items-center justify-between bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-green-100 shadow-sm gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('command')}
          className={`flex-1 min-w-[50px] py-3 text-center text-[7px] font-bold uppercase transition-colors rounded-lg ${activeTab === 'command' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-green-800 hover:bg-green-50'}`}
        >
          Studio
        </button>
        <button
          onClick={() => setActiveTab('bulletin')}
          className={`flex-1 min-w-[50px] py-3 text-center text-[7px] font-bold uppercase transition-colors rounded-lg ${activeTab === 'bulletin' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-red-800 hover:bg-red-50'}`}
        >
          Newsroom
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 min-w-[50px] py-3 text-center text-[7px] font-bold uppercase transition-colors rounded-lg ${activeTab === 'manual' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-orange-800 hover:bg-orange-50'}`}
        >
          Manual
        </button>
        <button
          onClick={() => setActiveTab('podcast')}
          className={`flex-1 min-w-[50px] py-3 text-center text-[7px] font-bold uppercase transition-colors rounded-lg ${activeTab === 'podcast' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-800 hover:bg-indigo-50'}`}
        >
          Podcast
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 min-w-[50px] py-3 text-center text-[7px] font-bold uppercase transition-colors rounded-lg ${activeTab === 'media' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-green-800 hover:bg-green-50'}`}
        >
          Media
        </button>
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex-1 min-w-[50px] py-3 text-center text-[7px] font-bold uppercase transition-colors rounded-lg ${activeTab === 'inbox' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-green-800 hover:bg-green-50'}`}
        >
          Inbox
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 min-w-[50px] py-3 text-center text-[7px] font-bold uppercase transition-colors rounded-lg ${activeTab === 'logs' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-green-800 hover:bg-green-50'}`}
        >
          Logs
        </button>
      </nav>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-green-100 p-3 flex-grow overflow-hidden">

        {/* COMMAND STUDIO */}
        {activeTab === 'command' && (
          <div className="space-y-4 animate-fadeIn overflow-y-auto h-full pr-1 custom-scrollbar">
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex flex-col space-y-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-[9px] font-black uppercase text-green-800 flex items-center gap-2">
                  <i className="fas fa-chart-line"></i> Station Analytics
                </h3>
              </div>

              {/* LIBRARY STATS */}
              <div className="mt-4 flex space-x-2">
                <div className="flex-1 bg-green-50/50 p-2 rounded-lg border border-green-100 flex items-center justify-between">
                  <span className="text-[7px] font-bold text-green-700 uppercase tracking-tighter">Music Library</span>
                  <span className="text-[10px] font-black text-green-900">{mediaFiles.filter(m => m.type === 'audio').length} Files</span>
                </div>
                <div className="flex-1 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex items-center justify-between">
                  <span className="text-[7px] font-bold text-indigo-700 uppercase tracking-tighter">TV Library</span>
                  <span className="text-[10px] font-black text-indigo-900">{mediaFiles.filter(m => m.type === 'video').length} Files</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 text-[8px] font-bold text-green-700 bg-white/50 p-2 rounded border border-green-100">
                <div className="flex items-center space-x-2">
                  <button onClick={onToggleShuffle} className={`${isShuffle ? 'text-green-600' : 'text-gray-400'}`}>
                    <i className="fas fa-random"></i>
                  </button>
                  <span className="truncate max-w-[150px]">{currentTrackName}</span>
                </div>
                <button onClick={onPlayAll} className="text-green-600 hover:underline text-[7px]">Play All</button>
              </div>
            </div>

            {/* Quick Jingle Deck */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onPlayJingle?.(1)}
                disabled={isProcessing}
                className="bg-yellow-400 text-yellow-900 py-2 rounded-lg text-[7.5px] font-black uppercase shadow-sm border-b-2 border-yellow-500 hover:bg-yellow-300 active:scale-95 transition-all"
              >
                Jingle 1
              </button>
              <button
                onClick={() => {
                  const instrumental = mediaFiles.find(m => m.name.toLowerCase().includes('instrumentals (1)'));
                  if (instrumental) {
                    const audio = new Audio(instrumental.url);
                    audio.play().catch(e => console.error("Instrumental Jingle failed", e));
                  } else {
                    onPlayJingle?.(2);
                  }
                }}
                disabled={isProcessing}
                className="bg-orange-400 text-orange-900 py-2 rounded-lg text-[7.5px] font-black uppercase shadow-sm border-b-2 border-orange-500 hover:bg-orange-300 active:scale-95 transition-all"
              >
                Jingle 2
              </button>
            </div>

            {/* Consolidated Social Media Link Control with Guide */}
            <div className="border-2 border-indigo-200 rounded-2xl p-4 bg-indigo-50/70 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[9px] font-black uppercase text-indigo-900 flex items-center gap-2">
                  <i className="fas fa-satellite-dish text-indigo-600"></i> Social Media Hub
                </h4>
                <span className="text-[6px] font-bold bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Youtube • Facebook • Instagram</span>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white/60 p-1.5 rounded-lg border border-indigo-100 flex flex-col items-center">
                  <span className="text-[6px] font-black text-indigo-400 uppercase">Step 1</span>
                  <span className="text-[7px] font-bold text-indigo-800">Paste Link</span>
                </div>
                <div className="bg-white/60 p-1.5 rounded-lg border border-indigo-100 flex flex-col items-center">
                  <span className="text-[6px] font-black text-indigo-400 uppercase">Step 2</span>
                  <span className="text-[7px] font-bold text-indigo-800">Preview It</span>
                </div>
                <div className="bg-white/60 p-1.5 rounded-lg border border-indigo-100 flex flex-col items-center">
                  <span className="text-[6px] font-black text-indigo-400 uppercase">Step 3</span>
                  <span className="text-[7px] font-bold text-indigo-800">Go Live</span>
                </div>
              </div>

              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={socialLinks[i]}
                        onChange={(e) => {
                          const newLinks = [...socialLinks];
                          newLinks[i] = e.target.value;
                          setSocialLinks(newLinks);
                        }}
                        placeholder={`Paste video link ${i + 1} here...`}
                        className="w-full text-[8px] p-2 bg-white rounded-lg border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm pr-8 transition-all"
                      />
                      {socialLinks[i] && (
                        <button
                          onClick={() => {
                            const newLinks = [...socialLinks];
                            newLinks[i] = '';
                            setSocialLinks(newLinks);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                        >
                          <i className="fas fa-times-circle text-[9px]"></i>
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        title="Preview Only"
                        onClick={() => {
                          if (!socialLinks[i].trim()) return;
                          onPlayVideo?.(socialLinks[i].trim(), false);
                          setInternalStatus('👀 Previewing Link...');
                          setTimeout(() => setInternalStatus(''), 2000);
                        }}
                        className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-all active:scale-95"
                      >
                        <i className="fas fa-eye text-[9px]"></i>
                      </button>
                      <button
                        title="Instant Go Live!"
                        onClick={() => {
                          if (!socialLinks[i].trim()) return;
                          onPlayVideo?.(socialLinks[i].trim(), true);
                          onToggleTv?.(true); // Force TV ON
                          setInternalStatus('🚀 INSTANT LIVE!');
                          setTimeout(() => setInternalStatus(''), 3000);
                        }}
                        className="w-8 h-8 bg-[#008751] text-white rounded-lg flex items-center justify-center hover:bg-green-700 shadow-md transition-all active:scale-95 border-b-2 border-green-900"
                      >
                        <i className="fas fa-bolt text-[9px]"></i>
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={async () => {
                      const links = socialLinks.map(l => l.trim()).filter(l => l !== '');
                      if (links.length === 0) return;
                      setIsProcessing(true);
                      setInternalStatus('Broadcasting Playlist...');
                      try {
                        onUpdatePlaylist?.(links);
                        onToggleTv?.(true);
                        setInternalStatus('✅ Playlist Live on TV!');
                        onRefreshData();
                      } catch (e: any) {
                        setInternalStatus('❌ Error: ' + e.message);
                      } finally {
                        setIsProcessing(false);
                        setTimeout(() => setInternalStatus(''), 3000);
                      }
                    }}
                    className="flex-1 py-2 bg-indigo-600 text-white text-[8px] font-black uppercase rounded shadow-lg hover:bg-indigo-700 transition-all border-b-2 border-indigo-800"
                  >
                    Broadcast Playlist
                  </button>
                  <button
                    onClick={() => setSocialLinks(['', '', ''])}
                    className="px-4 py-2 bg-gray-100 text-gray-500 text-[8px] font-black uppercase rounded hover:bg-gray-200 transition-all"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Text-to-Speech Broadcast */}
            <div className="border border-green-100 rounded-lg p-2 bg-white">
              <textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Type urgent alert message..."
                className="w-full h-16 text-[8px] p-2 bg-gray-50 rounded border border-gray-100 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none mb-2"
              />
              <button
                onClick={handleLiveBroadcast}
                disabled={isProcessing || !broadcastText}
                className={`w-full py-2 rounded-lg text-[8px] font-black uppercase text-white shadow-sm transition-colors ${isProcessing || !broadcastText ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 border-b-2 border-red-700'}`}
              >
                {isProcessing ? 'Transmitting...' : 'Push Live Alert'}
              </button>
            </div>

            {/* TV HUB REMOTE - INSTANT ZAP */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-2">
                  <i className="fas fa-tv text-indigo-300 animate-pulse"></i> TV Hub Remote
                </h4>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                </div>
              </div>

              <p className="text-[7px] text-slate-400 font-bold uppercase mb-3 tracking-widest italic opacity-60">Push Live Channels Instantly</p>

              <div className="grid grid-cols-2 gap-2">
                {TV_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onPlayVideo?.(preset.url, true);
                      onToggleTv?.(true);
                      setInternalStatus(`📡 Zapped to ${preset.name}`);
                      setTimeout(() => setInternalStatus(''), 2000);
                    }}
                    className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-indigo-600 rounded-lg border border-slate-700 hover:border-indigo-400 transition-all active:scale-95 group"
                  >
                    <span className="text-xl mb-1 group-hover:scale-125 transition-transform">{preset.icon}</span>
                    <span className="text-[8px] font-black text-white uppercase tracking-tighter">{preset.name}</span>
                    <div className="mt-1 w-full flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[6px] font-black text-white/50 bg-white/10 px-1 rounded uppercase">Push Live</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 py-2 bg-indigo-950/50 rounded-lg border border-indigo-500/20">
                <i className="fas fa-info-circle text-indigo-400 text-[8px]"></i>
                <span className="text-[7px] font-black text-indigo-300/80 uppercase">Pushing overrides active TV content</span>
              </div>
            </div>
          </div>
        )}

        {/* NEWSROOM (MODULAR REBUILD) */}
        {activeTab === 'bulletin' && (
          <ModularNewsUI
            news={news}
            status={status || internalStatus}
            isProcessing={isProcessing}
            manualText={manualText}
            onManualTextChange={setManualText}
            onSaveManualScript={async () => {
              setIsProcessing(true);
              try {
                await onSaveManualScript?.(manualText);
                setInternalStatus('SCHEDULE UPDATED ✅');
              } catch (e) {
                setInternalStatus('SAVE FAILED ❌');
              }
              setIsProcessing(false);
              setTimeout(() => setInternalStatus(''), 2000);
            }}
            onTriggerFavour={() => {
              const hub = document.getElementById('favour-engine-trigger');
              if (hub) hub.click();
              onTriggerFullBulletin?.();
            }}
            onTriggerThompson={() => {
              const hub = document.getElementById('thompson-engine-trigger');
              if (hub) hub.click();
              onTriggerManualBroadcast?.();
            }}
            onRefreshWire={onRefreshWire || onRefreshData}
            onClearNews={onClearNews || (() => { })}
            onStop={onStopNews || (() => { })}
          />
        )}

        {/* MANUAL OVERRIDE (NEWS BUCKET) */}
        {activeTab === 'manual' && (
          <div className="h-full flex flex-col animate-fadeIn overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[9px] font-black uppercase text-orange-900 flex items-center">
                <i className="fas fa-bullhorn mr-2"></i> Manual Broadcast Station
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-3 py-1 bg-green-600 text-white text-[7px] font-black uppercase rounded-full hover:bg-green-700 shadow-sm transition-colors"
                >
                  + Add News
                </button>
              </div>
            </div>

            {/* Jingle Selector */}
            <div className="bg-orange-50 p-2 rounded-lg border border-orange-100 mb-3 flex items-center space-x-2">
              <select
                value={selectedJingleUrl}
                onChange={(e) => setSelectedJingleUrl(e.target.value)}
                className="flex-1 text-[8px] p-1 bg-white border border-orange-200 rounded font-bold uppercase outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Select MP3 Jingle...</option>
                {mediaFiles.filter(m => m.type === 'audio').map(m => (
                  <option key={m.id} value={m.url}>{m.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!selectedJingleUrl) return;
                  const audio = new Audio(selectedJingleUrl);
                  audio.play().catch(e => console.error("MP3 Jingle failed", e));
                }}
                disabled={!selectedJingleUrl}
                className={`px-3 py-2 rounded text-[7px] font-black uppercase shadow-sm transition-all ${selectedJingleUrl ? 'bg-orange-600 text-white hover:bg-orange-700 active:scale-95' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                Play Jingle
              </button>
            </div>

            {/* Add/Edit Form Overlay */}
            {(showAddForm || editingItem) && (
              <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-xs rounded-xl shadow-2xl overflow-hidden border border-orange-200 animate-slideUp">
                  <div className="bg-orange-600 p-3 flex justify-between items-center">
                    <h4 className="text-white text-[9px] font-black uppercase">
                      {editingItem ? 'Edit News Story' : 'Create New Manual Story'}
                    </h4>
                    <button onClick={() => { setShowAddForm(false); setEditingItem(null); }} className="text-white/80 hover:text-white transition-colors">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-[7px] font-black uppercase text-gray-400 mb-1">Category</label>
                      <input
                        type="text"
                        value={editingItem ? editingItem.category : newItem.category}
                        onChange={(e) => editingItem ? setEditingItem({ ...editingItem, category: e.target.value as NewsItem['category'] }) : setNewItem({ ...newItem, category: e.target.value as NewsItem['category'] })}
                        className="w-full text-[9px] p-2 bg-gray-50 border border-gray-100 rounded focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[7px] font-black uppercase text-gray-400 mb-1">Headline</label>
                      <input
                        type="text"
                        value={editingItem ? editingItem.title : newItem.title}
                        onChange={(e) => editingItem ? setEditingItem({ ...editingItem, title: e.target.value }) : setNewItem({ ...newItem, title: e.target.value })}
                        className="w-full text-[9px] p-2 bg-gray-50 border border-gray-100 rounded focus:ring-1 focus:ring-orange-500 outline-none font-bold transition-all"
                        placeholder="Enter headline..."
                      />
                    </div>
                    <div>
                      <label className="block text-[7px] font-black uppercase text-gray-400 mb-1">Content</label>
                      <textarea
                        value={editingItem ? editingItem.content : newItem.content}
                        onChange={(e) => editingItem ? setEditingItem({ ...editingItem, content: e.target.value }) : setNewItem({ ...newItem, content: e.target.value })}
                        className="w-full h-24 text-[9px] p-2 bg-gray-50 border border-gray-100 rounded focus:ring-1 focus:ring-orange-500 outline-none resize-none transition-all"
                        placeholder="Write the full news report here..."
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (editingItem) {
                          onUpdateNews?.(editingItem);
                          setEditingItem(null);
                        } else {
                          onAddNews?.({
                            id: 'man-' + Date.now(),
                            title: newItem.title,
                            content: newItem.content,
                            category: newItem.category,
                            source: 'Manual entry',
                            timestamp: Date.now(),
                            priority: 100
                          });
                          setShowAddForm(false);
                          setNewItem({ title: '', content: '', category: 'Manual' });
                        }
                      }}
                      className="w-full py-2.5 bg-green-600 text-white text-[9px] font-black uppercase rounded shadow-lg hover:bg-green-700 transition-all border-b-2 border-green-800"
                    >
                      {editingItem ? 'Update Story' : 'Save & Add to Bucket'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 pb-4">
              {(!newsHistory || newsHistory.length === 0) ? (
                <div className="text-center py-10 text-gray-400 text-[8px] italic">No archived news yet. News will drop here as it's fetched.</div>
              ) : (
                newsHistory.map((item) => (
                  <div key={item.id} className="p-3 bg-white border border-orange-100 rounded-lg shadow-sm hover:border-orange-300 transition-all group">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded-full">{item.category}</span>
                      <div className="flex space-x-2">
                        <button onClick={() => setEditingItem(item)} className="text-gray-400 hover:text-blue-600 text-[8px] transition-colors"><i className="fas fa-edit"></i></button>
                        <button onClick={() => onDeleteNews?.(item.id)} className="text-gray-400 hover:text-red-600 text-[8px] transition-colors"><i className="fas fa-trash"></i></button>
                      </div>
                    </div>
                    <h4 className="text-[8px] font-black text-gray-800 mb-1 leading-tight">{item.title}</h4>
                    <p className="text-[7px] text-gray-600 line-clamp-2 mb-2 leading-relaxed">{item.content}</p>
                    <button
                      onClick={() => onManualBroadcast?.(item)}
                      className="w-full py-1.5 bg-orange-600 text-white text-[7px] font-black uppercase rounded shadow-sm hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
                    >
                      <i className="fas fa-bullhorn"></i>
                      <span>Broadcast Story Now</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PODCAST STUDIO */}
        {activeTab === 'podcast' && (
          <div className="flex flex-col h-full space-y-3 animate-fadeIn overflow-y-auto pr-1">
            {/* SECTION 1: UPLOAD AUDIO */}
            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex-shrink-0">
              <h3 className="text-[9px] font-black uppercase text-indigo-900 mb-2">
                <i className="fas fa-cloud-upload-alt mr-1"></i> Upload Live Audio
              </h3>
              <input
                type="file"
                accept="audio/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setIsProcessing(true);
                  setInternalStatus('Broadcasting file...');
                  try {
                    // Use destructured prop directly
                    await onPlayPodcastFile?.(file);
                    setInternalStatus('Now Playing: ' + file.name);
                  } catch (error: any) {
                    console.error('File broadcast failed:', error);
                    setInternalStatus('Error: ' + error.message);
                  }
                  setIsProcessing(false);
                  setTimeout(() => setInternalStatus(''), 3000);
                  e.target.value = ''; // Reset input
                }}
                disabled={isProcessing}
                className="block w-full text-[8px] text-indigo-700
                  file:mr-2 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-[8px] file:font-semibold
                  file:bg-indigo-100 file:text-indigo-700
                  hover:file:bg-indigo-200 cursor-pointer"
              />
            </div>

            {/* SECTION 2: DIRECT TEXT-TO-SPEECH (ELEVENLABS) */}
            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex-col flex min-h-[200px]">
              <h3 className="text-[9px] font-black uppercase text-indigo-900 mb-1">
                <i className="fas fa-microphone-alt mr-1"></i> Direct News Reader
              </h3>
              <p className="text-[7px] text-indigo-700 mb-2 leading-tight">
                Paste any text below. The AI Host will read it immediately (using ElevenLabs).
                <strong>No Script Generation (Uses strictly what you type).</strong>
              </p>
              <textarea
                value={podcastText}
                onChange={(e) => setPodcastText(e.target.value)}
                placeholder="Type or paste the exact text you want read on air..."
                className="w-full flex-grow h-32 p-2 text-[9px] border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white text-gray-800 placeholder-indigo-300 mb-2"
              />

              <button
                onClick={async () => {
                  if (!podcastText.trim()) return;
                  setIsProcessing(true);
                  setInternalStatus('Generating Speech (ElevenLabs)...');
                  try {
                    // Use destructured prop directly
                    await onPlayDirectTTS?.(podcastText);
                    setInternalStatus('Broadcasting Text!');
                  } catch (error) {
                    console.error('TTS error:', error);
                    setInternalStatus('Error: TTS failed');
                  }
                  setTimeout(() => setInternalStatus(''), 3000);
                  setIsProcessing(false);
                }}
                disabled={isProcessing || !podcastText.trim()}
                className={`w-full bg-indigo-600 text-white py-3 rounded-xl text-[8px] font-black uppercase flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-colors shadow-md border border-indigo-500 flex-shrink-0 ${isProcessing || !podcastText.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className={`fas ${isProcessing ? 'fa-spinner fa-spin' : 'fa-bullhorn'}`}></i>
                <span>{isProcessing ? 'Reading...' : 'Read Text On Air'}</span>
              </button>
            </div>

            {internalStatus && (
              <div className="text-center text-[8px] font-bold text-indigo-600 animate-pulse mt-1">
                {internalStatus}
              </div>
            )}
          </div>
        )}

        {/* MEDIA LIBRARY */}
        {activeTab === 'media' && (
          <div className="h-full flex flex-col animate-fadeIn">
            <div className="flex space-x-2 mb-3 bg-gray-50 p-1 rounded-lg flex-shrink-0">
              <button
                onClick={() => setMediaSubTab('audio')}
                className={`flex-1 py-1 text-[7px] font-bold uppercase rounded ${mediaSubTab === 'audio' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}
              >
                Music
              </button>
              <button
                onClick={() => setMediaSubTab('video')}
                className={`flex-1 py-1 text-[7px] font-bold uppercase rounded ${mediaSubTab === 'video' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}
              >
                Videos
              </button>
            </div>


            {/* Folder Selection for Upload */}
            {mediaSubTab === 'video' && (
              <div className="mb-3 bg-green-50 p-2 rounded-lg border border-green-100 flex items-center justify-between">
                <span className="text-[7px] font-black uppercase text-green-800">Target Folder:</span>
                <select
                  ref={folderInputRef}
                  className="text-[7px] font-bold p-1 bg-white border border-green-200 rounded uppercase outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="main">🎬 Main Library</option>
                  <option value="adverts">📺 Adverts</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <input
                  type="file"
                  id="media-upload"
                  multiple
                  accept={mediaSubTab === 'audio' ? "audio/*" : "video/*"}
                  onChange={(e) => handleFileUpload(e, false)}
                  className="hidden"
                  ref={fileInputRef}
                />
                <label
                  htmlFor="media-upload"
                  className="block w-full text-center py-2 border-2 border-dashed border-green-200 rounded-lg text-[8px] font-bold text-green-600 hover:bg-green-50 cursor-pointer transition-colors"
                >
                  <i className="fas fa-file-upload mr-1"></i> Upload {mediaSubTab === 'audio' ? 'Tracks' : 'Videos'}
                </label>
              </div>
              <div>
                <input
                  type="file"
                  id="folder-upload"
                  multiple
                  {...({ webkitdirectory: "" } as any)}
                  accept={mediaSubTab === 'audio' ? "audio/*" : "video/*"}
                  onChange={(e) => handleFileUpload(e, true)}
                  className="hidden"
                />
                <label
                  htmlFor="folder-upload"
                  className="block w-full text-center py-2 border-2 border-dashed border-green-200 rounded-lg text-[7px] font-bold text-green-600 hover:bg-green-50 cursor-pointer transition-colors"
                >
                  <i className="fas fa-folder-open mr-1"></i> {mediaSubTab === 'audio' ? 'Music' : 'Video'} Folder
                </label>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex-1 bg-green-50 aspect-video rounded-xl border border-dashed border-green-200 flex flex-col items-center justify-center hover:bg-green-100/50 transition-colors"
              >
                <i className="fas fa-music text-green-800 text-xl mb-2"></i>
                <span className="text-[9px] font-black uppercase text-green-900 tracking-widest">Main Library</span>
              </button>
              <button
                onClick={async () => {
                  console.log('🔌 [Diagnostic] Testing Cloud Connection...');
                  const sb = (window as any).supabase;

                  if (!sb) {
                    const msg = '❌ Error: Supabase client not initialized. Check your Vercel Environment Variables!';
                    setInternalStatus(msg);
                    alert(msg);
                    return;
                  }

                  setInternalStatus('Testing Storage Connection...');
                  try {
                    const { data, error } = await sb.storage.listBuckets();
                    if (error) throw error;
                    const buckets = data.map((b: any) => b.name).join(', ');
                    const successMsg = `✅ Buckets found: ${buckets}`;
                    setInternalStatus(successMsg);
                    alert(successMsg);
                  } catch (e: any) {
                    const errMsg = `❌ Connection Error: ${e.message}`;
                    setInternalStatus(errMsg);
                    alert(errMsg);
                  }
                  setTimeout(() => setInternalStatus(''), 8000);
                }}
                className="px-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-all active:scale-90 cursor-pointer relative z-10"
                title="Cloud Diagnostic"
              >
                <i className="fas fa-plug text-gray-400"></i>
              </button>
            </div>

            {/* APP UPDATE SECTION */}
            <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100 flex flex-col items-center justify-center space-y-2">
              <h4 className="text-[8px] font-black uppercase text-red-800 tracking-widest">Android App Management</h4>
              <p className="text-[7px] text-red-600 font-bold text-center leading-tight">Updating the APK here will instantly update the download link for all listeners.</p>

              <input
                type="file"
                id="app-upload"
                accept=".apk"
                onChange={handleAppUpload}
                className="hidden"
                ref={appFileInputRef}
              />
              <button
                onClick={() => appFileInputRef.current?.click()}
                disabled={isProcessing}
                className={`w-full py-2.5 rounded-lg text-[9px] font-black uppercase shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 ${isProcessing ? 'bg-gray-300 cursor-wait' : 'bg-red-600 hover:bg-red-700 text-white border-b-2 border-red-800'}`}
              >
                <i className="fab fa-android mr-1 text-lg"></i>
                <span>{isProcessing ? 'Uploading App...' : 'Upload New Android App (.apk)'}</span>
              </button>

              {uploadedAppUrl && (
                <div className="w-full mt-2 p-2 bg-white rounded border border-red-200 animate-fadeIn">
                  <p className="text-[6px] font-black uppercase text-gray-400 mb-1">Diagnostic URL (Supabase):</p>
                  <div className="flex items-center space-x-2">
                    <input
                      readOnly
                      value={uploadedAppUrl}
                      className="flex-1 text-[7px] bg-red-50 p-1 border border-red-100 rounded truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(uploadedAppUrl);
                        setInternalStatus('URL COPIED! 📋');
                        setTimeout(() => setInternalStatus(''), 2000);
                      }}
                      className="px-2 py-1 bg-red-100 text-red-700 text-[7px] font-black uppercase rounded hover:bg-red-200 transition-colors"
                    >
                      Copy
                    </button>
                    <a
                      href={uploadedAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 bg-green-100 text-green-700 text-[7px] font-black uppercase rounded hover:bg-green-200 transition-colors"
                    >
                      Test
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Master Play All Button */}
            {mediaSubTab === 'audio' && mediaFiles.filter(m => m.type === 'audio').length > 0 && (
              <button
                onClick={onPlayAll}
                className="w-full mb-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[9px] font-black uppercase shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <i className="fas fa-play-circle"></i>
                <span>Play All Tracks</span>
              </button>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1 min-h-[200px]">
              {/* This would need to filter by MediaSubTab but simplifying for now */}
              {(mediaSubTab === 'audio' ? mediaFiles.filter(m => m.type === 'audio') : mediaFiles.filter(m => m.type !== 'audio')).map(file => (
                <div key={file.id} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded group hover:border-green-200">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center text-green-600 text-[10px]">
                      <i className={`fas ${file.type === 'audio' ? 'fa-music' : 'fa-video'}`}></i>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] font-bold text-gray-700 truncate">{file.name}</span>
                      <span className="text-[7px] text-gray-400">{new Date(file.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {file.type === 'video' ? (
                      <>
                        <button
                          onClick={() => onPlayVideo?.(file, false)}
                          className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
                          title="Preview Locally"
                        >
                          <i className="fas fa-eye text-[8px]"></i>
                        </button>
                        <button
                          onClick={() => {
                            onPlayVideo?.(file, true);
                            setInternalStatus('✅ Broadcasting to TV!');
                            setTimeout(() => setInternalStatus(''), 3000);
                          }}
                          className="w-6 h-6 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors shadow-sm"
                          title="Go Live (Broadcast)"
                        >
                          <i className="fas fa-broadcast-tower text-[8px]"></i>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          onPlayTrack(file);
                        }}
                        className="w-6 h-6 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                        title="Play Globally"
                      >
                        <i className="fas fa-play text-[8px]"></i>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = file.url;
                        link.download = file.name;
                        // For cross-origin/blob URLs, sometimes download attribute isn't enough
                        // But since we want "as it use to do", this is the standard way.
                        // Open in new tab if it's a cloud URL to trigger browser download
                        if (file.url.startsWith('http')) {
                          window.open(file.url, '_blank');
                        } else {
                          link.click();
                        }
                      }}
                      className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
                      title="Download"
                    >
                      <i className="fas fa-download text-[8px]"></i>
                    </button>
                    {onDeleteMedia && (
                      <button
                        onClick={async () => {
                          if (window.confirm('Delete this file from cloud?')) {
                            setIsProcessing(true);
                            const folder = file.type === 'audio' ? 'music' : file.type === 'video' ? 'videos' : 'images';
                            await onDeleteMedia(file.id, `${folder}/${file.name}`);
                            onRefreshData();
                            setIsProcessing(false);
                          }
                        }}
                        title="Delete from Cloud"
                        className="w-6 h-6 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                      >
                        <i className="fas fa-trash text-[8px]"></i>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INBOX (MESSAGES) */}
        {activeTab === 'inbox' && (
          <div className="h-full overflow-y-auto custom-scrollbar pr-1 animate-fadeIn">
            <h3 className="text-[10px] font-black uppercase text-green-900 mb-2">Listener Reports</h3>
            <div className="space-y-2">
              {reports && reports.length > 0 ? reports.map((report) => (
                <div key={report.id} className="p-3 bg-gray-50 border border-gray-100 rounded-lg shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[8px] font-black text-green-800 uppercase">{report.reporterName}</span>
                    <span className="text-[7px] text-gray-400">{new Date(report.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-[7px] text-blue-600 font-bold mb-1"><i className="fas fa-map-marker-alt mr-1"></i>{report.location}</div>
                  <p className="text-[9px] text-gray-700 leading-tight italic">"{report.content}"</p>
                </div>
              )) : (
                <div className="text-center py-4 text-gray-400 text-[8px]">No new reports from listeners.</div>
              )}
            </div>
          </div>
        )}

        {/* LOGS */}
        {activeTab === 'logs' && (
          <div className="h-full overflow-y-auto custom-scrollbar pr-1 animate-fadeIn">
            <h3 className="text-[10px] font-black uppercase text-green-900 mb-2">System Logs</h3>
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="text-[7px] font-mono p-1 bg-gray-50 border-l-2 border-green-300">
                  <span className="text-gray-400 mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="text-gray-700">{log.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div >
  );
};

export default AdminView;
