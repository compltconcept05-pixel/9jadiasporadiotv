
import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_STREAM_URL, JINGLE_1, JINGLE_2 } from '../../constants';
const SILENT_FALLBACK_URL = "https://stream.zeno.fm/u9mphfk604zuv"; // Silent fallback if cloud fails
import { getJingleAudio } from '../../services/aiDjService';
import Logo from '../Shared/Logo';

interface RadioPlayerProps {
  onStateChange: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number) => void; // Tracking for master sync
  startTime?: number; // Seek to live position
  activeTrackUrl?: string | null;
  currentTrackName?: string;
  forcePlaying?: boolean;
  onTrackEnded?: () => void;
  activeTrackId?: string | null;
  isAdmin?: boolean;
  isDucking?: boolean;
  showPlayButton?: boolean;
  isTvActive?: boolean;
  isTvMuted?: boolean;
  onTogglePlayback?: (play: boolean) => void;
}

const RadioPlayer: React.FC<RadioPlayerProps> = ({
  onStateChange,
  onTimeUpdate,
  startTime = 0,
  activeTrackUrl,
  currentTrackName = 'Live Stream',
  forcePlaying = false,
  onTrackEnded,
  activeTrackId,
  isAdmin = false,
  isDucking = false,
  showPlayButton = true,
  isTvActive = false,
  isTvMuted = false,
  onTogglePlayback
}) => {
  const [isPlaying, setIsPlaying] = useState(forcePlaying);
  const [volume, setVolume] = useState(1.0);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'PLAYING' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isStreamRef = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const onTrackEndedRef = useRef(onTrackEnded);
  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
  }, [onTrackEnded]);

  const initAudioContext = () => {
    try {
      if (!audioRef.current) return;

      // Safer visualization guard: Only for local files by default
      if (isStreamRef.current) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(console.warn);
      }

      (window as any).resumeRadioAudioContext = () => ctx.resume();

      if (!gainNodeRef.current) {
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gainNodeRef.current = gain;
      }

      if (!sourceRef.current) {
        try {
          sourceRef.current = ctx.createMediaElementSource(audioRef.current);
          const newAnalyser = ctx.createAnalyser();
          newAnalyser.fftSize = 256;

          sourceRef.current.connect(newAnalyser);
          newAnalyser.connect(gainNodeRef.current!);
          setAnalyser(newAnalyser);
        } catch (err) {
          console.warn("MediaElementSource creation failed:", err);
          // Continue without visualizer for streams
        }
      }
    } catch (e) {
      console.error("Audio Initialization Failure:", e);
    }
  };

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handlePlay = () => {
      setStatus('PLAYING');
      setIsPlaying(true);
      onStateChange(true);
      setErrorMessage('');

      // Auto-resume AudioContext on play
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(console.warn);
      }
    };

    const handlePause = () => {
      setStatus('IDLE');
      setIsPlaying(false);
      onStateChange(false);
    };

    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;

      // Ignore errors if we are in transition or have no source intentionally
      if (!target.src || target.src === '' || target.src === window.location.href) {
        return;
      }

      let message = 'Playback error';
      if (target.error) {
        switch (target.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            message = 'Playback aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            message = 'Network error - Check your connection';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = 'Audio format not supported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Stream URL not accessible or invalid';
            break;
        }
      }

      console.error("Audio Playback Error:", message, target.error, "URL:", target.src);

      // Only set error status if it's a real failure while we SHOULD be playing
      if (status !== 'IDLE') {
        setErrorMessage(message);
        setStatus('ERROR');
        setIsPlaying(false);
        onStateChange(false);

        // Auto-skip logic: If a track fails to load, move to the next one automatically
        console.warn("⏭️ [RadioPlayer] Auto-skipping failed track...");
        onTrackEndedRef.current?.();
      }
    };

    const handleCanPlay = () => {
      console.log("Stream ready to play");
      if (status === 'LOADING') {
        setStatus('IDLE');
      }
    };

    const handleLoadStart = () => {
      console.log("Loading stream...");
      setStatus('LOADING');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', () => setStatus('LOADING'));
    audio.addEventListener('playing', () => {
      handlePlay();
      // "Last Resorted" sync check when playback actually starts producing sound
      if (!isAdmin && startTime > 0 && Math.abs(audio.currentTime - startTime) > 2.0) {
        console.log(`📡 [RadioPlayer] Final Playing Sync: Correcting to ${startTime}s`);
        audio.currentTime = startTime;
      }
    });
    audio.addEventListener('ended', () => onTrackEndedRef.current?.());
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    });
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      // Wait for metadata to be fully loaded before seeking
      if (!isAdmin && startTime > 0) {
        console.log(`📡 [RadioPlayer] Initial Meta Sync: (StartTime: ${startTime}s, Status: ${audio.readyState})`);
        // If readyState is 0 (HAVE_NOTHING), wait for higher state
        if (audio.readyState >= 1) {
          audio.currentTime = startTime;
        } else {
          const checkReady = setInterval(() => {
            if (audio.readyState >= 1) {
              console.log(`📡 [RadioPlayer] Meta Seek Retry: Success!`);
              audio.currentTime = startTime;
              clearInterval(checkReady);
            }
          }, 100);
          setTimeout(() => clearInterval(checkReady), 3000); // Guard
        }
      }
    });
    audio.addEventListener('canplay', () => {
      handleCanPlay();
      // Second chance sync if meta was too early - Tight 1.5s threshold for "same timing"
      if (!isAdmin && startTime > 0 && Math.abs(audio.currentTime - startTime) > 1.5) {
        console.log(`📡 [RadioPlayer] CanPlay Sync: Adjusting to ${startTime}s`);
        audio.currentTime = startTime;
      }
    });
    audio.addEventListener('loadstart', handleLoadStart);

    const setupSource = (src: string | null | undefined) => {
      const targetSrc = src || DEFAULT_STREAM_URL;

      // Validation: If no source provided and no default stream, put in Standby
      if (!targetSrc || targetSrc === '' || targetSrc === window.location.href) {
        console.log('📡 [RadioPlayer] Station in Standby Mode - No active source.');
        audio.src = "";
        setStatus('IDLE');
        return;
      }

      audio.src = targetSrc;
      isStreamRef.current = !audio.src.startsWith('blob:') && !audio.src.startsWith('data:');

      // CRITICAL FIX: Don't set crossOrigin for live streams
      if (audio.src.startsWith('blob:') || audio.src.startsWith('data:')) {
        audio.crossOrigin = null;
      } else {
        audio.removeAttribute('crossorigin');
      }

      if (targetSrc) {
        audio.preload = 'metadata';
        audio.load();
      }
    };

    setupSource(activeTrackUrl);

    // --- WAKE LOCK (UPGRADED FOR ALL USERS) ---
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log("🛡️ [RadioPlayer] WakeLock Active - Screen/Audio process protected.");
        } catch (err) {
          console.warn("⚠️ WakeLock failed:", err);
        }
      }
    };

    if (forcePlaying || isPlaying) requestWakeLock();

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeAttribute('src');
      audioRef.current = null;
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [isAdmin]);

  useEffect(() => {
    if (audioRef.current) {
      const targetSrc = activeTrackUrl || DEFAULT_STREAM_URL;

      // Validation: If no source provided and no default stream, put in Standby
      if (!targetSrc || targetSrc === '' || targetSrc === window.location.href) {
        console.log('📡 [RadioPlayer] Switching to Standby Mode.');
        audioRef.current.pause();
        audioRef.current.removeAttribute('src'); // Better than src = ""
        audioRef.current.load(); // Force reset state
        setStatus('IDLE');
        return;
      }

      console.log('📻 RadioPlayer received URL:', targetSrc);
      if (audioRef.current.src !== targetSrc) {
        const isLocal = targetSrc.startsWith('blob:') || targetSrc.startsWith('data:');
        isStreamRef.current = !isLocal;

        // Critical: Set crossOrigin for local/blob properly
        if (isLocal) {
          audioRef.current.crossOrigin = 'anonymous'; // Try anonymous for local to allow viz
        } else {
          audioRef.current.removeAttribute('crossorigin');
        }

        // Robust transition: pause and clear before loading new src
        audioRef.current.pause();
        audioRef.current.src = targetSrc;
        audioRef.current.load();

        if (isPlaying || forcePlaying) {
          try {
            // ONLY init for local files to be 100% safe for Admin
            if (!isStreamRef.current) {
              initAudioContext();
            }
          } catch (vErr) {
            console.warn("Visualizer init failed, continuing to play...", vErr);
          }

          audioRef.current.play().catch(err => {
            console.warn("Autoplay blocked or stream error:", err);
            // If it was a track failing, try falling back to silent stream
            if (!isStreamRef.current && SILENT_FALLBACK_URL) {
              console.log("🔄 Playback failed, falling back to silent stream...");
              audioRef.current!.src = SILENT_FALLBACK_URL;
              audioRef.current!.load();
              audioRef.current!.play().catch(e => console.error("Final fallback failed:", e));
            }
            setStatus('IDLE');
          });
        }
      }
    }
  }, [activeTrackUrl, activeTrackId]);

  // LIVE SYNC DRIFT CHECK
  useEffect(() => {
    const isActuallyActive = isPlaying || forcePlaying;
    if (startTime > 0 && audioRef.current && !isAdmin && isActuallyActive) {
      const diff = Math.abs(audioRef.current.currentTime - startTime);
      // Reverted to 1.5s for "same timing" as requested (restoring precision)
      if (diff > 1.5) {
        console.log(`📡 [RadioPlayer] Sync Drift Detected (${diff.toFixed(1)}s). Correcting to ${startTime}s...`);
        audioRef.current.currentTime = startTime;
      }
    }
  }, [startTime, isAdmin, isPlaying, forcePlaying]);

  // Jingle Scheduler Refs
  const lastJingleTimeRef = useRef<number>(Date.now());
  const jingleAudioRef = useRef<HTMLAudioElement | null>(null);
  const isJinglePlayingRef = useRef<boolean>(false);

  // Initialize Jingle Audio
  useEffect(() => {
    jingleAudioRef.current = new Audio();
    jingleAudioRef.current.volume = 1.0;
    return () => {
      if (jingleAudioRef.current) {
        jingleAudioRef.current.pause();
        jingleAudioRef.current = null;
      }
    };
  }, []);

  // Jingle Playback Logic
  const playJingleOverlay = async () => {
    if (isJinglePlayingRef.current || isDucking || !isPlaying) return;

    try {
      console.log("🎵 Triggering Anti-Copyright Jingle Overlay...");
      isJinglePlayingRef.current = true;

      // select random jingle
      // Using JINGLE_1 predominantly for voiceover, Jingle 2 is instrumental which might clash
      const jingleText = Math.random() > 0.7 ? JINGLE_2 : JINGLE_1;

      const audioData = await getJingleAudio(jingleText);
      if (!audioData || !jingleAudioRef.current) {
        isJinglePlayingRef.current = false;
        return;
      }

      // Create Blob URL
      const blob = new Blob([audioData as any], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      // Duck Main Audio
      const originalVolume = volume;
      const duckedVolume = volume * 0.3; // Drop to 30%

      // Apply Ducking
      if (audioRef.current) audioRef.current.volume = duckedVolume;
      if (gainNodeRef.current && audioContextRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(duckedVolume, audioContextRef.current.currentTime, 0.5);
      }

      // Play Jingle
      jingleAudioRef.current.src = url;
      jingleAudioRef.current.onended = () => {
        console.log("🎵 Jingle Ended - Restoring Volume");
        // Restore Volume
        if (audioRef.current) audioRef.current.volume = originalVolume;
        if (gainNodeRef.current && audioContextRef.current) {
          gainNodeRef.current.gain.setTargetAtTime(originalVolume, audioContextRef.current.currentTime, 0.5);
        }
        isJinglePlayingRef.current = false;
        lastJingleTimeRef.current = Date.now(); // Reset timer
      };

      await jingleAudioRef.current.play();

    } catch (e) {
      console.error("Jingle Overlay Failed:", e);
      isJinglePlayingRef.current = false;
      // Ensure volume is restored if error
      if (audioRef.current) audioRef.current.volume = volume;
    }
  };

  // Scheduler & Watchdog Check Loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // 1. Jingle Scheduler (approx every 60s)
      const timeSinceLastJingle = now - lastJingleTimeRef.current;
      const jingleThreshold = 45000 + (Math.random() * 30000);
      if (timeSinceLastJingle > jingleThreshold && !isJinglePlayingRef.current && !isDucking) {
        playJingleOverlay();
      }

      // 2. SILENCE WATCHDOG (Listener Only)
      // If we SHOULD be playing but audio element is stalled or dead silent
      if (!isAdmin && forcePlaying && audioRef.current) {
        const isActuallyPlaying = !audioRef.current.paused && audioRef.current.readyState >= 2;
        // Only reload if we are truly stalled (readyState < 2) and NOT muted
        if (!isActuallyPlaying && !audioRef.current.muted && audioRef.current.readyState < 2) {
          console.warn("🐕 [Watchdog] Stall detected! Attempting recovery...");
          audioRef.current.play().catch(e => {
            console.log("Watchdog play failed, reloading...");
            audioRef.current?.load();
            audioRef.current?.play().catch(pE => console.error("Watchdog total failure:", pE));
          });
        }
      }
    }, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, [isPlaying, isDucking, volume, isAdmin, forcePlaying]);

  useEffect(() => {
    if (audioRef.current) {
      const shouldBePlaying = forcePlaying && !isDucking;

      if (!shouldBePlaying && !audioRef.current.paused) {
        console.log('📡 [RadioPlayer] EXCLUSIVITY LOCK: Pausing Radio audio (TV or Manual Pause active).');
        audioRef.current.pause();
        setIsPlaying(false);
        onStateChange(false);
      } else if (shouldBePlaying && audioRef.current.paused) {
        // Validate audio source before attempting to play
        if (!audioRef.current.src || audioRef.current.src === '' || audioRef.current.src === window.location.href) {
          console.warn('📡 [RadioPlayer] No valid audio source, skipping auto-play');
          return;
        }

        console.log('📡 [RadioPlayer] EXCLUSIVITY UNLOCKED: Playing Radio audio.');
        // Only init audio context for local files
        if (!isStreamRef.current) {
          initAudioContext();
        }

        audioRef.current.play().catch((err) => {
          console.error("❌ [RadioPlayer] Play failed:", err.message, "URL:", audioRef.current?.src);
          if (err.name !== 'AbortError') {
            setStatus('ERROR');
            setErrorMessage('Playback Error: Check Cloud Connection');
          }
        });
      }
    }
  }, [forcePlaying, isDucking, onStateChange]);

  useEffect(() => {
    // Apply volume settings - FULL SILENCE during News as requested
    const targetGain = isDucking ? 0 : volume;
    if (gainNodeRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
      gainNodeRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, 0.1);
    } else if (audioRef.current) {
      audioRef.current.volume = targetGain;
      audioRef.current.muted = false;
    }
  }, [volume, isDucking]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      if (onTogglePlayback) {
        onTogglePlayback(false);
      }
      audioRef.current.pause();
    } else {
      // PRIMING: Directly interact with audio element to unlock it
      setStatus('LOADING');
      setErrorMessage('');

      try {
        if (isDucking) {
          setErrorMessage("Cannot play during News Broadcast");
          setStatus('IDLE');
          return;
        }

        // FORCE resume on user click
        if (audioContextRef.current) {
          await audioContextRef.current.resume();
        } else if (!isStreamRef.current) {
          initAudioContext();
          if (audioContextRef.current) await audioContextRef.current.resume();
        }

        // Parent Toggle SECOND to update station state if needed
        if (onTogglePlayback) {
          onTogglePlayback(true);
        } else {
          setIsPlaying(true);
          onStateChange(true);
        }

        // Actual Play THIRD
        await audioRef.current.play();
      } catch (err: any) {
        console.error("Play error:", err);
        if (err.name !== 'AbortError') {
          setStatus('ERROR');
          setErrorMessage(err.message || 'Failed to play stream');
          if (onTogglePlayback) onTogglePlayback(false);
        }
      }
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-0 w-full">
      <div className="relative z-50 pointer-events-auto">
        <Logo
          size="lg"
          analyser={analyser}
          isPlaying={isPlaying}
          status={status}
          onTogglePlayback={handlePlayPause}
          showPlayButton={true}
        />
      </div>

      <div className="w-full px-8 mt-6 relative z-20">
        <div className="h-1.5 w-full bg-green-100/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/20">
          <div className="h-full bg-[#008751] transition-all duration-300 shadow-[0_0_10px_rgba(0,135,81,0.5)]" style={{ width: `${progress}%` }}></div>
        </div>
        {duration > 0 && isFinite(duration) && (
          <div className="flex justify-between mt-0.5 px-1">
            <span className="text-[6px] font-black uppercase text-green-800 tracking-tighter">{formatTime(currentTime)}</span>
            <span className="text-[6px] font-black uppercase text-green-800 tracking-tighter">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center space-y-4 mt-8 relative z-20 w-full px-8">
        {/* Track Info Display */}
        <div className="bg-white/40 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/60 w-full overflow-hidden shadow-lg flex items-center justify-center text-center">
          <span className="text-xs font-black uppercase text-green-900 tracking-[0.2em] line-clamp-1">
            NOW PLAYING: {currentTrackName}
          </span>
        </div>

        {isDucking && (
          <div className="flex items-center space-x-2 animate-bounce">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Live Bulletin</span>
          </div>
        )}

        {/* Status indicator */}
        {(!isAdmin && isTvActive && !isTvMuted) && (
          <div className="flex items-center space-x-2 animate-pulse bg-amber-50 px-4 py-1.5 rounded-full border border-amber-200 shadow-sm">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span className="text-[8px] font-black text-amber-900 uppercase tracking-[0.2em]">TV ACTIVE - STANDBY MODE</span>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50/80 backdrop-blur-sm px-6 py-2 rounded-xl border border-red-200/50 w-full shadow-sm">
            <p className="text-[10px] font-black text-red-600 text-center uppercase tracking-tight">{errorMessage}</p>
          </div>
        )}

        <div className="w-64 flex items-center space-x-4 bg-white/30 backdrop-blur-sm p-2 rounded-full border border-white/40 shadow-inner">
          <i className="fas fa-volume-down text-green-800 text-xs"></i>
          <input
            type="range" min="0" max="1" step="0.01" value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-grow h-1.5 bg-green-100/50 rounded-lg appearance-none accent-[#008751] cursor-pointer"
          />
          <i className="fas fa-volume-up text-green-800 text-xs"></i>
        </div>
      </div>
    </div>
  );
};

export default RadioPlayer;
