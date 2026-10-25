"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserLevel } from "@/types/script";
import NicknameModal from "@/components/NicknameModal";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  messageEn: string;
  messageKo: string;
  suggestedReplies?: string[];
  silentCorrection?: string | null;
}

interface FeedbackItem {
  id: string;
  originalText: string;
  hasError: boolean;
  correctedText: string;
  naturalExpression: string;
  koreanTip: string;
}

interface BookmarkedExpression {
  id: string;
  expression: string;
  meaning?: string;
  originalContext: string;
  createdAt: string;
}

type TurnStatus = "SYSTEM_SPEAKING" | "PREPARING" | "USER_LISTENING" | "WAITING_START_TOUCH";

// Sentence splitter helper for chunked TTS playback without GC cutoffs
export function splitTextIntoSentences(text: string): string[] {
  const matched = text.match(/[^.!?\n]+[.!?\n]+(\s|$)|[^.!?\n]+$/g);
  return matched ? matched.map((s) => s.trim()).filter(Boolean) : [text];
}

// Browser voice loading helper with voiceschanged wait
export const getValidVoice = (): Promise<SpeechSynthesisVoice | null> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return resolve(null);
    }
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const enVoice = voices.find((v) => v.lang.startsWith('en')) || voices[0];
      return resolve(enVoice);
    }
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find((v) => v.lang.startsWith('en')) || voices[0];
      resolve(enVoice);
    };
  });
};

export default function FreeTalkPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("사용자");
  const [userLevel, setUserLevel] = useState<UserLevel>("A1");
  const [streakGoal, setStreakGoal] = useState(7);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [anchorTopic, setAnchorTopic] = useState<string | null>(null);

  // Turn State Machine
  const [turnStatus, setTurnStatus] = useState<TurnStatus>("SYSTEM_SPEAKING");

  const [recognizedText, setRecognizedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [statusText, setStatusText] = useState("토키캣과 대화 준비 중 🐾");
  const [showKorean, setShowKorean] = useState(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState<string | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Review & Bookmark System States
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [typedReviewText, setTypedReviewText] = useState("");
  const [isReviewPaused, setIsReviewPaused] = useState(false);
  const [reviewSpeed, setReviewSpeed] = useState<number>(1.0);
  const [isReviewFinished, setIsReviewFinished] = useState(false);
  const [reviewRestartKey, setReviewRestartKey] = useState(0);
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});
  const [bookmarkedItems, setBookmarkedItems] = useState<BookmarkedExpression[]>([]);
  
  // Feedback Report Modal States
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [feedbackReportList, setFeedbackReportList] = useState<FeedbackItem[]>([]);

  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [exitActionType, setExitActionType] = useState<"back" | "reset">("back");

  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reviewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const latestTranscriptRef = useRef<string>("");
  const wakeLockRef = useRef<any>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const anchorTopicRef = useRef<string | null>(null);
  const userLevelRef = useRef<UserLevel>("A1");
  const reviewScrollRef = useRef<HTMLDivElement>(null);

  // Ironclad Guards against infinite loops and 429 quota exhaustion
  const isProcessingRef = useRef<boolean>(false);
  const lastCallTimeRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);

  // Keep refs in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    anchorTopicRef.current = anchorTopic;
  }, [anchorTopic]);

  useEffect(() => {
    userLevelRef.current = userLevel;
  }, [userLevel]);

  // Load profile and bookmarks from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("talkycat_nickname");
      if (saved) setNickname(saved);
      const savedLevel = localStorage.getItem("talkycat_user_level") as UserLevel;
      if (savedLevel) {
        setUserLevel(savedLevel);
        userLevelRef.current = savedLevel;
      }
      const savedGoal = localStorage.getItem("talkycat_streak_goal");
      if (savedGoal) setStreakGoal(Number(savedGoal));

      const savedBookmarks = localStorage.getItem("talkycat_bookmarked_expressions");
      if (savedBookmarks) {
        const parsed: BookmarkedExpression[] = JSON.parse(savedBookmarks);
        if (Array.isArray(parsed)) {
          setBookmarkedItems(parsed);
          const map: Record<string, boolean> = {};
          parsed.forEach((b) => {
            map[b.expression] = true;
          });
          setBookmarkedMap(map);
        }
      }
    } catch (e) {
      console.warn("Failed to load profile or bookmarks", e);
    }
  }, []);

  const handleSaveProfile = (newNickname: string, newGoal: number, newLevel: UserLevel) => {
    setNickname(newNickname);
    setStreakGoal(newGoal);
    setUserLevel(newLevel);
    userLevelRef.current = newLevel;
    try {
      localStorage.setItem("talkycat_nickname", newNickname);
      localStorage.setItem("talkycat_streak_goal", newGoal.toString());
      localStorage.setItem("talkycat_user_level", newLevel);
    } catch (e) {
      console.error("Failed to save profile", e);
    }
  };

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
      if (ctx.state === "suspended") {
        ctx.resume();
      }
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

  const setWatchdog = (onTimeout: () => void, ms = 8000) => {
    clearWatchdog();
    watchdogTimerRef.current = setTimeout(() => {
      onTimeout();
    }, ms);
  };

  const clearReviewTimer = () => {
    if (reviewTimerRef.current) {
      clearTimeout(reviewTimerRef.current);
      reviewTimerRef.current = null;
    }
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
  }, []);

  // Handle Speech Result with strict Self-Echo & Noise Guard
  const handleSpeechResult = useCallback((transcript: string) => {
    if (turnStatus === "SYSTEM_SPEAKING" || turnStatus === "WAITING_START_TOUCH") {
      console.log("[셀프 에코 가드] 시스템 발화 중 또는 대기 중 인식된 입력 무시:", transcript);
      return;
    }

    const cleaned = transcript.trim();

    if (!cleaned || cleaned.length < 3) {
      return;
    }

    const lastMsg = messagesRef.current[messagesRef.current.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.messageEn.toLowerCase().includes(cleaned.toLowerCase())) {
      console.log('[셀프 에코 가드] 시스템 에코로 감지되어 입력을 무시합니다:', cleaned);
      return;
    }

    teardownSTT();
    sendUserMessageToAPI(cleaned);
  }, [turnStatus, teardownSTT]);

  // Clean STT Instance Factory & Launcher (Zombie Instance Prevention)
  const startCleanSpeechRecognition = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    // 1. 기존 타이머 및 인스턴스 리스너 완전 강제 해제
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    // 2. 신규 인스턴스 생성
    const rec = new SpeechRecognitionAPI();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      console.log('✅ 신규 마이크 세션 정상 가동됨 (onstart)');
      isRecognizingRef.current = true;
      setTurnStatus('USER_LISTENING');
      setStatusText('🎤 듣고 있다냥! 편하게 말씀해보라냥');
    };

    rec.onresult = (event: any) => {
      // 클로저 이슈 방지를 위해 Ref 기반 플래그로만 유효성 판정
      if (!isRecognizingRef.current || isProcessingRef.current) return;

      let currentText = '';
      for (let i = 0; i < event.results.length; ++i) {
        currentText += event.results[i][0].transcript;
      }

      const trimmed = currentText.trim();
      if (trimmed) {
        latestTranscriptRef.current = trimmed;
        setRecognizedText(trimmed);

        // 발화 중 침묵 타이머 갱신
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // 발화 멈춤 1.6초 후 100% 자동 전송
        silenceTimerRef.current = setTimeout(() => {
          if (latestTranscriptRef.current && latestTranscriptRef.current.length >= 2) {
            console.log('침묵 감지: 자동 전송 실행 ->', latestTranscriptRef.current);
            teardownSTT();
            sendUserMessageToAPI(latestTranscriptRef.current);
          }
        }, 1600);
      }
    };

    rec.onerror = (event: any) => {
      console.warn('STT 에러 발생:', event.error);
      if (event.error === 'no-speech') {
        setStatusText('다시 편하게 말씀해보라냥! 🐾');
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setTurnStatus('PREPARING');
        isRecognizingRef.current = false;
      }
    };

    rec.onend = () => {
      isRecognizingRef.current = false;
    };

    recognitionRef.current = rec;

    // 3. 브라우저 안정화를 위해 50ms 틱 후 구동
    setTimeout(() => {
      try {
        rec.start();
      } catch (err) {
        console.warn('마이크 시작 예외 발생:', err);
      }
    }, 50);
  };

  const cleanTextForTTS = (text: string) => {
    return text
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[*_~`]/g, '')
      .trim();
  };

  // Play System Turn with voice loading and chunked TTS playback
  const speakChunk = (chunkText: string, rate: number, voice: SpeechSynthesisVoice | null): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return resolve();
      }

      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.lang = 'en-US';
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      currentUtteranceRef.current = utterance; // GC 방어

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (e) => {
        console.warn('TTS 청크 에러 방어 처리:', e);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const speakFullMessage = useCallback(async (fullText: string, rate: number): Promise<void> => {
    const voice = await getValidVoice();
    const cleaned = cleanTextForTTS(fullText);
    const chunks = splitTextIntoSentences(cleaned);

    if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
    keepAliveTimerRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        try {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } catch {}
      }
    }, 4000);

    try {
      for (const chunk of chunks) {
        await speakChunk(chunk, rate, voice);
      }
    } finally {
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
      currentUtteranceRef.current = null;
    }
  }, []);

  const playSystemTurn = useCallback(async (text: string, onEnded?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setTurnStatus("USER_LISTENING");
      if (onEnded) onEnded();
      else startCleanSpeechRecognition();
      return;
    }

    setTurnStatus("SYSTEM_SPEAKING");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    isRecognizingRef.current = false;
    setStatusText("🔊 토키캣이 말하고 있다냥...");

    clearWatchdog();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    window.speechSynthesis.cancel();
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }

    await speakFullMessage(text, 0.95);

    let transitionFired = false;
    const proceedToUserTurn = () => {
      if (transitionFired) return;
      transitionFired = true;

      setTurnStatus("PREPARING");
      setStatusText("⏳ 들을 준비 중이다냥...");

      setTimeout(() => {
        if (onEnded) {
          onEnded();
        } else {
          startCleanSpeechRecognition();
        }
      }, 800);
    };

    proceedToUserTurn();
  }, [speakFullMessage, startCleanSpeechRecognition]);

  // Initial Greeting with Autoplay Policy Check & Voice Loading
  const startInitialGreeting = async () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const greetingText = "What kind of topic would you like to talk about?";
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      messageEn: greetingText,
      messageKo: "어떤 주제로 대화해보고 싶냥? 🐾",
      suggestedReplies: [
        "I want to talk about my weekend plans.",
        "Let's talk about my favorite food!"
      ],
      silentCorrection: null
    }]);
    setTurnStatus('SYSTEM_SPEAKING');
    setStatusText("🔊 토키캣이 질문하고 있다냥...");

    window.speechSynthesis.cancel();

    let hasSpoken = false;
    const autoplayCheckTimer = setTimeout(() => {
      if (!hasSpoken) {
        console.warn("첫 질문 자동재생이 브라우저에 의해 차단됨 (오토플레이 정책)");
        setTurnStatus('WAITING_START_TOUCH');
        setStatusText("🐾 터치하여 토키캣과 대화를 시작하세요!");
      }
    }, 1500);

    const voice = await getValidVoice();
    const utterance = new SpeechSynthesisUtterance(greetingText);
    utterance.lang = 'en-US';
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    currentUtteranceRef.current = utterance;

    utterance.onstart = () => {
      hasSpoken = true;
      clearTimeout(autoplayCheckTimer);
      console.log("첫 질문 음성 출력 시작됨");
    };

    utterance.onend = () => {
      clearTimeout(autoplayCheckTimer);
      currentUtteranceRef.current = null;
      setTurnStatus('PREPARING');
      setStatusText("⏳ 들을 준비 중이다냥...");
      setTimeout(() => {
        startCleanSpeechRecognition();
      }, 800);
    };

    utterance.onerror = (e) => {
      clearTimeout(autoplayCheckTimer);
      currentUtteranceRef.current = null;
      console.warn("첫 질문 자동재생 에러:", e);
      setTurnStatus('WAITING_START_TOUCH');
      setStatusText("🐾 터치하여 토키캣과 대화를 시작하세요!");
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleStartTouch = () => {
    kickstartAudioHardware();
    startInitialGreeting();
  };

  const sendUserMessageToAPI = useCallback(async (text: string) => {
    const trimmed = (text || "").trim();

    if (!trimmed || trimmed.length < 3) return;

    const now = Date.now();
    if (isProcessingRef.current || (now - lastCallTimeRef.current < 1500)) {
      console.log("[보안 가드] 중복 또는 과도한 호출 차단.");
      return;
    }

    isProcessingRef.current = true;
    lastCallTimeRef.current = now;

    teardownSTT();
    clearWatchdog();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    setIsThinking(true);
    setStatusText("토키캣이 생각 중이다냥... 🐾");

    setWatchdog(() => {
      console.warn("Watchdog triggered: freeing frozen state");
      isProcessingRef.current = false;
      setIsThinking(false);
      setStatusText("토키캣이 잠시 쉬고 있다냥. 다시 말해보세요! 🐾");
      startCleanSpeechRecognition();
    }, 8000);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      messageEn: trimmed,
      messageKo: "(사용자 발화)"
    };

    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
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
          isReset: false,
          userLevel: userLevelRef.current
        })
      });

      if (res.status === 429) {
        clearWatchdog();
        isProcessingRef.current = false;
        setIsThinking(false);
        setStatusText("요청이 너무 많다냥! 잠시 뒤 시도해줘 🐾");
        showToast("현재 대화 요청이 몰려 잠시 대기 중이다냥. 20초 뒤에 마이크를 눌러달라냥! 🐾");
        startCleanSpeechRecognition();
        return;
      }

      const data = await res.json();
      clearWatchdog();
      isProcessingRef.current = false;

      if (data.success) {
        if (data.extractedTopic && (!anchorTopicRef.current || anchorTopicRef.current === 'Casual Chat' || anchorTopicRef.current === 'Free Talk' || anchorTopicRef.current === 'General Chat')) {
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

        const finalMessages = [...updatedMessages, assistantMsg];
        setMessages(finalMessages);
        setIsThinking(false);

        playSystemTurn(data.messageEn);
      } else {
        throw new Error("API failed");
      }
    } catch (err) {
      clearWatchdog();
      isProcessingRef.current = false;
      console.error("Free-talk API error:", err);
      setIsThinking(false);
      setStatusText("통신 중 오류가 발생했다냥. 다시 시도해줘! 🐾");
      showToast("응답을 불러오지 못했습니다.");
      startCleanSpeechRecognition();
    }
  }, [playSystemTurn, teardownSTT, startCleanSpeechRecognition]);

  // Initial Entry
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    isRecognizingRef.current = false;

    kickstartAudioHardware();
    startInitialGreeting();

    return () => {
      clearWatchdog();
      teardownSTT();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSuggestedClick = (reply: string) => {
    if (isThinking || turnStatus === "SYSTEM_SPEAKING" || turnStatus === "WAITING_START_TOUCH" || isProcessingRef.current) return;
    sendUserMessageToAPI(reply);
  };

  const openCorrectionModal = (correction: string) => {
    setSelectedCorrection(correction);
    setIsCorrectionModalOpen(true);
  };

  const handleSlowReplay = () => {
    const latest = [...messages].reverse().find((m) => m.role === "assistant");
    if (!latest || isThinking || turnStatus === "SYSTEM_SPEAKING") return;

    teardownSTT();
    setTurnStatus("SYSTEM_SPEAKING");
    setStatusText("🐢 0.8배속으로 또박또박 읽어준다냥...");
    showToast("0.8배속으로 천천히 들려드립니다 🐾");

    // 0.8 배속으로 발화 후 다시 마이크 듣기 모드로 전환
    speakFullMessage(latest.messageEn, 0.8).then(() => {
      setTurnStatus("PREPARING");
      setTimeout(() => {
        startCleanSpeechRecognition();
      }, 600);
    });
  };

  const handleSimpleExplanation = async () => {
    const latest = [...messages].reverse().find((m) => m.role === "assistant");
    if (!latest || isThinking || turnStatus === "SYSTEM_SPEAKING") return;

    teardownSTT();
    setIsThinking(true);
    setStatusText("💡 더 쉬운 표현으로 바꾸고 있다냥... 🐾");

    try {
      const res = await fetch("/api/free-talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "simplify",
          targetSentence: latest.messageEn,
          anchorTopic: anchorTopicRef.current,
          userLevel: userLevelRef.current,
        }),
      });

      const data = await res.json();
      setIsThinking(false);

      if (data.success && data.simplifiedEn) {
        // 마지막 메시지의 영어와 한글을 더 쉬운 문장으로 덮어쓰기 업데이트
        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.map((m) => m.role).lastIndexOf("assistant");
          if (lastIdx !== -1) {
            next[lastIdx] = {
              ...next[lastIdx],
              messageEn: data.simplifiedEn,
              messageKo: data.simplifiedKo,
            };
          }
          return next;
        });

        showToast("더 알기 쉬운 쉬운 문장으로 바꿨다냥! 💡");
        // 새롭게 변환된 쉬운 문장을 음성으로 발화
        playSystemTurn(data.simplifiedEn);
      } else {
        throw new Error("Simplification failed");
      }
    } catch (e) {
      setIsThinking(false);
      showToast("문장을 쉽게 바꾸지 못했습니다.");
      startCleanSpeechRecognition();
    }
  };

  // Trigger Review Modal (Sequential Audio & Typing Playback)
  const handleOpenReview = async () => {
    const currentMessages = messagesRef.current.length > 0 ? messagesRef.current : messages;
    const userTurns = currentMessages.filter((m) => m.role === "user");
    if (userTurns.length === 0) {
      showToast("복습할 대화 내역이 없다냥!");
      return;
    }

    teardownSTT();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }

    setIsReviewModalOpen(true);
    setIsReviewLoading(true);
    setFeedbackList([]);
    setActiveReviewIndex(0);
    setTypedReviewText("");
    setIsReviewPaused(false);
    setIsReviewFinished(false);
    setReviewRestartKey((prev) => prev + 1);

    try {
      const res = await fetch("/api/freetalk/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages,
          userLevel: userLevelRef.current || userLevel
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.feedback)) {
        setFeedbackList(data.feedback);
      }
    } catch (e) {
      console.error("Failed to fetch feedback for review", e);
      showToast("피드백 분석 중 오류가 발생했습니다.");
    } finally {
      setIsReviewLoading(false);
    }
  };

  // Auto smooth scroll when review is finished
  useEffect(() => {
    if (isReviewFinished && reviewScrollRef.current) {
      setTimeout(() => {
        reviewScrollRef.current?.scrollTo({
          top: reviewScrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 150);
    }
  }, [isReviewFinished]);

  // Review Sequential Playback Effect
  useEffect(() => {
    if (!isReviewModalOpen || isReviewLoading || isReviewFinished || isReviewPaused) {
      if (isReviewPaused && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
      return;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }

    if (activeReviewIndex >= messages.length) {
      setIsReviewFinished(true);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    const currentMsg = messages[activeReviewIndex];
    if (!currentMsg) return;

    let isCancelled = false;
    const fullText = currentMsg.messageEn;
    setTypedReviewText("");

    const typingPromise = new Promise<void>((resolve) => {
      let charIdx = 0;
      const fullLen = fullText.length;
      const typingInterval = setInterval(() => {
        if (isCancelled || isReviewPaused) {
          clearInterval(typingInterval);
          resolve();
          return;
        }
        charIdx++;
        setTypedReviewText(fullText.slice(0, charIdx));
        if (charIdx >= fullLen) {
          clearInterval(typingInterval);
          resolve();
        }
      }, Math.round(30 / reviewSpeed));
    });

    const speechPromise = speakFullMessage(fullText, reviewSpeed);

    if (reviewScrollRef.current) {
      reviewScrollRef.current.scrollTop = reviewScrollRef.current.scrollHeight;
    }

    Promise.all([typingPromise, speechPromise]).then(() => {
      if (isCancelled || isReviewPaused) return;

      const waitDelay = currentMsg.role === "user" ? 1200 : 600;
      clearReviewTimer();
      reviewTimerRef.current = setTimeout(() => {
        if (isCancelled || isReviewPaused) return;
        setActiveReviewIndex((prev) => prev + 1);
      }, waitDelay);
    });

    return () => {
      isCancelled = true;
      clearReviewTimer();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
      currentUtteranceRef.current = null;
    };
  }, [isReviewModalOpen, isReviewLoading, activeReviewIndex, isReviewPaused, messages, feedbackList, reviewSpeed, speakFullMessage, reviewRestartKey]);

  const handleSkipReview = () => {
    clearReviewTimer();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    currentUtteranceRef.current = null;
    setIsReviewPaused(false);
    setActiveReviewIndex(Math.max(0, messages.length - 1));
    setIsReviewFinished(true);
  };

  const handleRestartReview = () => {
    clearReviewTimer();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    currentUtteranceRef.current = null;
    setIsReviewPaused(false);
    setIsReviewFinished(false);
    setActiveReviewIndex(0);
    setTypedReviewText("");
    setReviewRestartKey((prev) => prev + 1);
  };

  const handleCloseReviewModal = () => {
    clearReviewTimer();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    currentUtteranceRef.current = null;
    setIsReviewModalOpen(false);
  };

  // Trigger Feedback Analysis Report Modal
  const handleOpenFeedbackReport = async () => {
    const currentMessages = messagesRef.current.length > 0 ? messagesRef.current : messages;
    const userTurns = currentMessages.filter((m) => m.role === "user");

    if (userTurns.length === 0) {
      showToast("분석할 대화 내역이 없다냥!");
      return;
    }

    teardownSTT();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }

    setIsFeedbackModalOpen(true);
    setIsFeedbackLoading(true);

    // 1. 사용자 발화 문장들을 기본 뼈대로 초기화 (발화 내역 유실 방지)
    const initialList: FeedbackItem[] = userTurns.map((u, i) => ({
      id: u.id || `fb-${i}`,
      originalText: u.messageEn,
      hasError: false,
      correctedText: u.messageEn,
      naturalExpression: u.messageEn,
      koreanTip: "완벽하고 자연스러운 표현이다냥! 🌟",
    }));
    setFeedbackReportList(initialList);

    try {
      const res = await fetch("/api/freetalk/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages,
          userLevel: userLevelRef.current || userLevel,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.feedback)) {
        // 2. 백엔드에서 분석된 피드백을 사용자 발화 문장에 정밀 매핑
        const mergedList = initialList.map((item) => {
          const found = data.feedback.find(
            (f: any) =>
              f.originalText?.trim().toLowerCase() === item.originalText.trim().toLowerCase()
          );
          if (found) {
            return {
              ...item,
              hasError: found.hasError ?? false,
              correctedText: found.correctedText || item.originalText,
              naturalExpression: found.naturalExpression || item.originalText,
              koreanTip: found.koreanTip || (found.hasError ? "교정된 표현을 확인해보라냥!" : "자연스러운 문장이다냥! 🌟"),
            };
          }
          return item;
        });
        setFeedbackReportList(mergedList);
      }
    } catch (e) {
      console.error("Failed to fetch feedback report", e);
      showToast("피드백 분석 중 일부 오류가 발생했습니다.");
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const handleToggleBookmark = (expression: string, meaning: string, originalContext: string) => {
    try {
      const exists = bookmarkedMap[expression];
      let updated: BookmarkedExpression[];
      if (exists) {
        updated = bookmarkedItems.filter((b) => b.expression !== expression);
        setBookmarkedMap((prev) => ({ ...prev, [expression]: false }));
        showToast("북마크에서 삭제했다냥!");
      } else {
        const newItem: BookmarkedExpression = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          expression,
          meaning,
          originalContext,
          createdAt: new Date().toISOString().slice(0, 10)
        };
        updated = [...bookmarkedItems, newItem];
        setBookmarkedMap((prev) => ({ ...prev, [expression]: true }));
        showToast("북마크에 저장했다냥! ⭐️");
      }
      setBookmarkedItems(updated);
      localStorage.setItem("talkycat_bookmarked_expressions", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to toggle bookmark", e);
    }
  };

  const handleResetConversationClick = () => {
    setExitActionType("reset");
    setIsExitConfirmOpen(true);
  };

  const executeResetConversation = () => {
    setIsExitConfirmOpen(false);
    if (isProcessingRef.current) return;

    teardownSTT();
    clearWatchdog();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    currentUtteranceRef.current = null;
    setRecognizedText("");
    latestTranscriptRef.current = "";
    setAnchorTopic(null);

    showToast("대화를 처음부터 다시 시작한다냥! 🐾");

    const initialGreeting = "What kind of topic would you like to talk about?";
    const openingMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      messageEn: initialGreeting,
      messageKo: "어떤 주제로 대화해보고 싶냥? 🐾",
      suggestedReplies: [
        "I want to talk about my weekend plans.",
        "Let's talk about my favorite food!"
      ],
      silentCorrection: null
    };
    setMessages([openingMsg]);
    playSystemTurn(initialGreeting);
  };

  const handleBackClick = () => {
    const currentMessages = messagesRef.current.length > 0 ? messagesRef.current : messages;
    const userTurns = currentMessages.filter((m) => m.role === "user");
    if (userTurns.length > 0) {
      setExitActionType("back");
      setIsExitConfirmOpen(true);
    } else {
      executeExit();
    }
  };

  const executeExit = () => {
    setIsExitConfirmOpen(false);
    clearWatchdog();
    teardownSTT();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    currentUtteranceRef.current = null;
    router.replace("/");
  };

  const latestAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const currentSuggestedReplies = latestAssistantMsg?.suggestedReplies || [];

  return (
    <div className="min-h-[100dvh] bg-[#faf8ff] text-[#131b2e] flex flex-col items-center justify-start relative select-none">
      {/* Toast Notification */}
      <div
        className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-[#131b2e]/90 text-[#faf8ff] rounded-full shadow-xl transition-all duration-300 flex items-center gap-2 ${
          toastVisible ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-2"
        }`}
      >
        <span className="material-symbols-outlined text-[#6ffbbe] text-[18px]">check_circle</span>
        <span className="font-label-sm text-xs">{toastMessage}</span>
      </div>

      {/* WAITING_START_TOUCH Fallback Overlay when Autoplay is blocked */}
      {turnStatus === 'WAITING_START_TOUCH' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-4xl shadow-inner animate-bounce">
              🐾
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-headline-md text-lg font-bold text-[#131b2e]">
                토키캣 목소리를 듣고 대화를 시작하려면 터치하라냥! 🐾
              </h3>
              <p className="font-body-sm text-xs text-[#737686]">
                브라우저 정책으로 인해 화면을 한 번 터치하면 고양이 목소리와 함께 대화가 시작됩니다.
              </p>
            </div>
            <button
              className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-label-md text-sm font-bold shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              onClick={handleStartTouch}
              type="button"
            >
              <span>🔊</span>
              <span>토키캣과 대화 시작하기 (화면 터치 🐾)</span>
            </button>
          </div>
        </div>
      )}

      {/* TalkyRoom Style Mobile View Container */}
      <div className="w-full max-w-[480px] h-[100dvh] bg-white relative shadow-xl border-x border-[#eaedff]/60 flex flex-col justify-between overflow-hidden">

        {/* 1. Top Header (Korean header title "프리토킹") */}
        <header className="w-full z-40 pt-safe bg-[#faf8ff]/90 backdrop-blur-md border-b border-[#eaedff] flex-shrink-0">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button
                className="w-9 h-9 rounded-full bg-[#eaedff] hover:bg-[#e2e7ff] text-[#131b2e] flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
                onClick={handleBackClick}
                type="button"
                aria-label="메인으로 돌아가기"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
              <div className="w-7 h-7 rounded-full overflow-hidden bg-[#dbe1ff] flex items-center justify-center shrink-0">
                <Image src="/talkycat-s.png" alt="TalkyCat" width={28} height={28} className="w-full h-full object-cover" />
              </div>
              <h1 className="font-headline-sm text-sm font-bold text-[#131b2e] truncate whitespace-nowrap min-w-0">
                프리토킹
              </h1>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                className="flex items-center gap-1.5 p-1 rounded-full bg-orange-50/65 border border-orange-100 shadow-xs hover:bg-orange-100/70 transition cursor-pointer shrink-0"
                onClick={() => setIsNicknameModalOpen(true)}
                type="button"
                title="프로필 및 레벨 수정"
              >
                <span>🐾</span>
                <span className="text-xs font-bold text-gray-800 max-w-[65px] truncate">{nickname}님</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white text-orange-600 border border-orange-200/80 shrink-0 whitespace-nowrap">
                  {(userLevel || "A1").replace("-", "~")}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* 헤더 바로 밑 서브 프레임 (2단 분리 구조: 토픽 라인 + 3버튼 카드형 탭 바) */}
        <div className="w-full border-b border-orange-100/80 bg-white flex-shrink-0">
          <div className="w-full bg-orange-50/70 px-4 py-2 border-b border-orange-100/60 flex items-center gap-2 min-w-0">
            <span className="text-xs text-orange-600 font-bold shrink-0">📌 Topic:</span>
            <span className="text-xs sm:text-sm font-semibold text-gray-800 truncate min-w-0">
              {anchorTopic || '대화 탐색 중...'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-white">
            <button
              onClick={handleOpenReview}
              disabled={messages.length <= 1}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                messages.length > 1
                  ? 'bg-orange-500 text-white border-orange-500 shadow-xs hover:bg-orange-600 active:scale-95 cursor-pointer'
                  : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
              }`}
              type="button"
            >
              <span>🎧</span>
              <span>대화 복습</span>
            </button>

            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 shadow-2xs hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
              type="button"
            >
              <span>📜</span>
              <span>대화 기록</span>
            </button>

            <button
              onClick={handleResetConversationClick}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
              type="button"
            >
              <span>🔄</span>
              <span>대화 리셋</span>
            </button>
          </div>
        </div>

        {/* 2. Central Single Focus Card Area */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-1.5 relative overflow-y-auto bg-gradient-to-b from-[#dbe1ff]/15 via-white to-[#f2f3ff]/35 pb-40">
          <div className="mb-1.5 flex items-center gap-1 px-3 py-1 rounded-full bg-white shadow-md border border-[#eaedff]">
            <span className="material-symbols-outlined text-[#004ac6] text-[15px] animate-bounce">graphic_eq</span>
            <span className="font-label-sm text-xs text-[#004ac6] font-bold">{statusText}</span>
          </div>

          <div className="relative flex items-center justify-center w-28 h-28 sm:w-36 sm:h-36 mb-2">
            <div className={`absolute inset-0 rounded-full bg-[#2563eb]/20 animate-ping ${isThinking || turnStatus === "SYSTEM_SPEAKING" ? "opacity-90" : "opacity-40"}`}></div>
            <div className="absolute -inset-1.5 rounded-full bg-[#004ac6]/10 animate-pulse"></div>
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-lg bg-white p-1.5 flex items-center justify-center border-2 border-[#dbe1ff]">
              <Image
                src="/talkycat-m.png"
                alt="TalkyCat Avatar"
                width={128}
                height={128}
                className="w-full h-full object-cover select-none pointer-events-none transform transition-transform duration-300"
                priority
              />
            </div>
          </div>

          <div className="w-full max-w-md bg-white rounded-2xl p-4 shadow-md border border-[#eaedff] flex flex-col gap-2.5 relative transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] font-bold ${turnStatus === "USER_LISTENING" ? "bg-emerald-100 text-emerald-800" : "bg-[#dbe1ff] text-[#00174b]"}`}>
                {turnStatus === "USER_LISTENING" ? "나 🎤 (마이크 켜짐)" : "토키캣 🐾"}
              </span>
              <button
                className="w-7 h-7 rounded-full bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#004ac6] flex items-center justify-center transition-colors cursor-pointer active:scale-95 shadow-xs"
                onClick={() => {
                  if (latestAssistantMsg) playSystemTurn(latestAssistantMsg.messageEn, () => startCleanSpeechRecognition());
                }}
                title="다시 듣기"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">volume_up</span>
              </button>
            </div>

            <p className="font-headline-sm text-base sm:text-lg font-bold text-[#131b2e] leading-snug text-center">
              {isThinking ? "Thinking of a warm reply..." : latestAssistantMsg ? latestAssistantMsg.messageEn : "Loading..."}
            </p>

            {showKorean && (
              <p className="font-body-sm text-[11px] text-[#434655] text-center border-t border-[#eaedff]/60 pt-1.5">
                {isThinking ? "토키캣이 답변을 준비 중입니다." : latestAssistantMsg ? latestAssistantMsg.messageKo : ""}
              </p>
            )}

            {latestAssistantMsg?.silentCorrection && (
              <button
                className="self-center mt-0.5 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all text-[11px] font-semibold shadow-xs cursor-pointer"
                onClick={() => openCorrectionModal(latestAssistantMsg.silentCorrection!)}
                type="button"
              >
                <span className="material-symbols-outlined text-[13px] text-amber-500 fill-1">lightbulb</span>
                <span>💡 토키캣의 귓속말 팁 보기</span>
              </button>
            )}
          </div>

          <div className="mt-2.5 w-full max-w-md flex flex-col items-center">
            {isThinking ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004ac6]/10 text-[#004ac6] text-xs font-semibold animate-pulse">
                <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                <span>토키캣이 생각 중이다냥... 🐾</span>
              </div>
            ) : turnStatus === "USER_LISTENING" && recognizedText ? (
              <div className="w-full bg-[#004ac6]/10 border border-[#004ac6]/30 text-[#004ac6] rounded-xl px-3.5 py-2 text-center text-xs font-medium shadow-xs animate-fade-in">
                &ldquo;{recognizedText}&rdquo; <span className="text-[10px] opacity-75">(인식 중...)</span>
              </div>
            ) : null}
          </div>
        </main>

        {/* 3. Unified Bottom Footer with Safe Area Inset and Turn State Machine UI */}
        <footer className="absolute bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#eaedff] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2 max-w-[480px] mx-auto flex-shrink-0">
          {currentSuggestedReplies.length > 0 && !isThinking && turnStatus === "USER_LISTENING" && (
            <div className="flex flex-wrap justify-center gap-1 w-full">
              {currentSuggestedReplies.map((reply, idx) => (
                <button
                  key={idx}
                  className="px-2.5 py-1 rounded-full bg-[#f2f3ff] border border-[#004ac6]/30 text-[#004ac6] hover:bg-[#004ac6] hover:text-white text-[11px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                  onClick={() => handleSuggestedClick(reply)}
                  type="button"
                >
                  <span>💬 {reply}</span>
                </button>
              ))}
            </div>
          )}

          <div className="w-full max-w-[480px] mx-auto grid grid-cols-3 gap-1.5">
            <button
              className="h-9 px-2 rounded-xl bg-white border border-[#c3c6d7]/60 shadow-xs flex items-center justify-center gap-1 text-[#131b2e] hover:bg-[#f2f3ff] active:scale-95 transition-all cursor-pointer"
              onClick={handleSlowReplay}
              type="button"
            >
              <span className="text-xs">🐢</span>
              <span className="font-label-sm text-[11px] font-semibold truncate">천천히</span>
            </button>
            <button
              className="h-9 px-2 rounded-xl bg-white border border-[#c3c6d7]/60 shadow-xs flex items-center justify-center gap-1 text-[#131b2e] hover:bg-[#f2f3ff] active:scale-95 transition-all cursor-pointer"
              onClick={handleSimpleExplanation}
              type="button"
            >
              <span className="text-xs">💡</span>
              <span className="font-label-sm text-[11px] font-semibold truncate">쉽게 설명</span>
            </button>
            <button
              className="h-9 px-2 rounded-xl bg-amber-50 border border-amber-300/80 shadow-xs flex items-center justify-center gap-1 text-amber-900 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer font-bold"
              onClick={handleResetConversationClick}
              type="button"
            >
              <span className="text-xs">🔄</span>
              <span className="font-label-sm text-[11px] truncate">대화 리셋</span>
            </button>
          </div>

          <div className="w-full max-w-[480px] mx-auto flex items-center justify-around px-4 py-2 rounded-2xl bg-[#f2f3ff]/80 border border-[#eaedff] shadow-xs">
            <div className="flex flex-col items-center">
              <button
                className="w-11 h-11 rounded-full bg-white text-[#004ac6] flex items-center justify-center hover:bg-[#e2e7ff] active:scale-90 transition shadow-xs cursor-pointer"
                onClick={() => {
                  if (latestAssistantMsg) playSystemTurn(latestAssistantMsg.messageEn, () => startCleanSpeechRecognition());
                }}
                type="button"
                aria-label="다시듣기"
              >
                <span className="material-symbols-outlined text-[20px]">replay</span>
              </button>
              <span className="font-label-sm text-[10px] text-[#434655] mt-0.5 font-bold">다시듣기</span>
            </div>

            <div className="flex flex-col items-center">
              <button
                disabled={turnStatus === "SYSTEM_SPEAKING" || turnStatus === "WAITING_START_TOUCH"}
                onClick={() => {
                  if (turnStatus === "WAITING_START_TOUCH") {
                    handleStartTouch();
                    return;
                  }
                  if (turnStatus !== "SYSTEM_SPEAKING") {
                    if (turnStatus === "USER_LISTENING" && recognizedText.trim().length > 0) {
                      if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                      }
                      handleSpeechResult(recognizedText);
                    } else {
                      startCleanSpeechRecognition();
                      showToast("마이크가 켜졌습니다. 말씀해 보세요!");
                    }
                  }
                }}
                className={`w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-all duration-300 shadow-md ${
                  turnStatus === "USER_LISTENING"
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg ring-4 ring-emerald-200 animate-pulse cursor-pointer'
                    : turnStatus === "PREPARING"
                    ? 'bg-orange-400 text-white opacity-90 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
                type="button"
                aria-label="마이크 제어 및 전송"
              >
                <span className={`material-symbols-outlined text-[26px] ${turnStatus === "SYSTEM_SPEAKING" ? "animate-spin" : ""}`}>
                  {turnStatus === "USER_LISTENING" && recognizedText.trim().length > 0 ? "send" : "mic"}
                </span>
              </button>
              <span className="font-label-sm text-[10px] text-[#004ac6] font-semibold mt-0.5 whitespace-nowrap">
                {turnStatus === 'SYSTEM_SPEAKING' && "🔊 토키캣이 말하고 있다냥..."}
                {turnStatus === 'PREPARING' && "⏳ 답변 준비 중이다냥..."}
                {turnStatus === 'WAITING_START_TOUCH' && "🐾 터치하여 대화 시작"}
                {turnStatus === 'USER_LISTENING' && "🎤 듣고 있다냥..."}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <button
                className="w-11 h-11 rounded-full bg-[#ffdad6] text-[#93000a] flex items-center justify-center hover:bg-[#ba1a1a] hover:text-white active:scale-90 transition shadow-xs cursor-pointer"
                onClick={handleBackClick}
                type="button"
                aria-label="통화 종료"
              >
                <span className="material-symbols-outlined text-[20px]">call_end</span>
              </button>
              <span className="font-label-sm text-[10px] text-[#93000a] font-semibold mt-0.5">종료</span>
            </div>
          </div>
        </footer>

      </div>

      {/* 🎧 REVIEW & BOOKMARK MODAL (Sequential Audio Playback) */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-2">
          <div className="w-full max-w-[480px] h-[100dvh] sm:h-[92vh] sm:rounded-3xl bg-white flex flex-col animate-in fade-in select-none shadow-2xl overflow-hidden relative">
            
            {/* 1단: 모달 메인 헤더 */}
            <div className="h-13 px-4 flex items-center justify-between border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900">대화 복습하기 🐾</span>
              </div>
              <button
                onClick={handleCloseReviewModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
                aria-label="닫기"
                type="button"
              >
                <span className="text-xl leading-none">✕</span>
              </button>
            </div>

            {/* 2단: 3개 컨트롤 버튼 전용 툴바 (균등 3열 그리드) */}
            <div className="px-3 py-2 bg-orange-50/50 border-b border-orange-100/70 grid grid-cols-3 gap-2 shrink-0">
              <button
                onClick={() => setIsReviewPaused(!isReviewPaused)}
                className="py-1.5 px-1 rounded-lg bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold flex items-center justify-center gap-1 shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer"
                type="button"
              >
                <span>{isReviewPaused ? '▶' : '⏸'}</span>
                <span>{isReviewPaused ? '재생' : '일시정지'}</span>
              </button>
              <button
                onClick={() => {
                  if (reviewSpeed === 1.0) setReviewSpeed(1.2);
                  else if (reviewSpeed === 1.2) setReviewSpeed(0.8);
                  else setReviewSpeed(1.0);
                }}
                className="py-1.5 px-1 rounded-lg bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold flex items-center justify-center gap-1 shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer"
                type="button"
                title="배속 조절"
              >
                <span>⚡</span>
                <span>{reviewSpeed}x 배속</span>
              </button>
              <button
                onClick={handleSkipReview}
                className="py-1.5 px-1 rounded-lg bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold flex items-center justify-center gap-1 shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer"
                type="button"
              >
                <span>⏭</span>
                <span>전체보기</span>
              </button>
            </div>

            {/* 3단: 대화 복습 바디 스크롤 영역 */}
            <div
              ref={reviewScrollRef}
              className={`flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#faf8ff] transition-all ${
                isReviewFinished ? 'pb-24' : 'pb-6'
              }`}
            >
              {isReviewLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
                  <div className="w-16 h-16 rounded-full bg-[#004ac6]/10 flex items-center justify-center text-3xl animate-bounce">
                    🐾
                  </div>
                  <p className="font-headline-sm text-sm text-[#004ac6] font-bold text-center animate-pulse">
                    토키캣이 오늘 나눈 대화를 꼼꼼히 분석하고 있다냥... 🐾
                  </p>
                </div>
              ) : (
                <>
                  {(() => {
                    const itemsToRender = isReviewFinished
                      ? messages
                      : messages.slice(0, activeReviewIndex + 1);

                    return itemsToRender.map((m, idx, arr) => {
                      const isCurrent = idx === arr.length - 1 && !isReviewFinished;
                      const matchingFeedback = m.role === "user" ? feedbackList.find((f) => f.originalText === m.messageEn) : null;
                      const isBookmarkedRec = matchingFeedback ? !!bookmarkedMap[matchingFeedback.naturalExpression] : false;
                      const isBookmarkedCorr = matchingFeedback ? !!bookmarkedMap[matchingFeedback.correctedText] : false;

                      return (
                        <div key={m.id || idx} className={`flex flex-col gap-2 animate-in fade-in ${m.role === "user" ? "items-end" : "items-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border ${
                            m.role === "assistant"
                              ? "bg-white text-[#131b2e] border-[#eaedff]"
                              : "bg-[#004ac6] text-white border-[#004ac6]"
                          }`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                m.role === "assistant" ? "bg-[#f2f3ff] text-[#004ac6]" : "bg-white/20 text-white"
                              }`}>
                                {m.role === "assistant" ? "TalkyCat 🐾" : `${nickname} 🎤`}
                              </span>
                              <span className={`text-[10px] ${m.role === "assistant" ? "text-slate-400" : "text-white/70"}`}>
                                {m.messageKo}
                              </span>
                            </div>
                            <p className="font-headline-sm text-base leading-snug">
                              {isCurrent && !isReviewFinished ? typedReviewText : m.messageEn}
                            </p>
                          </div>

                          {m.role === "user" && matchingFeedback && (
                            <div className="w-full max-w-[95%] bg-white rounded-2xl p-4 shadow-md border border-amber-200/80 flex flex-col gap-3 animate-in slide-in-from-bottom-2">
                              <div className="flex items-center justify-between">
                                <span className="font-label-sm text-xs font-bold text-amber-800 flex items-center gap-1">
                                  <span>🐱</span> 토키캣의 코칭 카드
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${matchingFeedback.hasError ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                                  {matchingFeedback.hasError ? "문법 교정 필요" : "완벽한 표현 🌟"}
                                </span>
                              </div>

                              {matchingFeedback.hasError && (
                                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-rose-900">✏️ 교정 표현 (Correction)</span>
                                    <button
                                      className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-90 ${
                                        isBookmarkedCorr ? "bg-amber-500 text-white shadow-xs" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                      }`}
                                      onClick={() => handleToggleBookmark(matchingFeedback.correctedText, matchingFeedback.koreanTip, matchingFeedback.originalText)}
                                      type="button"
                                      title="표현 북마크 저장"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">
                                        {isBookmarkedCorr ? "star" : "grade"}
                                      </span>
                                    </button>
                                  </div>
                                  <p className="text-sm font-bold text-rose-950">{matchingFeedback.correctedText}</p>
                                </div>
                              )}

                              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-emerald-900">🌟 원어민 추천 표현 (Natural)</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      className="w-7 h-7 rounded-full bg-emerald-200 text-emerald-900 flex items-center justify-center hover:bg-emerald-300 transition cursor-pointer active:scale-90"
                                      onClick={() => playSystemTurn(matchingFeedback.naturalExpression, () => {})}
                                      type="button"
                                      title="발음 듣기"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">volume_up</span>
                                    </button>
                                    <button
                                      className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-90 ${
                                        isBookmarkedRec ? "bg-amber-500 text-white shadow-xs" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                      }`}
                                      onClick={() => handleToggleBookmark(matchingFeedback.naturalExpression, matchingFeedback.koreanTip, matchingFeedback.originalText)}
                                      type="button"
                                      title="표현 북마크 저장"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">
                                        {isBookmarkedRec ? "star" : "grade"}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm font-bold text-emerald-950">{matchingFeedback.naturalExpression}</p>
                              </div>

                              <p className="text-xs text-[#434655] font-medium leading-relaxed bg-[#f2f3ff]/60 p-2.5 rounded-xl">
                                {matchingFeedback.koreanTip}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}

                  {isReviewFinished && (
                    <div className="w-full bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3 flex items-center justify-between gap-2 mt-2 shrink-0 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">🎉</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-emerald-950 truncate">복습을 모두 마쳤다냥! 🌟</span>
                          <span className="text-[11px] text-emerald-700 truncate">오늘 나눈 대화 표현을 잘 기억해두라냥.</span>
                        </div>
                      </div>
                      {bookmarkedItems.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-200 shadow-2xs shrink-0 whitespace-nowrap">
                          ⭐️ 북마크 {bookmarkedItems.length}개
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {isReviewFinished && (
              <div className="p-3 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center gap-2 shrink-0 animate-in slide-in-from-bottom-3 z-20">
                <button
                  onClick={handleRestartReview}
                  type="button"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                >
                  <span>🔄</span>
                  <span>다시 복습하기</span>
                </button>
                <button
                  onClick={handleCloseReviewModal}
                  type="button"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <span>🐾</span>
                  <span>복습 종료</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 💡 FEEDBACK ANALYSIS REPORT MODAL */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-2">
          <div className="w-full max-w-[480px] h-[100dvh] sm:h-[92vh] sm:rounded-3xl bg-white flex flex-col animate-in fade-in select-none shadow-2xl overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <span className="font-headline-sm text-base font-bold text-gray-900">오늘 대화 피드백 리포트</span>
              </div>
              <button
                onClick={() => setIsFeedbackModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
                aria-label="닫기"
                type="button"
              >
                <span className="text-xl leading-none">✕</span>
              </button>
            </div>

            {/* Modal Body Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#faf8ff] pb-24">
              {isFeedbackLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
                  <div className="w-16 h-16 rounded-full bg-[#004ac6]/10 flex items-center justify-center text-3xl animate-bounce">
                    🐾
                  </div>
                  <p className="font-headline-sm text-sm text-[#004ac6] font-bold text-center animate-pulse">
                    토키캣이 오늘 나눈 대화를 꼼꼼히 분석하고 있다냥... 🐾
                  </p>
                </div>
              ) : feedbackReportList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <div className="text-4xl">🐾</div>
                  <p className="text-sm font-semibold text-gray-600">분석할 사용자 발화 내역이 없다냥! 먼저 토키캣과 영어로 대화를 나눠보세요 🐾</p>
                </div>
              ) : (
                <>
                  {/* Summary Card */}
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 text-white shadow-md flex items-center gap-3">
                    <div className="text-3xl shrink-0">🐱</div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <h4 className="font-bold text-sm">토키캣의 코칭 총평</h4>
                      <p className="text-xs text-white/95 leading-relaxed">
                        오늘 총 {feedbackReportList.length}개의 문장을 멋지게 말해주었어요! 아래 카드를 통해 문법 교정 표현과 원어민 추천 표현을 복습해보세요 🌟
                      </p>
                    </div>
                  </div>

                  {feedbackReportList.map((item, idx) => {
                    const isBookmarkedRec = !!bookmarkedMap[item.naturalExpression];
                    const isBookmarkedCorr = !!bookmarkedMap[item.correctedText];

                    return (
                      <div key={item.id || idx} className="bg-white rounded-2xl p-4 shadow-md border border-amber-200/80 flex flex-col gap-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-xs font-bold text-amber-800 flex items-center gap-1">
                            <span>🐱</span> 대화 턴 #{idx + 1}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${item.hasError ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {item.hasError ? "문법 교정 필요 ✏️" : "완벽한 표현 🌟"}
                          </span>
                        </div>

                        {/* 1. Original Utterance */}
                        <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                          <span className="text-[11px] font-bold text-slate-600">🗣 내가 한 말 (Original)</span>
                          <p className="text-sm font-bold text-slate-900">&ldquo;{item.originalText}&rdquo;</p>
                        </div>

                        {/* 2. Correction */}
                        {item.hasError && (
                          <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-rose-900">✏️ 문법/문맥 교정 (Correction)</span>
                              <button
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-90 ${
                                  isBookmarkedCorr ? "bg-amber-500 text-white shadow-xs" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                }`}
                                onClick={() => handleToggleBookmark(item.correctedText, item.koreanTip, item.originalText)}
                                type="button"
                                title="표현 북마크 저장"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {isBookmarkedCorr ? "star" : "grade"}
                                </span>
                              </button>
                            </div>
                            <p className="text-sm font-bold text-rose-950">{item.correctedText}</p>
                          </div>
                        )}

                        {/* 3. Natural Expression */}
                        <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-900">🌟 원어민 추천 표현 (Natural)</span>
                            <div className="flex items-center gap-1">
                              <button
                                className="w-7 h-7 rounded-full bg-emerald-200 text-emerald-900 flex items-center justify-center hover:bg-emerald-300 transition cursor-pointer active:scale-90"
                                onClick={() => playSystemTurn(item.naturalExpression, () => {})}
                                type="button"
                                title="발음 듣기"
                              >
                                <span className="material-symbols-outlined text-[15px]">volume_up</span>
                              </button>
                              <button
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-90 ${
                                  isBookmarkedRec ? "bg-amber-500 text-white shadow-xs" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                }`}
                                onClick={() => handleToggleBookmark(item.naturalExpression, item.koreanTip, item.originalText)}
                                type="button"
                                title="표현 북마크 저장"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {isBookmarkedRec ? "star" : "grade"}
                                </span>
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-emerald-950">{item.naturalExpression}</p>
                        </div>

                        {/* 4. Korean Coaching Tip */}
                        <p className="text-xs text-[#434655] font-medium leading-relaxed bg-[#f2f3ff]/60 p-2.5 rounded-xl">
                          💡 {item.koreanTip}
                        </p>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Bottom Sticky Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center gap-2 z-20 shadow-lg">
              <button
                onClick={() => router.replace("/")}
                type="button"
                className="w-full py-3 rounded-2xl bg-[#004ac6] hover:bg-[#2563eb] text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                <span>🐾</span>
                <span>확인 완료 / 메인으로 나가기</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Exit or Reset Confirmation Modal */}
      {isExitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-3xl shadow-inner">
              🐾
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-headline-md text-lg font-bold text-[#131b2e]">
                오늘 나눈 대화의 피드백을 확인해볼래냥? 🐾
              </h3>
              <p className="font-body-sm text-xs text-[#737686]">
                토키캣이 분석한 문법 오류, 어색한 단어 교정, 더 자연스러운 원어민 표현을 한눈에 확인할 수 있어요!
              </p>
            </div>
            <div className="flex flex-col gap-2.5 w-full pt-2">
              <button
                className="w-full py-3 rounded-2xl bg-[#004ac6] text-white font-label-md text-sm font-bold shadow-md hover:bg-[#2563eb] transition cursor-pointer flex items-center justify-center gap-1.5"
                onClick={() => {
                  setIsExitConfirmOpen(false);
                  handleOpenFeedbackReport();
                }}
                type="button"
              >
                <span>💡</span>
                <span>내 대화 피드백 보기 🐾</span>
              </button>
              <button
                className="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-label-md text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                onClick={() => {
                  if (exitActionType === "reset") {
                    executeResetConversation();
                  } else {
                    executeExit();
                  }
                }}
                type="button"
              >
                {exitActionType === "reset" ? "그냥 대화 리셋하기" : "그냥 종료하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Silent Correction Modal */}
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

      <NicknameModal
        isOpen={isNicknameModalOpen}
        initialNickname={nickname === "사용자" ? "" : nickname}
        initialGoal={streakGoal}
        initialLevel={userLevel}
        onClose={() => setIsNicknameModalOpen(false)}
        onSave={handleSaveProfile}
      />
    </div>
  );
}
