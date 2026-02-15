import React from 'react';
import AudioVisualizer from '../Listener/AudioVisualizer';
import { STATION_TAGLINE } from '../../constants';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  analyser?: AnalyserNode | null;
  isPlaying?: boolean;
  isJingle?: boolean;
  status?: 'IDLE' | 'LOADING' | 'PLAYING' | 'ERROR';
  onTogglePlayback?: () => void;
  showPlayButton?: boolean;
  isOnline?: boolean; // New Prop
}

const Logo: React.FC<LogoProps> = ({
  size = 'md',
  analyser,
  isPlaying = false,
  isJingle = false,
  status = 'IDLE',
  onTogglePlayback,
  showPlayButton = true,
  isOnline = false
}) => {
  const scale = size === 'sm' ? 0.8 : size === 'lg' ? 1.0 : 0.88;

  return (
    <div
      className={`flex flex-col items-center w-[340px] h-64 mx-auto overflow-hidden rounded-[40px] shadow-2xl bg-white relative transition-all duration-500 ${isJingle ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-105' : ''} ${status === 'ERROR' ? 'ring-2 ring-red-500' : ''}`}
      style={{ transform: `scale(${scale})` }}
    >
      {/* Background: Nigerian Flag Stripes */}
      <div className="absolute inset-0 flex h-full w-full pointer-events-none">
        <div className={`flex-1 transition-colors duration-500 ${status === 'PLAYING' ? 'bg-[#008751]' : status === 'ERROR' ? 'bg-red-600' : 'bg-green-800'}`}></div>
        <div className="flex-1 bg-white"></div>
        <div className={`flex-1 transition-colors duration-500 ${status === 'PLAYING' ? 'bg-[#008751]' : status === 'ERROR' ? 'bg-red-600' : 'bg-green-800'}`}></div>
      </div>

      {/* Sun Flares / Ambient Light */}
      <div className={`absolute top-0 right-0 w-48 h-48 bg-yellow-200/10 blur-[80px] rounded-full transition-opacity duration-1000 ${isJingle ? 'opacity-100 animate-pulse' : 'opacity-30'}`}></div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full w-full px-2">

        <div className="flex items-center justify-center space-x-2 w-full">
          {/* LEFT SIDE VISUALIZER WALL - Wider for visual impact */}
          <div className={`w-16 h-28 transition-opacity duration-700 ${isPlaying ? 'opacity-100' : 'opacity-60'}`}>
            <AudioVisualizer analyser={analyser || null} isActive={isPlaying} variant="sides" />
          </div>

          {/* CENTRAL BOX FRAME - Widened */}
          <div className={`relative bg-white/40 backdrop-blur-md border border-white/60 p-6 rounded-[30px] shadow-xl flex flex-col items-center justify-center min-w-[180px] min-h-[150px] transition-all duration-500 ${isJingle ? 'border-amber-400 bg-amber-50/60' : ''}`}>

            {/* SATELLITE ICON - Moved here as requested */}
            <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full shadow-sm ${isOnline ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]'}`} title="Satellite Status"></div>

            <div className="text-center font-black leading-none drop-shadow-md relative z-10">
              <div className={`text-3xl tracking-tighter drop-shadow-sm transition-colors ${isJingle ? 'text-amber-700' : status === 'PLAYING' ? 'text-[#008751]' : 'text-green-900'}`}>
                NDR
              </div>
              <div className={`text-base tracking-tighter mt-[-2px] uppercase transition-colors ${isJingle ? 'text-amber-600/80' : 'text-green-700/80'}`}>
                Radio
              </div>
            </div>


            {/* Gloss Overlay */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-2xl"></div>
          </div>

          {/* RIGHT SIDE VISUALIZER WALL */}
          <div className={`w-16 h-28 transition-opacity duration-700 ${isPlaying ? 'opacity-100' : 'opacity-60'} transform scale-x-[-1]`}>
            <AudioVisualizer analyser={analyser || null} isActive={isPlaying} variant="sides" />
          </div>
        </div>

        {/* TAGLINE - STATIC WITH OUTLINE */}
        <div className="mt-1 text-center">
          <h2
            className="text-base font-black tracking-normal uppercase text-black"
            style={{
              textShadow: '1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff'
            }}
          >
            {STATION_TAGLINE}
          </h2>
          {status === 'ERROR' && <p className="text-[8px] font-black text-red-600 mt-1 uppercase">Connection Error</p>}
        </div>
      </div>
    </div>
  );
};

export default Logo;