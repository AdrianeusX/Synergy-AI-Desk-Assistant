import React from 'react';
import { AppState } from '../types';

interface HeaderProps {
  appState: AppState;
  onEndCall: () => void;
}

const Header: React.FC<HeaderProps> = ({ appState, onEndCall }) => {
  const isInCall = appState === AppState.IN_CALL;
  const isConnecting = appState === AppState.CONNECTING;

  return (
    <header className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-4 lg:py-6 flex justify-between items-center z-50 bg-black border-b border-white/5 relative flex-shrink-0">
      {/* Branding - Image Only - Force Override */}
      <div className="flex items-center">
        <img 
            src="https://btggjmmaudjpexwvbpvg.supabase.co/storage/v1/object/public/AVautomation_assets/av-tech-logo.png" 
            alt="AV Tech Logo" 
            className="h-12 w-auto object-contain rounded-lg"
        />
      </div>

      {/* Navigation - Desktop */}
      <nav className="hidden md:flex items-center gap-8">
        {['Consultation', 'About Arman', 'Case Studies'].map((link) => (
            <a 
                key={link} 
                href="#" 
                className="text-sm text-slate-400 hover:text-white transition-colors duration-200 font-medium"
            >
                {link}
            </a>
        ))}
      </nav>

      {/* Primary CTA */}
      <div className="flex items-center">
          {isInCall || isConnecting ? (
            <button 
                onClick={isInCall ? onEndCall : undefined}
                disabled={isConnecting}
                className={`
                    px-6 py-2.5 rounded-full text-xs font-medium tracking-wide transition-all duration-300
                    ${isConnecting 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                        : 'bg-red-600/20 hover:bg-red-600/30 text-white shadow-inner border border-red-500/5'
                    }
                `}
            >
                {isConnecting ? 'CONNECTING...' : 'End Call'}
            </button>
          ) : (
            <button className="bg-white text-black hover:bg-gray-100 px-3 md:px-6 py-1 md:py-2.5 rounded-full text-[11px] md:text-xs font-bold tracking-wide transition-colors duration-200 shadow-lg whitespace-nowrap">
                Contact Synergy
            </button>
          )}
      </div>
    </header>
  );
};

export default Header;