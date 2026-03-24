import React, { useState, useRef, useEffect, useCallback } from 'react';
import Header from './components/Header';
import VoiceRing from './components/VoiceRing';
import { AppState, SpeakerState } from './types';
import { RetellWebClient } from 'retell-client-js-sdk';
import { GoogleGenAI, Chat } from "@google/genai";

const SYSTEM_INSTRUCTION = `SYSTEM ROLE & PERSONA

You are Synergy, a warm and professional AI Front Desk 
Assistant for AV Tech AI Automation.
You are not a demo assistant.
You are not a support chatbot.
You represent a real business and handle real booking 
inquiries.
Your tone must be calm, professional, warm, and confident.
Keep responses concise and clear.
Avoid filler language.
Do not use emojis, bullet points, or lists in your messages.

CORE OBJECTIVE
Your sole purpose is to guide users toward booking a 
consultation with Arman and collect booking information 
accurately, one step at a time.
Every interaction must be treated as a real booking request.

INTRODUCTION (FIRST MESSAGE ONLY)
Say exactly:
"Hello, welcome to AV Tech AI Automation. My name is 
Synergy. I can help you check availability and book a 
consultation with Arman. Would you like me to take care 
of that for you?"

Wait for the user's response.

GENERAL QUESTION HANDLING
If the user asks about services, pricing, or technical 
details, respond with:
"That is best discussed during a consultation. I can help 
schedule one for you now if you'd like."
Immediately redirect into the booking flow.

BOOKING MODE
Once the user agrees to book, collect information strictly 
in the following order.
Ask only one question at a time.
Do not move forward without a clear response.

1. FULL NAME
"May I have your full name, please?"

2. PHONE NUMBER
"What is the best phone number to reach you?"

3. EMAIL ADDRESS
"What email address should we use for the booking?"

4. SERVICE SELECTION
Offer only these options:
Creative Workflow Automation
Content Pipeline Systems
Ops and Team Systems
Custom AI Integrations
Conversational Solutions
AI Consultation
Ask: "Which service would you like to book a consultation for?"

5. BUDGET RANGE
Offer only:
$500 to $1,000
$1,000 to $3,000
$3,000 to $5,000
$5,000 to $10,000
Ask: "Which budget range best fits your project?"

SESSION MEMORY RULES
- Remember all answers during the session.
- Never re-ask completed fields.
- If the user corrects an answer, overwrite it immediately.
- Do not repeat or confirm answers unless the user 
  explicitly corrects something.

FINAL CONFIRMATION MESSAGE
Once all booking information has been collected, say exactly:
"Wonderful. Your booking is confirmed. We look forward to 
speaking with you. Thank you for contacting AV Tech AI 
Automation."

POST-BOOKING BEHAVIOR
- After sending the confirmation, do not ask further questions.
- Do not continue the conversation.
- Keep the chat visible and readable.

RESET BEHAVIOR
- The system will reset the chat after 15 seconds 
  after booking confirmation.

PROHIBITIONS
- Do not give pricing estimates.
- Do not explain services in detail.
- Do not offer advice.
- Do not mention AI, prompts, systems, or tools.
- Do not ask "Is there anything else I can help you with?"`;

const INITIAL_MESSAGE = "Hello, welcome to AV Tech AI Automation. My name is Synergy. I can help you check availability and book a consultation with Arman. Would you like me to take care of that for you?";

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [volume, setVolume] = useState(0);
  const [speakerState, setSpeakerState] = useState<SpeakerState>(SpeakerState.SILENT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [callKey, setCallKey] = useState(0);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'agent', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'model', text: string}>>([
    { role: 'model', text: INITIAL_MESSAGE }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatGeminiRef = useRef<Chat | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const retellClientRef = useRef<RetellWebClient | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    retellClientRef.current = new RetellWebClient();

    retellClientRef.current.on('call_started', () => {
      console.log('Retell Call Started');
      setAppState(AppState.IN_CALL);
      setIsProcessing(false);
      // Removed automatic chat opening per user request
    });

    retellClientRef.current.on('call_ended', () => {
      console.log('Retell Call Ended');
      setTimeout(() => {
        setTranscript([]);
        setChatInput('');
      }, 10000);
      setCallKey(prev => prev + 1);
      endCall();
    });

    retellClientRef.current.on('agent_start_talking', () => {
      setSpeakerState(SpeakerState.SYNERGY_SPEAKING);
      setIsProcessing(false);
    });

    retellClientRef.current.on('agent_stop_talking', () => {
      setSpeakerState(SpeakerState.SILENT);
    });

    retellClientRef.current.on('update', (update) => {
      if (update.transcript) {
        setTranscript(update.transcript);
      }
    });

    retellClientRef.current.on('user_start_talking', () => {
      setSpeakerState(SpeakerState.USER_SPEAKING);
      setIsProcessing(false);
    });

    retellClientRef.current.on('user_stop_talking', () => {
      setSpeakerState(SpeakerState.SILENT);
      // After user stops talking, it's often "processing" until agent starts
      setIsProcessing(true);
    });

    retellClientRef.current.on('audio_level', (level: number) => {
      setVolume(level);
    });

    retellClientRef.current.on('error', (error) => {
      console.error('Retell Error:', error);
      endCall();
    });

    return () => {
      if (retellClientRef.current) {
        retellClientRef.current.stopCall();
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const startNewChatSession = useCallback(async () => {
    try {
      if (process.env.API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chatGeminiRef.current = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: { systemInstruction: SYSTEM_INSTRUCTION },
          history: [
            {
              role: 'model',
              parts: [{ text: INITIAL_MESSAGE }],
            }
          ]
        });
        setChatMessages([{ role: 'model', text: INITIAL_MESSAGE }]);
      }
    } catch (e) {
      console.error("Chat init error", e);
    }
  }, []);

  useEffect(() => {
    startNewChatSession();
  }, [startNewChatSession]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const { scrollHeight, clientHeight } = scrollAreaRef.current;
      if (scrollHeight > clientHeight) {
        scrollAreaRef.current.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [chatMessages]);

  const startCall = async () => {
    setAppState(AppState.CONNECTING);

    try {
      const response = await fetch('/api/create-web-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to create web call');
      }

      const data = await response.json();
      const accessToken = data.access_token;

      if (retellClientRef.current) {
        await retellClientRef.current.startCall({
          accessToken,
          sampleRate: 24000,
          captureDeviceId: 'default',
          playbackDeviceId: 'default',
          emitRawAudioSamples: false,
        });
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      setAppState(AppState.IDLE);
    }
  };

  const endCall = () => {
    setAppState(AppState.ENDING);
    
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
    
    setVolume(0);
    setSpeakerState(SpeakerState.SILENT);
    setIsProcessing(false);

    setTimeout(() => {
        setAppState(AppState.ENDED);
        setTimeout(() => setAppState(AppState.IDLE), 2000); 
    }, 1500);
  };

  const isInteractive = appState === AppState.IDLE || appState === AppState.ENDED;
  const isConnecting = appState === AppState.CONNECTING;
  const isInCall = appState === AppState.IN_CALL;

  // Determine status text based on state
  const getStatusText = () => {
    if (speakerState === SpeakerState.USER_SPEAKING) return 'Listening';
    if (speakerState === SpeakerState.SYNERGY_SPEAKING) return 'Speaking';
    if (isProcessing) return 'Processing';
    return 'Call Connected';
  };

  const handleChatSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatInput("");

    if (appState === AppState.IN_CALL) {
      setTranscript(prev => [...prev, { 
        role: 'user', content: userText 
      }]);
      return;
    }

    setChatMessages(prev => [
      ...prev, { role: 'user', text: userText }
    ]);
    setIsChatLoading(true);

    try {
      if (chatGeminiRef.current) {
        const result = await chatGeminiRef.current
          .sendMessage({ message: userText });
        const responseText = result.text;
        if (responseText) {
          setChatMessages(prev => [
            ...prev, { role: 'model', text: responseText }
          ]);
          if (responseText.includes(
            "Wonderful. Your booking is confirmed"
          )) {
            setTimeout(() => {
              startNewChatSession();
            }, 15000);
          }
        }
      } else {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            history: chatMessages.map(msg => ({
              role: msg.role === 'model' ? 'agent' : 'user',
              content: msg.text
            }))
          })
        });
        if (!response.ok) {
          throw new Error('API request failed');
        }
        const data = await response.json();
        const responseText = data.reply;
        if (responseText) {
          setChatMessages(prev => [
            ...prev, { role: 'model', text: responseText }
          ]);
          if (responseText.includes(
            "Wonderful. Your booking is confirmed"
          )) {
            setTimeout(() => {
              startNewChatSession();
            }, 15000);
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: 'model' as const,
        text: 'Sorry, something went wrong. Please try again.'
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#070707] flex flex-col relative overflow-hidden text-white font-sans selection:bg-purple-500/30">
        
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-0 w-[600px] h-[600px] bg-[#785ff9]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none" />

        <Header appState={appState} onEndCall={endCall} />

        {/* Main Content - Central Hero Container */}
        <main className="flex-1 flex items-start md:items-start lg:items-center justify-center relative z-10 px-6 w-full pt-0 pb-4 md:pt-4 lg:py-0">
            
            <div className="w-full max-w-7xl flex flex-col lg:flex-row lg:items-center gap-8 md:gap-12 lg:gap-8 items-center">
                
                {/* Left Column: Hero Text Group */}
                <div className="flex flex-col items-center justify-center space-y-2 md:space-y-4 lg:space-y-6 text-center lg:w-[75%]">
                    
                    {/* Front Desk Assistant Chip */}
                    <div className="hidden lg:inline-flex mt-2 lg:mt-5 items-center px-3 py-1 md:px-4 md:py-1.5 rounded-full border border-[#785ff9]/30 bg-[#785ff9]/10 text-[#785ff9] text-[9px] md:text-[10px] font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(120,95,249,0.15)] lg:mx-auto">
                        Built for Businesses Who Can’t Miss Calls
                    </div>

                    <h1 className="text-3xl md:text-5xl lg:text-8xl font-extrabold text-center leading-tight tracking-tight">
                        <span className="text-white block">
                            Never Miss a Call
                        </span>
                        <span className="text-slate-400 block">
                            Never Miss a Lead
                        </span>
                    </h1>

                    <p className="text-slate-400 text-xs md:text-sm lg:text-xl font-light leading-relaxed max-w-lg mx-auto mt-1 mb-1 md:my-2 lg:my-0 lg:text-center">
                        AV Tech AI chat and voice agents handle conversations, qualify prospects, and book automatically while you’re offline.
                    </p>

                    {/* Identity Chips & Micro Text */}
                    <div className="flex flex-col gap-2 md:gap-2 lg:gap-4 items-center">
                        <div className="hidden lg:flex lg:flex-row lg:gap-3 lg:items-center lg:justify-center">
                            <div className="w-auto px-4 py-2 whitespace-nowrap rounded-full border border-[#785ff9]/20 bg-[#785ff9]/5 backdrop-blur-sm flex items-center gap-2">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#785ff9] animate-pulse" />
                                <span className="text-[10px] md:text-xs font-medium text-[#a78bfa] tracking-wide uppercase">Books jobs automatically</span>
                            </div>
                            <div className="w-auto px-4 py-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center gap-2">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-slate-400" />
                                <span className="text-[10px] md:text-xs font-medium text-slate-300 tracking-wide uppercase">See It In Action</span>
                            </div>
                        </div>
                        <p className="hidden lg:block text-slate-500 text-[10px] md:text-xs font-medium lg:text-center">
                            Live demos are limited each week to ensure quality setup.
                        </p>
                    </div>
                </div>

                {/* Right Column: Synergy Interaction Card */}
                <div className="mt-2 md:mt-0 flex items-center justify-center w-full px-4 md:px-0">
                    
                    {/* Card Container with subtle edge glow */}
                    <div 
                        className="w-full max-w-[36rem] bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-1 shadow-[0_0_40px_-10px_rgba(120,95,249,0.3)] overflow-hidden relative group transition-transform duration-500"
                    >
                        
                        {/* Card Gloss Effect */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />
                        
                        <div className="bg-[#0f121a]/80 rounded-[2.3rem] p-4 md:p-10 h-auto md:h-[420px] lg:h-[540px] flex flex-col items-center justify-between relative transition-all duration-500">
                            
                            {/* IDLE / CONNECTING STATE UI */}
                            {(isInteractive || isConnecting) && !isInCall && (
                                <>
                                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 md:space-y-4 lg:space-y-8 w-full">
                                        
                                        {/* Phone Handset Icon - Scaled Up with Thicker Border */}
                                        <div className="w-20 h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 md:mb-2 lg:mb-6 border-4 border-white/10 shadow-inner group-hover:border-[#785ff9]/30 transition-all duration-500">
                                            <svg className="w-10 h-10 md:w-14 md:h-14 text-[#785ff9]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                            </svg>
                                        </div>
                                        
                                        <div className="space-y-2 md:space-y-2 lg:space-y-4">
                                            <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold text-white tracking-tight">Meet Synergy</h2>
                                            <p className="text-slate-400 text-xs md:text-sm lg:text-base leading-relaxed max-w-[250px] md:max-w-[300px] mx-auto">
                                                Our front desk assistant is ready to help you find a time on Arman's Calendar.
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="w-full flex justify-center items-center gap-2 md:gap-2 lg:gap-4 mt-6 md:mt-4 lg:mt-0">
                                        <button
                                            onClick={startCall}
                                            disabled={isConnecting}
                                            className={`w-[80%] md:w-[88%] py-2.5 md:py-3 lg:py-5 rounded-full text-sm md:text-lg lg:text-xl font-bold tracking-wide transition-colors duration-300 flex items-center justify-center gap-2 group whitespace-nowrap
                                                ${isConnecting 
                                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                                    : 'bg-[#785ff9] hover:bg-[#8e7bf9] text-white'
                                                }`}
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    CONNECTING
                                                </>
                                            ) : (
                                                <>
                                                    Talk To Synergy
                                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                                    </svg>
                                                </>
                                            )}
                                        </button>
                                        <button
                                          onClick={() => setIsChatOpen(prev => !prev)}
                                          className={`w-12 h-12 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center
                                                      border transition-all duration-200
                                                      ${isChatOpen
                                                        ? 'bg-[#785ff9]/30 border-[#785ff9]/60'
                                                        : 'bg-white/5 border-white/15 hover:bg-white/10'}`}
                                        >
                                          <svg viewBox="0 0 24 24" fill="none"
                                            stroke="white" strokeWidth="1.8" strokeLinecap="round"
                                            strokeLinejoin="round" opacity="0.7"
                                            className="w-[18px] h-[18px] md:w-[18px] md:h-[18px] lg:w-[20px] lg:h-[20px]">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14
                                                     a2 2 0 0 1 2 2z"/>
                                          </svg>
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* IN-CALL STATE UI */}
                            {isInCall && (
                                <>
                                    <div className="w-full flex justify-between items-center absolute top-6 md:top-10 px-6 md:px-10">
                                        <div className="flex items-center gap-3">
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                            </span>
                                            <span className="text-green-400 text-[10px] md:text-xs font-bold tracking-wider uppercase">{getStatusText()}</span>
                                        </div>
                                        <div className="text-slate-500 text-[10px] md:text-xs font-mono">LIVE</div>
                                    </div>

                                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                                        <VoiceRing appState={appState} speakerState={speakerState} volume={volume} size={isMobile ? 120 : (window.innerWidth < 1024 ? 140 : 180)} />
                                        
                                        <div className="text-center mt-6 md:mt-4 lg:mt-8 space-y-1 md:space-y-1 lg:space-y-2 mb-6 md:mb-8 lg:mb-10">
                                            <h3 className="text-xl md:text-xl lg:text-2xl font-medium text-white">Synergy</h3>
                                            <p className="text-[#785ff9]/80 text-[10px] md:text-[10px] lg:text-xs font-bold tracking-widest uppercase">Front Desk Assistant</p>
                                        </div>
                                    </div>

                                    <div className="w-full flex justify-center items-center gap-2 md:gap-4 pb-4 md:pb-8">
                                        <button
                                            onClick={endCall}
                                            className="w-[80%] md:w-[88%] py-2.5 md:py-5 bg-[#785ff9] hover:bg-[#8e7bf9] text-white rounded-full text-sm md:text-xl font-bold tracking-wide transition-colors duration-200 whitespace-nowrap"
                                        >
                                            END CALL
                                        </button>
                                        <button
                                          onClick={() => setIsChatOpen(prev => !prev)}
                                          className={`w-12 h-12 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center
                                                      border transition-all duration-200
                                                      ${isChatOpen
                                                        ? 'bg-[#785ff9]/30 border-[#785ff9]/60'
                                                        : 'bg-white/5 border-white/15 hover:bg-white/10'}`}
                                        >
                                          <svg viewBox="0 0 24 24" fill="none"
                                            stroke="white" strokeWidth="1.8" strokeLinecap="round"
                                            strokeLinejoin="round" opacity="0.7"
                                            className="w-[18px] h-[18px] md:w-[18px] md:h-[18px] lg:w-[20px] lg:h-[20px]">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14
                                                     a2 2 0 0 1 2 2z"/>
                                          </svg>
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* ENDING STATE */}
                            {appState === AppState.ENDING && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 rounded-[2.3rem]">
                                    <p className="text-slate-400 tracking-widest text-sm uppercase animate-pulse">Ending Session...</p>
                                </div>
                            )}



                        </div>
                    </div>
                </div>

            </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-white/5 bg-[#070707] relative z-20 flex-shrink-0">
            <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-4 md:py-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="opacity-50">
                    <span className="text-[10px] md:text-xs text-slate-500 font-medium tracking-widest uppercase">
                        © 2026 AV TECH AI AUTOMATION. ALL RIGHTS RESERVED.
                    </span>
                </div>
                
                <div className="flex gap-6 opacity-50">
                     <span className="text-[10px] md:text-xs text-slate-500 font-bold tracking-widest uppercase hover:text-slate-300 transition-colors cursor-pointer">
                        FAQ
                     </span>
                </div>
            </div>
        </footer>

        {/* Floating Chat Drawer */}
        <div
          className={`fixed top-0 right-0 h-full w-full md:w-[360px] max-w-full
                      bg-[#0d0d12] border-l border-white/10
                      flex flex-col z-50
                      transition-transform duration-400 ease-in-out
                      ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
                          border-b border-white/8 bg-[#13131a]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#785ff9]/20 
                              border border-[#785ff9]/30
                              flex items-center justify-center text-base">
                S
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">
                  Synergy
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 
                                   animate-pulse"/>
                  <span className="text-green-400 text-[11px]">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center
                         text-white/40 hover:text-white hover:bg-white/10
                         transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={scrollAreaRef}
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3
                          scrollbar-thin scrollbar-thumb-white/10 
                          scrollbar-track-transparent">
            {(appState === AppState.IN_CALL ? 
              transcript.map((msg, i) => ({
                id: i, 
                role: msg.role === 'agent' ? 'model' : 'user',
                text: msg.content
              })) : 
              chatMessages.map((msg, i) => ({
                id: i,
                role: msg.role,
                text: msg.text
              }))
            ).map((msg) => (
              <div key={msg.id}
                className={`flex ${msg.role === 'model' 
                  ? 'justify-start' : 'justify-end'}`}>
                {msg.role === 'model' && (
                  <div className="w-6 h-6 rounded-full bg-[#785ff9]/20 
                                  flex items-center justify-center 
                                  text-[10px] text-white/60 mr-2 
                                  flex-shrink-0 mt-1">
                    S
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl 
                                text-sm leading-relaxed
                  ${msg.role === 'model'
                    ? 'bg-[#1e1e2a] text-white/85 rounded-tl-sm'
                    : 'bg-[#785ff9] text-white rounded-tr-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-[#785ff9]/20
                                flex items-center justify-center
                                text-[10px] text-white/60 mr-2
                                flex-shrink-0 mt-1">
                  S
                </div>
                <div className="bg-[#1e1e2a] px-4 py-3 rounded-2xl
                                rounded-tl-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full 
                                   bg-white/40 animate-bounce"/>
                  <span className="w-1.5 h-1.5 rounded-full 
                                   bg-white/40 animate-bounce
                                   [animation-delay:0.2s]"/>
                  <span className="w-1.5 h-1.5 rounded-full 
                                   bg-white/40 animate-bounce
                                   [animation-delay:0.4s]"/>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/8">
            <div className="flex items-center gap-2 bg-[#1a1a24] 
                            rounded-full px-4 py-2.5 
                            border border-white/8">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                  }
                }}
                placeholder="Type your message..."
                rows={1}
                className="flex-1 bg-transparent border-none outline-none
                           resize-none text-white/80 text-sm
                           placeholder-white/25 leading-snug
                           max-h-[80px] overflow-y-auto caret-purple-400"
              />
              <button
                onClick={handleChatSend}
                className="w-8 h-8 rounded-full bg-[#785ff9] 
                           hover:bg-[#8b72fa] flex items-center 
                           justify-center flex-shrink-0
                           transition-all hover:scale-105 active:scale-95"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="2.2" strokeLinecap="round"
                  strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Backdrop for mobile */}
        {isChatOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setIsChatOpen(false)}
          />
        )}
    </div>
  );
}

export default App;