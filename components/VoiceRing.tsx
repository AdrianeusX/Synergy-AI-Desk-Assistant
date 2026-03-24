import React, { useEffect, useState } from 'react';
import { AppState, SpeakerState } from '../types';

interface VoiceRingProps {
  appState: AppState;
  speakerState: SpeakerState;
  volume: number;
  size?: number;
}

const VoiceRing: React.FC<VoiceRingProps> = ({ appState, speakerState, volume, size = 200 }) => {
  const [visualVolume, setVisualVolume] = useState(0.2); // Base size

  useEffect(() => {
    // Smooth the volume transition
    const targetScale = 0.2 + (volume * 0.8); // Scale between 0.2 (base) and 1.0
    setVisualVolume(prev => prev + (targetScale - prev) * 0.2);
  }, [volume]);

  // Dynamic Styles based on state
  const isIdle = appState === AppState.IDLE || appState === AppState.ENDED;
  const isConnecting = appState === AppState.CONNECTING;
  const isInCall = appState === AppState.IN_CALL;
  const isEnding = appState === AppState.ENDING;

  // Colors
  const synergyColor = '#785ff9'; // New Purple
  const userColor = 'rgb(255, 255, 255)';   // White
  const idleColor = 'rgba(120, 95, 249, 0.3)';
  
  let ringColor = synergyColor;
  let glowColor = 'rgba(120, 95, 249, 0.5)';

  if (isInCall) {
    if (speakerState === SpeakerState.USER_SPEAKING) {
        ringColor = userColor;
        glowColor = 'rgba(255, 255, 255, 0.4)';
    }
  } else if (isIdle || isEnding) {
    ringColor = idleColor;
    glowColor = 'rgba(120, 95, 249, 0.1)';
  }

  // Base sizing
  const baseSize = size;
  
  // Calculate dynamic scale
  let scale = 1;
  if (isInCall) {
      scale = 1 + (visualVolume * 0.5); // Pulse up to 1.5x
  } else if (isConnecting) {
      scale = 1; // Animation handles it
  }

  // Container sizing should be larger than base size to accommodate ripples/glow
  const containerSize = size * 1.6;

  return (
    <div 
        className="relative flex items-center justify-center transition-all duration-500"
        style={{ width: containerSize, height: containerSize }}
    >
        {/* Connection Spinner */}
        {isConnecting && (
             <div className="absolute inset-0 flex items-center justify-center">
                 <div 
                    className="border-2 border-t-[#785ff9] border-r-transparent border-b-purple-900 border-l-transparent rounded-full animate-spin"
                    style={{ width: baseSize * 1.1, height: baseSize * 1.1 }}
                 ></div>
             </div>
        )}

        {/* Outer Glow Ring (Breathing) */}
        <div 
            className={`absolute rounded-full transition-all duration-300 ease-out blur-xl`}
            style={{
                width: `${baseSize}px`,
                height: `${baseSize}px`,
                backgroundColor: glowColor,
                transform: `scale(${isIdle ? 1.1 : scale * 1.2})`,
                opacity: isIdle ? 0.5 : 0.8,
                animation: isIdle ? 'pulse 4s infinite' : 'none'
            }}
        />

        {/* Inner Solid Ring (The Core) */}
        <div 
            className={`absolute rounded-full border-2 transition-all duration-100 ease-linear flex items-center justify-center bg-black/50 backdrop-blur-sm`}
            style={{
                width: `${baseSize}px`,
                height: `${baseSize}px`,
                borderColor: ringColor,
                boxShadow: isInCall ? `0 0 ${visualVolume * 30}px ${ringColor}` : 'none',
                transform: `scale(${scale})`
            }}
        >
             {/* Core Dot */}
            <div 
                className={`rounded-full bg-[#785ff9] transition-opacity duration-500 ${isIdle ? 'opacity-100' : 'opacity-0'}`}
                style={{ width: size * 0.04, height: size * 0.04 }}
            />
        </div>

        {/* Ripples for Active State */}
        {isInCall && (
             <>
                <div 
                    className="absolute border border-purple-500/30 rounded-full"
                    style={{
                        width: `${baseSize}px`,
                        height: `${baseSize}px`,
                        transform: `scale(${scale * 1.1})`,
                        transition: 'transform 0.15s ease-out'
                    }}
                />
                 <div 
                    className="absolute border border-purple-500/10 rounded-full"
                    style={{
                        width: `${baseSize}px`,
                        height: `${baseSize}px`,
                        transform: `scale(${scale * 1.3})`,
                        transition: 'transform 0.2s ease-out'
                    }}
                />
             </>
        )}
    </div>
  );
};

export default VoiceRing;