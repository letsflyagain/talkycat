"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  messageEn: string;
  messageKo: string;
  suggestedReplies?: string[];
  silentCorrection?: string | null;
}

export default function FreeTalkPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("사용자");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [anchorTopic, setAnchorTopic] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [statusText, setStatusText] = useState("토키캣과 대화 준비 중 🐾");
  const [showKorean, setShowKorean] = useState(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState<string | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestTranscriptRef = useRef<string>("");
  const wakeLockRef = useRef<any>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const anchorTopicRef = useRef<string | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const [isSpeakingState, setIsSpeakingState] = useState(false);

  // Keep refs in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    anchorTopicRef.current = anchorTopic;
  }, [anchorTopic]);

  // Load nickname
  useEffect(() => {
    try {
      const saved = localStorage.getItem("talkycat_nickname");
      if (saved) setNickname(saved);
    } catch (e) {
      console.warn("Failed to load nickname", e);
    }
  }, []);

  // Screen Wake Lock
  useEffect(() => {
    let isMounted = true;
    const requestWakeLock = async () => {
      if (typeof window !== "undefined" && "wakeLock" in navigator && typeof (navigator as any).wakeLock.request === "function") {
        try {
          const lock = await (navigator as any).wakeLock.request("screen");
          if (isMounted) {
            wakeLockRef.current = lock;
            lock.addEventListener("release", () => {
              wakeLockRef.current = null;
            });
          } else {
            lock.release().catch(() => {});
          }
        } catch (err) {
          console.warn("Wake Lock failed:", err);
        }
      }
    };
    requestWakeLock();

    return () => {
      isMounted = false;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const kickstartAudioHardware = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn("AudioContext unlock failed:", e);
    }
  };

  const clearWatchdog = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  };

  const setWatchdog = (onTimeout: () => void, ms = 6000) => {
    clearWatchdog();
    watchdogTimerRef.current = setTimeout(() => {
      onTimeout();
    }, ms);
  };

  const teardownSTT = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch {}
    }
    isRecognizingRef.current = false;
    setIsListening(false);
  }, []);

  const startListeningImmediate = useCallback(() => {
    if (isSpeakingRef.current) return;
    if (isRecognizingRef.current) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch {}

      try {
        recognitionRef.current.start();
        isRecognizingRef.current = true;
        setIsListening(true);
        setStatusText("말씀하세요 🎙️ (탭하여 음소거)");
      } catch (e) {
        console.warn("Recognition start error:", e);
        isRecognizingRef.current = false;
        setIsListening(false);
      }
    }
  }, []);

  // Utility to purge emojis and markdown symbols before feeding into TTS
  const cleanTextForTTS = (text: string) => {
    return text
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[*_~`]/g, '')
      .trim();
  };

  const speakText = useCallback((text: string, rate: number = 1.0, onEnded?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      isSpeakingRef.current = false;
      setIsSpeakingState(false);
      if (onEnded) onEnded();
      return;
    }

    teardownSTT();
    window.speechSynthesis.cancel();
    isSpeakingRef.current = true;
    setIsSpeakingState(true);

    const cleaned = cleanTextForTTS(text);
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "en-US";
    utterance.rate = rate;

    const handleFinish = () => {
      isSpeakingRef.current = false;
      setIsSpeakingState(false);
      setTimeout(() => {
        if (onEnded) onEnded();
      }, 300);
    };

    utterance.onend = handleFinish;
    utterance.onerror = handleFinish;

    window.speechSynthesis.speak(utterance);
  }, [teardownSTT]);

  const sendUserMessageToAPI = useCallback(async (text: string, isResetCall: boolean = false) => {
    const trimmed = text.trim();
    // Noise filter: ignore if <= 2 characters or noise (unless it's a reset call)
    if (!isResetCall && (!trimmed || trimmed.length <= 2)) {
      setRecognizedText("");
      latestTranscriptRef.current = "";
      startListeningImmediate();
      return;
    }

    teardownSTT();
    setIsThinking(true);
    setStatusText("토키캣이 생각 중이다냥... 🐾");

    // Watchdog timer (6 seconds)
    setWatchdog(() => {
      console.warn("Watchdog triggered: freeing frozen state");
      setIsThinking(false);
      setStatusText("토키캣이 잠시 쉬고 있다냥. 다시 말해보세요! 🐾");
      startListeningImmediate();
    }, 6000);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      messageEn: trimmed,
      messageKo: "(사용자 발화)"
    };

    const updatedMessages = isResetCall ? [] : [...messagesRef.current, userMsg];
    if (!isResetCall) {
      setMessages(updatedMessages);
    }
    setRecognizedText("");
    latestTranscriptRef.current = "";

    try {
      const historyPayload = updatedMessages.map((m) => ({
        role: m.role,
        text: m.messageEn
      }));

      const res = await fetch("/api/free-talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: historyPayload,
          userMessage: trimmed,
          anchorTopic: anchorTopicRef.current,
          isReset: isResetCall
        })
      });
      const data = await res.json();

      clearWatchdog();
      setIsThinking(false);

      if (data.success) {
        if (!anchorTopicRef.current && data.extractedTopic) {
          setAnchorTopic(data.extractedTopic);
        }

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          messageEn: data.messageEn,
          messageKo: data.messageKo,
          suggestedReplies: data.suggestedReplies || [],
          silentCorrection: data.silentCorrection || null
        };

        const finalMessages = isResetCall ? [assistantMsg] : [...updatedMessages, assistantMsg];
        setMessages(finalMessages);
        setStatusText("토키캣이 말하고 있어요냥! 🐱");

        speakText(data.messageEn, 1.0, () => {
          setStatusText("말씀하세요 🎙️ (탭하여 음소거)");
          startListeningImmediate();
        });
      } else {
        throw new Error("API failed");
      }
    } catch (e) {
      clearWatchdog();
      console.error("Free-talk API error:", e);
      setIsThinking(false);
      setStatusText("통신 중 오류가 발생했다냥. 다시 시도해줘! 🐾");
      showToast("응답을 불러오지 못했습니다.");
      startListeningImmediate();
    }
  }, [speakText, teardownSTT, startListeningImmediate]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        if (isSpeakingRef.current) return;
        let interim = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }

        const currentTranscript = finalTranscript || interim || latestTranscriptRef.current;
        latestTranscriptRef.current = currentTranscript;
        setRecognizedText(currentTranscript);

        // 2.5 seconds silence debounce for free-talk
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (isRecognizingRef.current && currentTranscript && !isSpeakingRef.current) {
            sendUserMessageToAPI(currentTranscript);
          }
        }, 2500);

        if (finalTranscript) {
          sendUserMessageToAPI(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error", event.error);
        if (event.error === "no-speech") {
          setStatusText("다시 편하게 말해보라냥! 🐾");
        }
        isRecognizingRef.current = false;
        setIsListening(false);
      };

      recognition.onend = () => {
        isRecognizingRef.current = false;
        if (!isSpeakingRef.current && isListening) {
          setTimeout(() => {
            if (!isRecognizingRef.current && !isSpeakingRef.current && isListening) {
              try {
                recognition.start();
                isRecognizingRef.current = true;
              } catch {}
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isListening, sendUserMessageToAPI]);

  // Initial Entry: First API call on mount
  useEffect(() => {
    let isMounted = true;
    kickstartAudioHardware();

    const initConversation = async () => {
      setIsThinking(true);
      setStatusText("토키캣과 연결 중이다냥... 🐾");
      setWatchdog(() => {
        if (!isMounted) return;
        setIsThinking(false);
        setStatusText("토키캣과 연결 시간이 초과되었습니다. 다시 시도해줘! 🐾");
      }, 6000);

      try {
        const res = await fetch("/api/free-talk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history: [], userMessage: "", anchorTopic: null })
        });
        const data = await res.json();
        clearWatchdog();
        if (!isMounted) return;
        setIsThinking(false);

        if (data.success) {
          if (data.extractedTopic) {
            setAnchorTopic(data.extractedTopic);
          }

          const initialMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "assistant",
            messageEn: data.messageEn,
            messageKo: data.messageKo,
            suggestedReplies: data.suggestedReplies || [],
            silentCorrection: null
          };
          setMessages([initialMsg]);
          setStatusText("토키캣이 말하고 있어요냥! 🐱");

          speakText(data.messageEn, 1.0, () => {
            if (isMounted) {
              setStatusText("말씀하세요 🎙️ (탭하여 음소거)");
              startListeningImmediate();
            }
          });
        }
      } catch (e) {
        clearWatchdog();
        console.error("Initialization error:", e);
        if (isMounted) {
          setIsThinking(false);
          const fallbackMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "assistant",
            messageEn: "Hi there! What topic would you like to talk about today?",
            messageKo: "안녕! 오늘 어떤 주제로 이야기해볼까?",
            suggestedReplies: ["I want to talk about my weekend plans.", "Let's talk about hobbies!"],
            silentCorrection: null
          };
          setMessages([fallbackMsg]);
          speakText(fallbackMsg.messageEn, 1.0, () => {
            if (isMounted) startListeningImmediate();
          });
        }
      }
    };

    initConversation();

    return () => {
      isMounted = false;
      clearWatchdog();
      teardownSTT();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speakText, teardownSTT, startListeningImmediate]);

  // 4-State Microphone Button Handler
  const handleMainMicClick = () => {
    if (isThinking || isSpeakingState) return;

    if (isListening && recognizedText.trim().length > 0) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      sendUserMessageToAPI(recognizedText);
      return;
    }

    if (isListening) {
      teardownSTT();
      setStatusText("음성 인식이 일시중지되었습니다 🐾");
      showToast("마이크가 일시정지되었습니다.");
      return;
    }

    startListeningImmediate();
    showToast("마이크가 켜졌습니다. 말씀해 보세요!");
  };

  const handleSuggestedClick = (reply: string) => {
    sendUserMessageToAPI(reply);
  };

  const openCorrectionModal = (correction: string) => {
    setSelectedCorrection(correction);
    setIsCorrectionModalOpen(true);
  };

  // Action handlers for auxiliary buttons
  const handleSlowReplay = () => {
    const latest = [...messages].reverse().find(m => m.role === "assistant");
    if (latest) {
      speakText(latest.messageEn, 0.8, () => {
        startListeningImmediate();
      });
      showToast("0.8배속으로 또박또박 재생합니다 🐾");
    }
  };

  const handleSimpleExplanation = () => {
    sendUserMessageToAPI("Could you explain this in much simpler English and simpler words, please?");
  };

  const handleResetConversation = () => {
    teardownSTT();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    showToast(`현재 주제('${anchorTopic || "새로운 대화"}')로 첫 질문부터 다시 시작한다냥! 🐾`);
    sendUserMessageToAPI("Let's restart conversation on this topic.", true);
  };

  // Get current active assistant message
  const latestAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const currentSuggestedReplies = latestAssistantMsg?.suggestedReplies || [];

  // Determine mic button icon, label, style based on 4-state machine
  const getMicButtonState = () => {
    if (isThinking || isSpeakingState) {
      return {
        icon: "progress_activity",
        isSpinning: true,
        bgStyle: "bg-[#004ac6] opacity-60 cursor-not-allowed shadow-none",
        label: "토키캣 말하는 중... 🐾"
      };
    }
    if (isListening && recognizedText.trim().length > 0) {
      return {
        icon: "send",
        isSpinning: false,
        bgStyle: "bg-emerald-600 animate-pulse shadow-lg shadow-emerald-600/30",
        label: "탭하여 바로 전송 🚀"
      };
    }
    if (isListening) {
      return {
        icon: "mic",
        isSpinning: false,
        bgStyle: "bg-emerald-600 animate-pulse shadow-md shadow-emerald-600/30",
        label: "말씀하세요 🎙️ (탭하여 음소거)"
      };
    }
    return {
      icon: "mic_off",
      isSpinning: false,
      bgStyle: "bg-slate-200 text-slate-600 shadow-sm hover:bg-slate-300",
      label: "탭하여 말하기 🎤"
    };
  };

  const micState = getMicButtonState();

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col items-center justify-start relative select-none">
      {/* Toast Notification */}
      <div
        className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-[#131b2e]/90 text-[#faf8ff] rounded-full shadow-xl transition-all duration-300 flex items-center gap-2 ${
          toastVisible ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-2"
        }`}
      >
        <span className="material-symbols-outlined text-[#6ffbbe] text-[18px]">check_circle</span>
        <span className="font-label-sm text-xs">{toastMessage}</span>
      </div>

      {/* TalkyRoom Style Mobile View Container */}
      <div className="w-full max-w-[480px] h-screen bg-white relative shadow-xl border-x border-[#eaedff]/60 flex flex-col justify-between overflow-hidden">

        {/* 1. Top Header */}
        <header className="w-full z-40 pt-safe bg-[#faf8ff]/90 backdrop-blur-md border-b border-[#eaedff]">
          <div className="h-16 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="w-10 h-10 rounded-full bg-[#eaedff] hover:bg-[#e2e7ff] text-[#131b2e] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                onClick={() => {
                  clearWatchdog();
                  teardownSTT();
                  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
                  router.replace("/");
                }}
                type="button"
                aria-label="메인으로 돌아가기"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-[#dbe1ff] flex items-center justify-center">
                <Image src="/talkycat-s.png" alt="TalkyCat" width={32} height={32} className="w-full h-full object-cover" />
              </div>
              <h1 className="font-headline-sm text-sm font-bold text-[#131b2e] truncate max-w-[120px]">
                FreeTalk
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#004ac6] font-label-sm text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                onClick={() => setIsHistoryModalOpen(true)}
                type="button"
                aria-label="대화 기록 보기"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>기록</span>
              </button>
              <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#e2e7ff] text-[#131b2e] font-label-sm text-xs shadow-sm">
                <span>{nickname}님</span>
              </div>
            </div>
          </div>
        </header>

        {/* 2. Central Single Focus Card Area */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-2 relative overflow-y-auto bg-gradient-to-b from-[#dbe1ff]/15 via-white to-[#f2f3ff]/30 pb-44">
          {/* Status Pill */}
          <div className="mb-2 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white shadow-md border border-[#eaedff]">
            <span className="material-symbols-outlined text-[#004ac6] text-[16px] animate-bounce">graphic_eq</span>
            <span className="font-label-sm text-xs text-[#004ac6] font-bold">{statusText}</span>
          </div>

          {/* Top Topic Banner with Reset Button */}
          <div className="w-full max-w-md bg-white/90 backdrop-blur-md border border-amber-200/80 rounded-2xl px-4 py-2.5 shadow-sm mx-4 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <span className="text-sm">📌</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-[#737686] font-bold">대화 주제</span>
                <span className="text-[#004ac6] font-bold text-xs truncate max-w-[170px]">
                  {anchorTopic || "자유롭게 이야기 중 🐾"}
                </span>
              </div>
            </div>
            <button
              className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
              onClick={handleResetConversation}
              type="button"
            >
              <span>🔄 처음부터 다시</span>
            </button>
          </div>

          {/* Character Avatar with Pulsing Aura Rings */}
          <div className="relative flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44 mb-4">
            <div className={`absolute inset-0 rounded-full bg-[#2563eb]/20 animate-ping ${isThinking || isSpeakingState ? "opacity-90" : "opacity-40"}`}></div>
            <div className="absolute -inset-2 rounded-full bg-[#004ac6]/10 animate-pulse"></div>
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden shadow-xl bg-white p-2 flex items-center justify-center border-2 border-[#dbe1ff]">
              <Image
                src="/talkycat-m.png"
                alt="TalkyCat Avatar"
                width={160}
                height={160}
                className="w-full h-full object-cover select-none pointer-events-none transform transition-transform duration-300"
                priority
              />
            </div>
          </div>

          {/* Central Focus Card */}
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-lg border border-[#eaedff] flex flex-col gap-3 relative transition-all duration-300">
            {/* Speaker Badge */}
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-1 rounded-full font-label-sm text-[11px] font-bold ${isListening ? "bg-emerald-100 text-emerald-800" : "bg-[#dbe1ff] text-[#00174b]"}`}>
                {isListening ? "나 🎤 (마이크 켜짐)" : "토키캣 🐾"}
              </span>
              <button
                className="w-8 h-8 rounded-full bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#004ac6] flex items-center justify-center transition-colors cursor-pointer active:scale-95 shadow-sm"
                onClick={() => {
                  if (latestAssistantMsg) speakText(latestAssistantMsg.messageEn, 1.0, () => startListeningImmediate());
                }}
                title="다시 듣기"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">volume_up</span>
              </button>
            </div>

            {/* English Utterance */}
            <p className="font-headline-sm text-lg sm:text-xl font-bold text-[#131b2e] leading-snug text-center">
              {isThinking ? "Thinking of a warm reply..." : latestAssistantMsg ? latestAssistantMsg.messageEn : "Loading..."}
            </p>

            {/* Korean Translation */}
            {showKorean && (
              <p className="font-body-sm text-xs text-[#434655] text-center border-t border-[#eaedff]/60 pt-2">
                {isThinking ? "토키캣이 답변을 준비 중입니다." : latestAssistantMsg ? latestAssistantMsg.messageKo : ""}
              </p>
            )}

            {/* Silent Correction Chip if available */}
            {latestAssistantMsg?.silentCorrection && (
              <button
                className="self-center mt-1 flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all text-xs font-semibold shadow-sm cursor-pointer"
                onClick={() => openCorrectionModal(latestAssistantMsg.silentCorrection!)}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px] text-amber-500 fill-1">lightbulb</span>
                <span>💡 토키캣의 귓속말 팁 보기</span>
              </button>
            )}
          </div>

          {/* Real-time STT Live Feedback or Thinking Indicator */}
          <div className="mt-4 w-full max-w-md flex flex-col items-center">
            {isThinking ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#004ac6]/10 text-[#004ac6] text-xs font-semibold animate-pulse">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span>토키캣이 생각 중이다냥... 🐾</span>
              </div>
            ) : isListening && recognizedText ? (
              <div className="w-full bg-[#004ac6]/10 border border-[#004ac6]/30 text-[#004ac6] rounded-2xl px-4 py-2.5 text-center text-xs font-medium shadow-sm animate-fade-in">
                &ldquo;{recognizedText}&rdquo; <span className="text-[10px] opacity-75">(인식 중...)</span>
              </div>
            ) : null}
          </div>
        </main>

        {/* 3. Unified Bottom Footer (Suggested Replies + Auxiliary 3 Quick Buttons + Main 3 Control Buttons) */}
        <footer className="absolute bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#eaedff] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] p-3 pb-safe flex flex-col gap-2.5">
          {/* Suggested Replies Chips (When available and not thinking) */}
          {currentSuggestedReplies.length > 0 && !isThinking && !isSpeakingState && (
            <div className="flex flex-wrap justify-center gap-1.5 w-full">
              {currentSuggestedReplies.map((reply, idx) => (
                <button
                  key={idx}
                  className="px-3 py-1.5 rounded-full bg-[#f2f3ff] border border-[#004ac6]/30 text-[#004ac6] hover:bg-[#004ac6] hover:text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                  onClick={() => handleSuggestedClick(reply)}
                  type="button"
                >
                  <span>💬 {reply}</span>
                </button>
              ))}
            </div>
          )}

          {/* Auxiliary Quick Buttons Row (3 columns: 천천히, 쉽게 설명, 대화 리셋) */}
          <div className="w-full max-w-[480px] mx-auto grid grid-cols-3 gap-1.5">
            <button
              className="h-10 px-2 rounded-xl bg-white border border-[#c3c6d7]/60 shadow-sm flex items-center justify-center gap-1 text-[#131b2e] hover:bg-[#f2f3ff] active:scale-95 transition-all cursor-pointer"
              onClick={handleSlowReplay}
              type="button"
            >
              <span className="text-xs">🐢</span>
              <span className="font-label-sm text-[11px] font-semibold truncate">천천히</span>
            </button>
            <button
              className="h-10 px-2 rounded-xl bg-white border border-[#c3c6d7]/60 shadow-sm flex items-center justify-center gap-1 text-[#131b2e] hover:bg-[#f2f3ff] active:scale-95 transition-all cursor-pointer"
              onClick={handleSimpleExplanation}
              type="button"
            >
              <span className="text-xs">💡</span>
              <span className="font-label-sm text-[11px] font-semibold truncate">쉽게 설명</span>
            </button>
            <button
              className="h-10 px-2 rounded-xl bg-amber-50 border border-amber-300/80 shadow-sm flex items-center justify-center gap-1 text-amber-900 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer font-bold"
              onClick={handleResetConversation}
              type="button"
            >
              <span className="text-xs">🔄</span>
              <span className="font-label-sm text-[11px] truncate">대화 리셋</span>
            </button>
          </div>

          {/* Main Control Deck (Left: Replay, Center: Revamped 4-State Mic Button, Right: End Call) */}
          <div className="w-full max-w-[480px] mx-auto flex items-center justify-around px-6 py-2.5 rounded-2xl bg-[#f2f3ff]/80 border border-[#eaedff] shadow-sm">
            <div className="flex flex-col items-center">
              <button
                className="w-12 h-12 rounded-full bg-white text-[#004ac6] flex items-center justify-center hover:bg-[#e2e7ff] active:scale-90 transition shadow-sm cursor-pointer"
                onClick={() => {
                  if (latestAssistantMsg) speakText(latestAssistantMsg.messageEn, 1.0, () => startListeningImmediate());
                }}
                type="button"
                aria-label="다시듣기"
              >
                <span className="material-symbols-outlined text-[22px]">replay</span>
              </button>
              <span className="font-label-sm text-[10px] text-[#434655] mt-1 font-bold">다시듣기</span>
            </div>

            {/* Revamped Center Microphone Button with State Machine */}
            <div className="flex flex-col items-center">
              <button
                className={`w-16 h-16 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer ${micState.bgStyle}`}
                onClick={handleMainMicClick}
                type="button"
                aria-label="마이크 제어 및 전송"
                disabled={isThinking || isSpeakingState}
              >
                <span className={`material-symbols-outlined text-[28px] ${micState.isSpinning ? "animate-spin" : ""}`}>
                  {micState.icon}
                </span>
              </button>
              <span className="font-label-sm text-[10px] text-[#004ac6] font-semibold mt-1 whitespace-nowrap">
                {micState.label}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <button
                className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#93000a] flex items-center justify-center hover:bg-[#ba1a1a] hover:text-white active:scale-90 transition shadow-sm cursor-pointer"
                onClick={() => {
                  clearWatchdog();
                  teardownSTT();
                  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
                  router.replace("/");
                }}
                type="button"
                aria-label="통화 종료"
              >
                <span className="material-symbols-outlined text-[22px]">call_end</span>
              </button>
              <span className="font-label-sm text-[10px] text-[#93000a] font-semibold mt-1">종료</span>
            </div>
          </div>
        </footer>

      </div>

      {/* 📜 대화 기록 (History) Modal Sheet */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-t-[28px] p-6 shadow-2xl flex flex-col gap-4 max-h-[80vh] overflow-hidden">
            <div className="w-10 h-1.5 rounded-full bg-[#c3c6d7] mx-auto mb-1"></div>
            <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004ac6]">history</span>
                <h3 className="font-headline-md text-base font-bold text-[#131b2e]">📜 프리토킹 대화 기록</h3>
              </div>
              <button
                className="w-8 h-8 rounded-full bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#434655] flex items-center justify-center transition-colors cursor-pointer active:scale-90"
                onClick={() => setIsHistoryModalOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 py-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col p-3 rounded-2xl ${m.role === "assistant" ? "bg-[#f2f3ff] border border-[#eaedff]" : "bg-[#004ac6]/10 border border-[#004ac6]/20 self-end w-[90%]"}`}>
                  <span className="text-[10px] font-bold text-[#004ac6] mb-1">
                    {m.role === "assistant" ? "TalkyCat 🐾" : `${nickname} 🎤`}
                  </span>
                  <p className="font-headline-sm text-sm text-[#131b2e]">{m.messageEn}</p>
                  <p className="font-body-sm text-xs text-[#434655] mt-0.5">{m.messageKo}</p>
                </div>
              ))}
            </div>
            <button
              className="w-full py-3 rounded-full bg-[#004ac6] text-white font-label-lg text-sm shadow-md hover:bg-[#2563eb] transition-all cursor-pointer active:scale-95"
              onClick={() => setIsHistoryModalOpen(false)}
              type="button"
            >
              닫기 🐾
            </button>
          </div>
        </div>
      )}

      {/* Silent Correction Modal / Popover */}
      {isCorrectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl shadow-sm">
                💡
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline-sm text-base font-bold text-[#131b2e]">토키캣의 귓속말 코칭</h3>
                <span className="text-xs text-[#737686]">더 자연스러운 표현 팁이다냥! 🐾</span>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-[#131b2e] text-sm leading-relaxed">
              {selectedCorrection}
            </div>
            <button
              className="w-full py-3 rounded-full bg-[#004ac6] text-white font-label-lg text-sm shadow-md hover:bg-[#2563eb] transition-all cursor-pointer active:scale-95"
              onClick={() => setIsCorrectionModalOpen(false)}
              type="button"
            >
              확인했다냥! 🐾
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
