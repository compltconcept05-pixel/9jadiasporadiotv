
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ListenerView from './components/Listener/ListenerView';
import AdminView from './components/Admin/AdminView';
import PasswordModal from './components/Shared/PasswordModal';
import RadioPlayer from './components/Listener/RadioPlayer';
import { dbService } from './services/dbService';
import { scanNigerianNewspapers } from './services/newsAIService';
import { getDetailedBulletinAudio, getNewsAudio, getJingleAudio } from './services/aiDjService';
import { UserRole, MediaFile, AdminMessage, AdminLog, NewsItem, ListenerReport } from './types';
import { DESIGNER_NAME, APP_NAME, JINGLE_1, JINGLE_2, NEWS_BGM_VOLUME, NEWSCASTER_NAME, APK_DOWNLOAD_URL } from './constants';
import { generateNewsBackgroundMusicAsync } from './services/backgroundMusicService';
import { generatePodcastScript, generatePodcastAudio } from './services/podcastService';
import NDRTVEngine from './components/Admin/NewsRoom/NDRTVEngine';
import ThompsonEngine from './components/Admin/NewsRoom/ThompsonEngine';
import FavourEngine from './components/Admin/NewsRoom/FavourEngine';
import { supabase } from './services/supabaseClient';
import TVPlayer from './components/Listener/TVChannel/TVPlayer';
import TVHub from './components/Listener/TVChannel/TVHub';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.LISTENER);
  const [showAuth, setShowAuth] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [sponsoredMedia, setSponsoredMedia] = useState<MediaFile[]>([]);
  const [audioPlaylist, setAudioPlaylist] = useState<MediaFile[]>([]);
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
  const [reports, setReports] = useState<ListenerReport[]>([]);
  const [allMedia, setAllMedia] = useState<MediaFile[]>([]);
  const [broadcastStatus, setBroadcastStatus] = useState<string>('');
  const [manualScript, setManualScript] = useState<string>('');
  const [newsHistory, setNewsHistory] = useState<NewsItem[]>([]);

  const [isPlaying, setIsPlaying] = useState(false); // Master Station Play State (Disabled for TV Only)
  const [radioCurrentTime, setRadioCurrentTime] = useState(0); // LIVE POSITION
  const [listenerHasPlayed, setListenerHasPlayed] = useState(true); // TV Auto-plays for listeners
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [activeTrackUrl, setActiveTrackUrl] = useState<string | null>(null);
  const [currentTrackName, setCurrentTrackName] = useState<string>('Station Standby');
  const [isShuffle, setIsShuffle] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [audioStatus, setAudioStatus] = useState<string>('Ready');
  const [isTvActive, setIsTvActive] = useState(false); // TV Active State (Default: FALSE)
  const [isTvMuted, setIsTvMuted] = useState(false); // TV Audio Exclusivity State
  const [lastError, setLastError] = useState<string>('');
  const [isDuckingNDR, setIsDuckingNDR] = useState(false);
  const [isDuckingThompson, setIsDuckingThompson] = useState(false);
  const [isDuckingFavour, setIsDuckingFavour] = useState(false);
  const isDucking = isDuckingNDR || isDuckingThompson || isDuckingFavour;
  const [currentLocation, setCurrentLocation] = useState<string>("Global");
  const [newsTriggerCount, setNewsTriggerCount] = useState(0);
  const [manualNewsTriggerCount, setManualNewsTriggerCount] = useState(0);
  const [stopTriggerCount, setStopTriggerCount] = useState(0);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [tvPlaylist, setTvPlaylist] = useState<string[]>([]);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [previewPlaylist, setPreviewPlaylist] = useState<string[]>([]);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string>('Initializing Satellite...');
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [adminConflict, setAdminConflict] = useState(false);
  const [isTvMode, setIsTvMode] = useState(false); // Cinematic Receiver Mode

  const isPlayingRef = useRef(isPlaying);
  const isTvActiveRef = useRef(isTvActive);
  const activeTrackIdRef = useRef(activeTrackId);
  const currentTrackNameRef = useRef(currentTrackName);
  const activeTrackUrlRef = useRef(activeTrackUrl);
  const activeVideoIdRef = useRef(activeVideoId);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isTvActiveRef.current = isTvActive; }, [isTvActive]);
  useEffect(() => { activeTrackIdRef.current = activeTrackId; }, [activeTrackId]);
  useEffect(() => { currentTrackNameRef.current = currentTrackName; }, [currentTrackName]);
  useEffect(() => { activeTrackUrlRef.current = activeTrackUrl; }, [activeTrackUrl]);
  useEffect(() => { activeVideoIdRef.current = activeVideoId; }, [activeVideoId]);

  const aiAudioContextRef = useRef<AudioContext | null>(null);
  const isSyncingRef = useRef(false);
  const pendingAudioRef = useRef<Uint8Array | null>(null);
  const lastBroadcastMarkerRef = useRef<string>("");
  const activeAiAudioRef = useRef<HTMLAudioElement | null>(null);
  const aiPlaybackResolverRef = useRef<(() => void) | null>(null);

  const mediaUrlCache = useRef<Map<string, string>>(new Map());
  const playlistRef = useRef<MediaFile[]>([]);
  const allMediaRef = useRef<MediaFile[]>([]); // SYNC LOCK


  const preCacheJingles = useCallback(async () => {
    console.log("⚡ Pre-caching jingles for instant playback...");
    await getJingleAudio(JINGLE_1);
    await getJingleAudio(JINGLE_2);
  }, []);

  const cleanTrackName = (name: string) => {
    return name.replace(/\.(mp3|wav|m4a|aac|ogg|flac|webm|wma)$/i, '');
  };

  // Optimized Track URL Setter
  const updateTrackUrl = useCallback((id: string | null, url: string | null, name: string) => {
    // RESOLUTION GUARD: If URL is null but ID is present, find it in library
    let resolvedUrl = url;
    if (!resolvedUrl && id && id !== 'jingle') {
      const found = allMediaRef.current.find(m => m.id === id);
      if (found) resolvedUrl = found.url;
    }

    setActiveTrackId(prevId => {
      if (prevId === id) return prevId;
      console.log(`🎵 [App] Active Track Change: ${id} (${name}) | Resolved URL: ${resolvedUrl ? 'YES' : 'NO'}`);
      return id;
    });

    setActiveTrackUrl(prevUrl => {
      if (prevUrl === resolvedUrl) return prevUrl;
      return resolvedUrl;
    });

    setCurrentTrackName(prevName => {
      const clean = cleanTrackName(name);
      if (prevName === clean) return prevName;
      return clean;
    });
    // v2.5.0: Reset timeline to 0 for the new track
    setRadioCurrentTime(0);
  }, []);

  const hasInitialSyncRef = useRef(false);

  const fetchData = useCallback(async (forceScan: boolean = false) => {
    try {
      if (forceScan) {
        setBroadcastStatus(`📡 Manual Satellite Re-Sync...`);
        const wire = await scanNigerianNewspapers(currentLocation, true);
        if (wire.news?.length) {
          setNews(prev => {
            const combined = [...prev, ...wire.news];
            const unique = combined.filter((item, index, self) => index === self.findIndex(n => n.id === item.id));
            const final = unique.slice(0, 50);
            dbService.saveNews(final);
            return final;
          });
        }
      }

      const [l, m, msg, rep, cloudNews, sState] = await Promise.all([
        dbService.getLogs(),
        dbService.getMediaCloud(),
        dbService.getAdminMessagesCloud(),
        dbService.getReportsCloud(),
        dbService.getNewsFromCloud(),
        dbService.getStationState()
      ]);

      console.log("📦 [App] Cloud Data Fetched:", { media: m?.length, logs: l?.length, state: sState });
      setNews(cloudNews || []);

      const mediaItems = m || [];
      const processedMedia = mediaItems.map(item => {
        if (item.file) {
          let url = mediaUrlCache.current.get(item.id);
          if (!url) {
            url = URL.createObjectURL(item.file);
            mediaUrlCache.current.set(item.id, url);
          }
          return { ...item, url: item.url || url };
        }
        return item;
      });

      setLogs(l || []);
      setAllMedia(processedMedia);
      allMediaRef.current = processedMedia;
      setSponsoredMedia(processedMedia.filter(item => item.type === 'video' || item.type === 'image'));
      setAudioPlaylist(processedMedia.filter(item => item.type === 'audio'));
      setAdminMessages(msg || []);
      setReports(rep || []);

      // Apply initial station state for sync
      if (sState) {
        // STATE GUARD: Only apply remote state if:
        // 1. We are a listener (listeners must follow the station)
        // 2. OR we are an admin but have NOT done our initial sync yet
        const isActuallyNone = !activeTrackIdRef.current && !activeTrackUrlRef.current;
        const shouldApplySync = (role === UserRole.LISTENER) || (role === UserRole.ADMIN && !hasInitialSyncRef.current && isActuallyNone);

        if (shouldApplySync) {
          console.log("🔄 [App] Syncing Initial Station State...");
          setIsPlaying(sState.is_playing);
          setIsTvActive(sState.is_tv_active);
          updateTrackUrl(sState.current_track_id, sState.current_track_url, sState.current_track_name || 'Station Standby');
          setRadioCurrentTime(sState.current_offset || 0);

          if (role === UserRole.ADMIN) {
            hasInitialSyncRef.current = true;
          }
        }
      }

      const ms = await dbService.getManualScript();
      setManualScript(ms || '');

      const history = await dbService.getNewsHistory();
      setNewsHistory(history || []);

      if (activeTrackIdRef.current && !activeTrackUrlRef.current) {
        const activeTrack = processedMedia.find(t => t.id === activeTrackIdRef.current);
        if (activeTrack) updateTrackUrl(activeTrack.id, activeTrack.url, activeTrack.name);
      }
    } catch (err) {
      console.error("Data fetch error", err);
    }
  }, [role, updateTrackUrl, currentLocation]); // Removed activeTrackId/Url to break loop

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // LIVE OFFSET TRACKING REF
  const radioCurrentTimeRef = useRef(0);
  useEffect(() => {
    radioCurrentTimeRef.current = radioCurrentTime;
  }, [radioCurrentTime]);

  useEffect(() => {
    if (role === UserRole.ADMIN) {
      console.log("👔 [App] Admin logged in, refreshing media library...");
      fetchData();
    }
  }, [role, fetchData]);

  const handleResetSync = useCallback(() => {
    console.log("🔄 [App] Hard Resetting Station Sync...");
    hasInitialSyncRef.current = false;
    fetchData();
  }, [fetchData]);

  // --- SUPABASE REAL-TIME SYNC ---
  useEffect(() => {
    if (!supabase) return;

    console.log("🔥 [Supabase] Initializing Real-time Subscriptions...");

    // 1. Station State Subscription
    const stateChannel = supabase
      .channel('station_state_changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'station_state' }, (payload: any) => {
        const newState = payload.new;
        if (role === UserRole.LISTENER) {
          console.log("📻 [Supabase] Remote State Update:", newState);
          setIsPlaying(newState.is_playing);
          setIsTvActive(newState.is_tv_active);

          if (newState.current_video_id) {
            setActiveVideoId(newState.current_video_id);
          }

          if (newState.tv_playlist) {
            setTvPlaylist(newState.tv_playlist);
          }

          if (newState.current_offset !== undefined) {
            // COMPENSATED SYNC: Add lag compensation (Now - LastUpdated)
            // timestamp is in ms, offset is in seconds
            const lastUpdated = newState.timestamp || Date.now();
            const latencyInSeconds = (Date.now() - lastUpdated) / 1000;
            const compensatedOffset = newState.current_offset + latencyInSeconds;

            // Only update if it's statistically significant to avoid micro-jitters
            // Increased threshold to 4s to prevent skipping
            if (Math.abs(radioCurrentTimeRef.current - compensatedOffset) > 4.0) {
              console.log(`⏱️ [Sync] Significant Drift: Base: ${newState.current_offset}s | Latency: ${latencyInSeconds.toFixed(2)}s | Target: ${compensatedOffset.toFixed(2)}s`);
              setRadioCurrentTime(compensatedOffset);
            }
          }

          setIsPlaying(newState.is_playing);
          setIsTvActive(newState.is_tv_active);

          if (newState.current_track_id) {
            updateTrackUrl(newState.current_track_id, newState.current_track_url, newState.current_track_name || 'Music');
          }

          if (role === UserRole.LISTENER && newState.is_playing && !listenerHasPlayed) {
            setShowJoinPrompt(true);
            setCloudStatus('📡 BROADCAST LIVE - TAP TO JOIN');
          } else if (newState.is_playing) {
            setCloudStatus(`🎵 Live: ${newState.current_track_name || 'Music'}`);
          } else {
            setCloudStatus('📡 Station Standby');
          }
        }

        // Conflict Detection: If someone else is pulsing as Admin with a different sessionId
        if (role === UserRole.ADMIN && newState.timestamp > (Date.now() - 30000)) {
          // If the state was updated recently by someone else (id logic needs schema update, for now we use name or just warn)
          // Ideally we'd have broad_caster_id in schema
        }
      })
      .subscribe((status) => {
        console.log("🔥 [Supabase] Subscription Status:", status);
        if (status === 'SUBSCRIBED') setCloudStatus('✅ Satellite Connected');
        else if (status === 'CHANNEL_ERROR') setCloudStatus('❌ Satellite Error');
      });

    // 2. News Subscription
    const newsChannel = supabase
      .channel('news_changes')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'news_items' }, () => {
        fetchData();
      })
      .subscribe();

    // 3. Admin Messages Subscription
    const msgChannel = supabase
      .channel('admin_msg_changes')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'admin_messages' }, () => {
        fetchData();
      })
      .subscribe();

    // 4. Media Files Subscription (CRITICAL for Listener Sync)
    const mediaChannel = supabase
      .channel('media_files_changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'media_files' }, (payload: any) => {
        console.log("🎵 [Supabase] Media Library Update:", payload.eventType);
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stateChannel);
      supabase.removeChannel(newsChannel);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(mediaChannel);
    };
  }, [role, fetchData]); // fetchData is stable from useCallback

  // --- ADMIN MASTER SYNC & PULSE ---
  useEffect(() => {
    if (role === UserRole.ADMIN && supabase) {
      const syncStation = () => {
        const urlToSync = activeTrackUrlRef.current;
        const isUrl = urlToSync && (urlToSync.startsWith('http') || urlToSync.startsWith('https'));
        const isCloudUrl = isUrl && !urlToSync?.startsWith('blob:');
        const isJingle = activeTrackIdRef.current === 'jingle' || (!isUrl && urlToSync && urlToSync.toLowerCase().includes('.mp3'));

        console.log("📤 [App] Admin Pulsing State...", isCloudUrl ? "Cloud" : isJingle ? "Jingle" : "None");

        dbService.updateStationState({
          is_playing: isPlayingRef.current,
          is_tv_active: isTvActiveRef.current,
          current_track_id: activeTrackIdRef.current,
          current_track_name: currentTrackNameRef.current,
          current_track_url: isCloudUrl ? urlToSync : (isJingle ? urlToSync : null),
          current_video_id: activeVideoIdRef.current,
          tv_playlist: tvPlaylist,
          current_offset: radioCurrentTimeRef.current,
          timestamp: Date.now()
        }).catch(err => console.error("❌ Station Sync error", err));
      };

      // Initial sync on change
      syncStation();

      // HEARTBEAT: Pulse every 2 seconds for high-precision live sync
      const pulseInterval = setInterval(syncStation, 2000);
      return () => clearInterval(pulseInterval);
    }
  }, [role, supabase]); // Only depends on role/client presence

  const handleLogAdd = useCallback((action: string) => {
    // We'll keep logs local for now, but AdminMessages should be cloud
    dbService.addLog({
      id: Date.now().toString(),
      action,
      timestamp: Date.now()
    }).then(() => fetchData());
  }, [fetchData]);

  const handlePushBroadcast = useCallback(async (text: string) => {
    const msg: AdminMessage = {
      id: Date.now().toString(),
      text,
      timestamp: Date.now()
    };
    await dbService.addAdminMessageCloud(msg);
    handleLogAdd(`Broadcast Alert: ${text}`);
  }, [handleLogAdd]);

  const handleStopNews = useCallback(() => {
    setStopTriggerCount(prev => prev + 1);
    setBroadcastStatus('');
  }, []);

  const handleClearNews = useCallback(async () => {
    setNews([]);
    await dbService.saveNews([]);
    // In a multi-user environment, we should probably clear cloud too
    // But for now let's keep it simple
    handleLogAdd("Newsroom purged by Admin locally.");
  }, [handleLogAdd]);

  const handlePlayNext = useCallback(() => {
    if (isTvActive) {
      console.log('🚫 [App] handlePlayNext blocked (TV is active)');
      return;
    }
    console.log('⏭️ [App] handlePlayNext triggered. Role:', role);
    // Use stable ref for media library to avoid stale closures
    const audioFiles = allMediaRef.current.filter(m => m.type === 'audio');
    if (audioFiles.length === 0) {
      console.warn('⚠️ No audio files found for playlist.');
      setActiveTrackId(null);
      setActiveTrackUrl(null);
      setCurrentTrackName('Station Standby');
      return;
    }

    const currentIndex = audioFiles.findIndex(t => t.id === activeTrackId);
    let nextIndex = isShuffle ? Math.floor(Math.random() * audioFiles.length) : (currentIndex + 1) % audioFiles.length;

    // Safety: If it's the same index and not shuffle, try to force next
    if (!isShuffle && nextIndex === currentIndex && audioFiles.length > 1) {
      nextIndex = (currentIndex + 1) % audioFiles.length;
    }

    const track = audioFiles[nextIndex];
    if (track) {
      console.log('🎵 [App] Advancing to next track:', track.name, 'URL:', track.url);
      updateTrackUrl(track.id, track.url, cleanTrackName(track.name));
      setIsPlaying(true);

      // UNIVERSAL: Keep listener playback alive on track transition
      if (role === UserRole.LISTENER) {
        setListenerHasPlayed(true);
        console.log('🔄 [App] Listener auto-advancing to next track:', track.name);
      }

      // CRITICAL: Push to cloud IMMEDIATELY so listeners don't wait for pulse
      if (role === UserRole.ADMIN && supabase) {
        const isUrl = track.url && (track.url.startsWith('http') || track.url.startsWith('https'));
        const isCloudUrl = isUrl && !track.url?.startsWith('blob:');

        dbService.updateStationState({
          is_playing: true,
          current_track_id: track.id,
          current_track_name: track.name,
          current_track_url: isCloudUrl ? track.url : null,
          current_offset: 0, // Reset for new track
          timestamp: Date.now()
        }).catch(err => console.error("❌ Immediate Advancement Sync Fail:", err));

        // v2.5.0: Locally reset timeline for the pulse heartbeat
        setRadioCurrentTime(0);
      }
    }
  }, [activeTrackId, isShuffle, role, supabase, isTvActive]); // activeTrackId is needed to find current index



  const handlePlayAll = useCallback((force = false) => {
    if (isTvActive && !force) {
      console.log('🚫 [App] handlePlayAll blocked (TV is active)');
      return;
    }
    setHasInteracted(true);
    // Use stable ref for media library
    const audioFiles = allMediaRef.current.filter(m => m.type === 'audio');

    if (audioFiles.length === 0) {
      // No media files, use default stream
      console.warn('No audio files in media library');
      handleLogAdd?.('No audio files found - Please upload music to the media menu');
      return;
    }
    const track = isShuffle ? audioFiles[Math.floor(Math.random() * audioFiles.length)] : audioFiles[0];
    updateTrackUrl(track.id, track.url, cleanTrackName(track.name));
    setIsPlaying(true);

    // CRITICAL: Force cloud sync immediately
    if (role === UserRole.ADMIN && supabase) {
      dbService.updateStationState({
        is_playing: true,
        is_tv_active: false,
        current_track_id: track.id,
        current_track_name: track.name,
        current_track_url: track.url,
        current_offset: 0,
        timestamp: Date.now()
      }).catch(err => console.error("❌ Play All Sync Error", err));
    }
  }, [isShuffle, isTvActive, role, supabase, handleLogAdd]);


  useEffect(() => {
    playlistRef.current = audioPlaylist;
    // Try to get precise location for weather
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        // We'll use coordinates for weather search grounding
        setCurrentLocation(`${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`);
      });
    }
  }, [audioPlaylist]);


  const handleManualBroadcast = useCallback(async (item: NewsItem) => {
    setBroadcastStatus(`🎙️ Manual: ${NEWSCASTER_NAME} reading archived story...`);
    setIsDuckingNDR(true);

    try {
      const audio = await getNewsAudio(item.content);
      if (audio) {
        // We use a simplified version of playBuffer here or trigger via engine
        // For now, let's just use the existing broadcast channel
        const engineTrigger = document.getElementById('manual-story-trigger') as any;
        if (engineTrigger) {
          engineTrigger.value = JSON.stringify(item);
          engineTrigger.click();
        }
      }
    } catch (e) {
      console.error("Manual broadcast failed", e);
    } finally {
      setIsDuckingNDR(false);
      setBroadcastStatus('');
    }
  }, []);

  const handleAddNewsToHistory = useCallback(async (item: NewsItem) => {
    const history = [item, ...newsHistory];
    setNewsHistory(history.slice(0, 200));
    await dbService.saveNews(history); // This appends in dbService logic
    handleLogAdd(`Manual news added: ${item.title}`);
  }, [newsHistory, handleLogAdd]);

  const handleUpdateNewsInHistory = useCallback(async (item: NewsItem) => {
    await dbService.updateNewsInHistory(item);
    const history = await dbService.getNewsHistory();
    setNewsHistory(history);
    handleLogAdd(`Manual news updated: ${item.title}`);
  }, [handleLogAdd]);

  const handleDeleteNewsFromHistory = useCallback(async (id: string) => {
    await dbService.deleteNewsFromHistory(id);
    const history = await dbService.getNewsHistory();
    setNewsHistory(history);
    handleLogAdd(`News item deleted from bucket.`);
  }, [handleLogAdd]);

  const handlePlayJingle = useCallback(async (index: 1 | 2) => {
    try {
      if (index === 2) {
        const instrumental = allMedia.find(m => m.name.toLowerCase().includes('instrumentals (1)'));
        if (instrumental) {
          const audio = new Audio(instrumental.url);
          audio.volume = 1.0; // Set full volume for admin audio
          audio.play().catch(e => console.error("Jingle Playback Error", e));
          return;
        }
      }

      // Fallback for Jingle 1 or if Instrumental not found
      const jText = index === 1 ? JINGLE_1 : JINGLE_2;
      const jAudio = await getJingleAudio(jText);
      if (jAudio) {
        // Correct casting for BlobPart
        const blob = new Blob([jAudio as BlobPart], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = 1.0; // Set full volume for admin audio
        audio.play().catch(e => console.error("TTS Jingle Playback Error", e));
      }
    } catch (e) {
      console.error("Jingle failed", e);
    }
  }, [allMedia]);

  const handleRadioToggle = useCallback((play: boolean) => {
    console.log(`📻 master Radio Control: ${play ? 'ON' : 'OFF'}`);
    handleStopNews();

    if (play) {
      // EXCLUSIVITY: Stop TV first
      setIsTvActive(false);
      setIsTvMuted(true);

      if (role !== UserRole.ADMIN) {
        setListenerHasPlayed(true);
      } else {
        handlePlayAll(true);
      }
    } else {
      setIsPlaying(false);
      setListenerHasPlayed(false);
    }

    // Sync state to cloud
    if (role === UserRole.ADMIN && supabase) {
      dbService.updateStationState({
        is_playing: play,
        is_tv_active: play ? false : isTvActive,
        timestamp: Date.now()
      }).catch(err => console.error("❌ Radio Toggle Sync error", err));
    }
  }, [handleStopNews, handlePlayAll, role, supabase, isTvActive]);

  const handleVideoToggle = useCallback((active: boolean, overrideData?: { videoId?: string | null, playlist?: string[] }) => {
    console.log(`📡 [App] TV Toggle Request: ${active ? 'ON' : 'OFF'}${overrideData ? ' (with override data)' : ''}`);

    if (active) {
      // EXCLUSIVITY: Stop Radio first
      setIsPlaying(false);
      setListenerHasPlayed(false);
      setIsTvMuted(false);
      setIsTvActive(true);

      if (overrideData?.videoId) setActiveVideoId(overrideData.videoId);
      if (overrideData?.playlist) setTvPlaylist(overrideData.playlist);
    } else {
      setIsTvActive(false);
      if (role === UserRole.ADMIN) {
        setActiveVideoId(null);
        setTvPlaylist([]);
      }
    }

    // Broadcaster sync
    if (role === UserRole.ADMIN && supabase) {
      dbService.updateStationState({
        is_tv_active: active,
        is_playing: false, // Always stop radio when TV is controlled (either starting TV or stopping it)
        current_video_id: active ? (overrideData?.videoId || activeVideoId) : null,
        tv_playlist: active ? (overrideData?.playlist || tvPlaylist) : [],
        timestamp: Date.now()
      }).catch(err => console.error("❌ Video Toggle Sync error", err));
    }
  }, [role, supabase, activeVideoId, tvPlaylist]);

  const toggleTvMode = useCallback(() => {
    setIsTvMode(prev => !prev);
    if (!isTvMode) {
      setIsTvActive(true);
      setListenerHasPlayed(false); // Stop radio for TV Mode
    }
  }, [isTvMode]);

  const handlePlayVideo = useCallback((track: MediaFile | number | string, isLive: boolean = true) => {
    handleStopNews();

    let video: MediaFile | undefined;
    let socialUrl: string | undefined;

    if (typeof track === 'string') {
      socialUrl = track;
    } else {
      const videoFiles = allMediaRef.current.filter(v => v.type === 'video');
      video = typeof track === 'number' ? videoFiles[track] : track;
    }

    if (isLive) {
      handleVideoToggle(true, {
        videoId: video?.id || null,
        playlist: socialUrl ? [socialUrl] : []
      });
      handleLogAdd(`TV Feed: Now Broadcasting ${video?.name || 'Social Link'}`);
    } else {
      // PREVIEW MODE (Local Only)
      if (video) {
        setPreviewVideoId(video.id);
        setPreviewPlaylist([]);
      } else if (socialUrl) {
        setPreviewVideoId(null);
        setPreviewPlaylist([socialUrl]);
      }
      console.log("📺 [App] Admin Preview Loaded:", video?.name || socialUrl);
    }
  }, [handleStopNews, role, supabase, handleLogAdd]);

  // --- ADMIN LOGIN LOGIC ---
  useEffect(() => {
    if (role === UserRole.ADMIN) {
      console.log("👮 [App] Admin logged in. Ensuring TV Monitoring is active.");
      // DO NOT deactivate TV anymore - it should stay active for the monitor
      setIsTvActive(true);

      // Synchronize this change to all listeners if we have supabase
      if (supabase) {
        dbService.updateStationState({
          is_tv_active: true,
          // We don't automatically stop radio here anymore, let the exclusivity guard handle it if TV is started
          timestamp: Date.now()
        }).catch(err => console.error("❌ Admin Login TV Sync Error:", err));
      }
      setIsTvMuted(true); // Ensure admin is muted locally
    }
  }, [role, supabase]);

  // --- TRIPLE-LOCK AUDIO EXCLUSIVITY ENFORCEMENT ---
  useEffect(() => {
    // 1. If TV is active and unmuted, Radio MUST be stopped
    if (isTvActive && !isTvMuted) {
      if (listenerHasPlayed || isPlaying) {
        console.log("🛡️ [App] Exclusivity Guard Check");
        if (role !== UserRole.ADMIN) {
          console.log("🛡️ [App] Stopping Radio for non-admin exclusivity.");
          setListenerHasPlayed(false);
          setIsPlaying(false);
        }

        // Push stop command to cloud if admin
        if (role === UserRole.ADMIN && supabase) {
          dbService.updateStationState({
            is_playing: false,
            timestamp: Date.now()
          }).catch(err => console.error("❌ Exclusivity Stop Sync error", err));
        }
      }
    }

    // 2. If Radio is manually started, TV MUST be muted (or hidden)
    if (listenerHasPlayed || isPlaying) {
      if (isTvActive && !isTvMuted) {
        if (role !== UserRole.ADMIN) {
          console.log("🛡️ [App] Exclusivity Guard: Radio ACTIVE. Muting TV.");
          setIsTvMuted(true);
        }
      }
    }
  }, [isTvActive, isTvMuted, listenerHasPlayed, isPlaying, role, supabase]);

  // Expose for footer access
  (window as any).handleLogin = () => setShowAuth(true);
  (window as any).handleLogout = () => { setRole(UserRole.LISTENER); setListenerHasPlayed(false); };

  return (
    <div className="min-h-[100dvh] bg-[#f0fff4] text-[#008751] flex flex-col max-w-md mx-auto relative shadow-2xl border-x border-green-100/30 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* NDRTV Automation Engine - Sara Obosa Lead Anchor */}
      <NDRTVEngine
        currentLocation={currentLocation}
        onStatusChange={setBroadcastStatus}
        onNewsUpdate={(newsAction) => {
          setNews(prev => {
            const next = typeof newsAction === 'function' ? newsAction(prev) : newsAction;
            dbService.syncNewsToCloud(next);
            return next;
          });
        }}
        onLogAdd={handleLogAdd}
        currentNewsFeed={news}
        manualTrigger={newsTriggerCount}
        stopSignal={stopTriggerCount}
        mediaFiles={allMedia}
        onDuckingChange={setIsDuckingNDR}
        isAllowedToPlay={role === UserRole.ADMIN ? isPlaying : listenerHasPlayed}
      />

      <ThompsonEngine
        manualTriggerCount={manualNewsTriggerCount}
        onStatusChange={setBroadcastStatus}
        onNewsUpdate={(newsAction) => {
          setNews(prev => {
            const next = typeof newsAction === 'function' ? newsAction(prev) : newsAction;
            dbService.syncNewsToCloud(next);
            return next;
          });
        }}
        onLogAdd={handleLogAdd}
        stopSignal={stopTriggerCount}
        onDuckingChange={setIsDuckingThompson}
        isAllowedToPlay={role === UserRole.ADMIN ? isPlaying : listenerHasPlayed}
        mediaFiles={allMedia}
      />

      <FavourEngine
        currentLocation={currentLocation}
        triggerCount={manualNewsTriggerCount}
        onStatusChange={setBroadcastStatus}
        onNewsUpdate={(newsAction) => {
          setNews(prev => {
            const next = typeof newsAction === 'function' ? newsAction(prev) : newsAction;
            dbService.syncNewsToCloud(next);
            return next;
          });
        }}
        onLogAdd={handleLogAdd}
        currentNewsFeed={news}
        stopSignal={stopTriggerCount}
        onDuckingChange={setIsDuckingFavour}
        isAllowedToPlay={role === UserRole.ADMIN ? isPlaying : listenerHasPlayed}
        mediaFiles={allMedia}
      />

      <header className="p-4 sticky top-0 z-40 bg-white/90 backdrop-blur-md flex justify-between items-center border-b border-green-50 shadow-sm">
        <div className="flex items-baseline space-x-2">
          <h1 className="text-sm font-black italic uppercase leading-none text-green-950 whitespace-nowrap">{APP_NAME}</h1>
          <span className="text-[5px] font-black text-green-700/40 uppercase tracking-widest translate-y-[-1px]">V5.8-STABILITY-FIX</span>
        </div>
        <div className="flex items-center space-x-2">
          {role === UserRole.LISTENER && (
            <div
              className={`w-2 h-2 rounded-full shadow-sm transition-colors duration-500 ${cloudStatus === 'Connected' ? 'bg-green-500' :
                cloudStatus === 'Initializing' || cloudStatus === 'Syncing...' ? 'bg-yellow-400' : 'bg-red-500'
                }`}
              title={cloudStatus || 'Connecting...'}
            ></div>
          )}
          {!supabase && <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="Cloud Offline"></div>}
          {isDucking && <span className="text-[7px] font-black uppercase text-red-500 animate-pulse bg-red-50 px-1 rounded shadow-sm border border-red-100">Live</span>}
          <div className={`w-3 h-3 rounded-full ${supabase ? 'bg-green-500' : 'bg-gray-400'}`} title={supabase ? "Cloud Connected" : "Cloud Disconnected"}></div>
          {audioStatus !== 'Ready' && <span className="text-[10px] text-green-700 font-bold ml-1">{audioStatus}</span>}
          {lastError && <span className="text-[7px] bg-red-600 text-white px-1.5 py-0.5 rounded ml-2 font-black uppercase animate-bounce">{lastError}</span>}
        </div>
      </header>

      {/* --- CINEMATIC TV HUB (RECEIVER MODE) --- */}
      {isTvMode && (
        <TVHub
          activeVideo={allMediaRef.current.find(m => m.id === activeVideoId) || null}
          allVideos={allMedia.filter(v => v.type === 'video')}
          news={news}
          adminMessages={adminMessages}
          isNewsPlaying={isDucking}
          isTvActive={isTvActive}
          tvPlaylist={tvPlaylist}
          onVideoAdvance={(idx) => handlePlayVideo(idx)}
          isAdmin={role === UserRole.ADMIN}
          isMuted={isTvMuted}
        />
      )}

      {/* --- MASTER RADIO PLAYER (AUDIO ENGINE) --- */}
      <div className={`transition-all duration-700 ${(!isTvActive || (role === UserRole.LISTENER && !isPlaying)) ? 'opacity-100 max-h-[400px] visible py-4' : 'opacity-0 max-h-0 invisible overflow-hidden'}`}>
        <RadioPlayer
          onStateChange={(playing) => {
            if (role === UserRole.ADMIN) setIsPlaying(playing);
          }}
          onTimeUpdate={setRadioCurrentTime}
          startTime={role === UserRole.ADMIN ? 0 : radioCurrentTime}
          activeTrackUrl={activeTrackUrl}
          currentTrackName={currentTrackName}
          forcePlaying={role === UserRole.ADMIN ? isPlaying : listenerHasPlayed}
          onTrackEnded={handlePlayNext}
          activeTrackId={activeTrackId}
          isAdmin={role === UserRole.ADMIN}
          isDucking={isDucking}
          isTvActive={isTvActive}
          isTvMuted={isTvMuted}
          onTogglePlayback={handleRadioToggle}
        />
      </div>

      {/* ADMIN TV SYNC ENGINE (Invisible Sync) */}
      {role === UserRole.ADMIN && (
        <div className="hidden">
          <TVPlayer
            activeVideo={allMediaRef.current.find(m => m.id === activeVideoId) || null}
            allVideos={allMedia.filter(v => v.type === 'video')}
            news={[]}
            adminMessages={[]}
            onVideoAdvance={(idxOrTrack) => {
              if (typeof idxOrTrack === 'number') handlePlayVideo(idxOrTrack);
            }}
            isNewsPlaying={false}
            isActive={isTvActive}
            isAdmin={true}
            isMuted={true}
            tvPlaylist={tvPlaylist}
          />
        </div>
      )}

      <main className="flex-grow pt-1 px-1.5">
        {/* JOIN BROADCAST PROMPT REMOVED FOR TV ONLY */}

        {/* LISTENER VIEW (Always mounted to keep TV/Audio alive) */}
        <div className={role === UserRole.LISTENER ? 'block' : 'hidden'}>
          <ListenerView
            stationState={{
              location: currentLocation,
              localTime: new Date().toLocaleTimeString(),
              is_playing: isPlaying,
              current_track_name: currentTrackName
            }}
            news={news}
            adminMessages={adminMessages}
            reports={reports}
            onPlayTrack={(t) => {
              handleStopNews(); // Ensure news stops
              setHasInteracted(true);
              updateTrackUrl(t.id, t.url, cleanTrackName(t.name));
              setListenerHasPlayed(true);
              setIsTvActive(false);
            }}
            onPlayVideo={handlePlayVideo}
            onVideoAdvance={(idx) => handlePlayVideo(idx)}
            activeVideo={allMediaRef.current.find(m => m.id === activeVideoId) || null}
            isNewsPlaying={isDucking}
            isTvActive={isTvActive}
            tvPlaylist={tvPlaylist}
            allVideos={allMedia}
            isRadioPlaying={listenerHasPlayed}
            onRadioToggle={handleRadioToggle}
            onTvToggle={handleVideoToggle}
            isTvMuted={isTvMuted}
            onTvMuteChange={setIsTvMuted}
            isAdmin={role === UserRole.ADMIN}
            onReport={async (report) => {
              await dbService.addReportCloud(report);
              fetchData();
            }}
          />
        </div>

        {/* ADMIN VIEW */}
        {role === UserRole.ADMIN && (
          <AdminView
            onRefreshData={fetchData} logs={logs} onPlayTrack={(t) => {
              console.log('▶️ Play Track Clicked:', t.name, t.url);
              setHasInteracted(true); updateTrackUrl(t.id, t.url, cleanTrackName(t.name)); setIsPlaying(true);
              setIsTvActive(false);
            }}
            isRadioPlaying={isPlaying} onToggleRadio={(play) => handleRadioToggle(play)}
            currentTrackName={currentTrackName} isShuffle={isShuffle} onToggleShuffle={() => setIsShuffle(!isShuffle)}
            onPlayAll={handlePlayAll} onSkipNext={handlePlayNext}
            onPushBroadcast={handlePushBroadcast} onPlayJingle={handlePlayJingle}
            news={news}
            onTriggerFullBulletin={async () => { setNewsTriggerCount(prev => prev + 1); }}
            onTriggerManualBroadcast={async () => { setManualNewsTriggerCount(prev => prev + 1); }}
            onPlayPodcastFile={async () => { }}
            onPlayDirectTTS={async () => { }}
            onSaveManualScript={async (s) => {
              await dbService.saveManualScript(s);
              setManualScript(s);
            }}
            manualScript={manualScript}
            mediaFiles={allMedia}
            status={broadcastStatus}
            onRefreshWire={() => fetchData(true)}
            onClearNews={handleClearNews}
            onStopNews={handleStopNews}
            newsHistory={newsHistory}
            onManualBroadcast={handleManualBroadcast}
            onAddNews={handleAddNewsToHistory}
            onUpdateNews={handleUpdateNewsInHistory}
            onDeleteNews={handleDeleteNewsFromHistory}
            onDeleteMedia={async (id, fileName) => {
              await dbService.deleteMediaCloud(id, fileName);
              fetchData();
            }}
            activeVideoId={activeVideoId}
            onPlayVideo={handlePlayVideo}
            previewVideoId={previewVideoId}
            previewPlaylist={previewPlaylist}
            tvPlaylist={tvPlaylist}
            onUpdatePlaylist={setTvPlaylist}
            isTvActive={isTvActive}
            onToggleTv={handleVideoToggle}
            onResetSync={handleResetSync}
            onLogAdd={handleLogAdd}
            reports={reports}
          />
        )}
      </main>

      {showAuth && <PasswordModal onClose={() => setShowAuth(false)} onSuccess={() => { setRole(UserRole.ADMIN); setShowAuth(false); }} />}

      {/* GLOBAL FOOTER - PERSISTENT */}
      <footer className="w-full text-center pb-8 pt-4 mt-auto flex flex-col items-center space-y-4 bg-transparent relative z-[50]">

        {/* 1. ADMIN LOGIN REMOVED FROM FOOTER -> NOW FLOATING */}

        {/* 2. APP DOWNLOAD SECTION - COMPACTED */}
        <div className="flex flex-col items-center space-y-2 opacity-60 hover:opacity-100 transition-opacity">
          <button
            onClick={async () => {
              try {
                const url = await dbService.getAppDownloadUrl();
                if (url) {
                  const urlWithCacheBuster = `${url}?t=${Date.now()}`;
                  window.open(urlWithCacheBuster, '_blank');
                } else {
                  alert("Download link is currently being updated. Please try again in a few minutes.");
                }
              } catch (err) {
                console.error("Download failed", err);
                alert("Download failed. Please contact support.");
              }
            }}
            className="group flex items-center space-x-2 px-6 py-2 bg-[#3DDC84] hover:bg-[#35c476] text-white rounded-lg transition-all shadow-md active:scale-95"
          >
            <i className="fab fa-android text-lg"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Download for Android</span>
          </button>
        </div>

        {/* 3. BRANDING */}
        <div className="flex flex-col items-center space-y-2 w-full px-8 pb-4">
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-green-900/5 rounded-full border border-green-900/10 opacity-60">
            <span className="text-[7px] font-black uppercase text-green-950 tracking-tighter">{APP_NAME}</span>
            <span className="text-green-900/20 px-0.5">|</span>
            <span className="text-[7px] text-green-800 font-mono tracking-tighter">© 2026</span>
          </div>
        </div>
      </footer>

      {/* 4. FLOATING ADMIN BUTTON */}
      <button
        onClick={role === UserRole.ADMIN ? () => { setRole(UserRole.LISTENER); setListenerHasPlayed(false); } : () => setShowAuth(true)}
        className="fixed bottom-6 right-6 z-[200] w-12 h-12 bg-white/80 backdrop-blur-md rounded-full border border-green-800/20 shadow-xl flex items-center justify-center text-green-800/40 hover:text-green-800 hover:bg-green-800/5 hover:scale-110 active:scale-90 transition-all"
        title={role === UserRole.ADMIN ? 'Logout' : 'Admin Login'}
      >
        <i className={`fas ${role === UserRole.ADMIN ? 'fa-sign-out-alt' : 'fa-lock'} text-sm`}></i>
      </button>

      {/* TV MODE TOGGLE */}
      <button
        onClick={toggleTvMode}
        className={`fixed bottom-6 left-6 z-[600] w-12 h-12 rounded-full border shadow-xl flex items-center justify-center transition-all ${isTvMode ? 'bg-red-600 border-red-700 text-white' : 'bg-white/80 backdrop-blur-md border-indigo-200 text-indigo-600 hover:scale-110'}`}
        title={isTvMode ? 'Exit TV Mode' : 'Enter TV Mode'}
      >
        <i className={`fas ${isTvMode ? 'fa-times' : 'fa-tv'} text-sm`}></i>
      </button>
    </div>
  );
};

export default App;
