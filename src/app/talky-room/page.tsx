"use client";

import React, { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { GeneratedScript, DialogueLine } from "@/types/script";

type LearningMode = "listen_all" | "shadowing" | "roleplay" | "role_switch";

function TalkyRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [nickname, setNickname] = useState("사용자");
  const [currentTurn, setCurrentTurn] = useState(0);
  const [speed, setSpeed] = useState<number>(1.0);
  const [showKorean, setShowKorean] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [mode, setMode] = useState<LearningMode>("listen_all");
  const [statusText, setStatusText] = useState("대화 준비 중 🐾");
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [sttStatus, setSttStatus] = useState<"idle" | "listening" | "success">("idle");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstPlayRef = useRef<boolean>(true);
  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestTranscriptRef = useRef<string>("");

  const isSpeakingMode = mode !== "listen_all";

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
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

  const wakeAudioOutput = async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (e) {
      console.warn("Audio wake-up failed:", e);
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
    setIsListening(false);
  }, []);

  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  };

  const checkMatch = (spoken: string, target: string) => {
    const normSpoken = normalizeText(spoken);
    const normTarget = normalizeText(target);
    if (!normSpoken || !normTarget) return false;

    if (normTarget.includes(normSpoken) || normSpoken.includes(normTarget)) {
      return true;
    }

    const targetWords = normTarget.split(/\s+/);
    const spokenWords = normSpoken.split(/\s+/);
    let matches = 0;
    for (const w of targetWords) {
      if (spokenWords.includes(w)) matches++;
    }
    const matchRate = matches / Math.max(1, targetWords.length);
    return matchRate >= 0.7; // 70% or more matching rate
  };

  const stopListening = useCallback(() => {
    teardownSTT();
    setSttStatus("idle");
    setStatusText("음성 인식이 일시중지되었습니다. 다시 누르면 시작합니다. 🐾");
  }, [teardownSTT]);

  const handleNextTurn = useCallback(() => {
    clearTimer();
    teardownSTT();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (!script || !script.dialogue) return;
    if (currentTurn < script.dialogue.length - 1) {
      setCurrentTurn((prev) => prev + 1);
      setShowKorean(false);
      setSttStatus("idle");
      setRecognizedText("");
      latestTranscriptRef.current = "";
    } else {
      setIsFeedbackModalOpen(true);
      // Save completion
      try {
        const newCount = (script.completedCount || 0) + 1;
        const updatedScript = { ...script, completedCount: newCount };
        localStorage.setItem(`talkycat_script_${script.id}`, JSON.stringify(updatedScript));

        const saved = localStorage.getItem("talkycat_scripts");
        if (saved) {
          const parsedList: GeneratedScript[] = JSON.parse(saved);
          if (Array.isArray(parsedList)) {
            const updatedList = parsedList.map((s) => (s.id === script.id ? updatedScript : s));
            localStorage.setItem("talkycat_scripts", JSON.stringify(updatedList));
          }
        }

        const todaySent = Number(localStorage.getItem("talkycat_today_sentences") || "0") + script.dialogue.length;
        localStorage.setItem("talkycat_today_sentences", todaySent.toString());
      } catch (e) {
        console.error("Failed to save session completion", e);
      }
    }
  }, [script, currentTurn, teardownSTT]);

  const evaluateSpeech = useCallback((transcript: string) => {
    if (!script || !script.dialogue) return;
    const target = script.dialogue[currentTurn]?.english || "";

    if (checkMatch(transcript, target)) {
      teardownSTT();
      setSttStatus("success");
      setIsListening(false);
      setStatusText("완벽하다냥! 🎉");

      // Sentence transition buffer: 1.5 seconds delay before moving to next step
      timerRef.current = setTimeout(() => {
        handleNextTurn();
      }, 1500);
    }
  }, [script, currentTurn, handleNextTurn, teardownSTT]);

  const startListening = useCallback(() => {
    if (!isSpeakingMode) return;
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
        setSttStatus("listening");
        setStatusText("말씀하세요, 음성 인식 중... 🎙️");
      } catch (e) {
        console.warn("Recognition start error:", e);
        isRecognizingRef.current = false;
        setIsListening(false);
      }
    }
  }, [isSpeakingMode]);

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

        // Silence debounce fallback (1.5s)
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (isRecognizingRef.current && currentTranscript) {
            evaluateSpeech(currentTranscript);
          }
        }, 1500);

        if (finalTranscript) {
          evaluateSpeech(finalTranscript);
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
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [evaluateSpeech]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find((v) => v.lang.startsWith("en-US") || v.lang.startsWith("en"));
      if (enVoice) {
        setSelectedVoice(enVoice);
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => clearTimer();
  }, []);

  const loadScriptData = useCallback(() => {
    try {
      const savedNickname = localStorage.getItem("talkycat_nickname");
      if (savedNickname) setNickname(savedNickname);

      if (id) {
        const individual = localStorage.getItem(`talkycat_script_${id}`);
        if (individual) {
          const parsed = JSON.parse(individual);
          if (parsed && Array.isArray(parsed.dialogue)) {
            setScript(parsed);
            return;
          }
        }
        const savedScripts = localStorage.getItem("talkycat_scripts");
        if (savedScripts) {
          const parsedList: GeneratedScript[] = JSON.parse(savedScripts);
          if (Array.isArray(parsedList)) {
            const found = parsedList.find((s) => s.id === id);
            if (found && Array.isArray(found.dialogue)) {
              setScript(found);
              return;
            }
          }
        }
      }

      // Fallback mock script
      const fallback: GeneratedScript = {
        id: id || "1",
        date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
        category: "생활영어",
        title: "편의점에서 물건 찾기",
        mission: "편의점 직원에게 생수 위치를 묻고 결제하기",
        corePatterns: [
          { pattern: "Where can I find ~?", meaning: "~는 어디 있나요?" },
          { pattern: "How much is this?", meaning: "얼마인가요?" },
          { pattern: "Can I pay by card?", meaning: "카드 결제 되나요?" }
        ],
        pronunciationTip: {
          word: "aisle",
          phonetic: "[aɪl]",
          tip: "'s' 묵음 주의! (아일)"
        },
        catTip: "점원을 부를 땐 'Excuse me'로 부드럽게 시작해보라냥! 🐾",
        dialogue: [
          { id: 1, speaker: "user", speakerName: "나 (손님)", english: "Excuse me, where can I find the bottled water?", korean: "실례합니다, 생수는 어디에 있나요?" },
          { id: 2, speaker: "cat", speakerName: "토키캣 (점원)", english: "Are you looking for cold water or room temperature water?", korean: "찬물 찾으세요, 상온 물 찾으세요?" },
          { id: 3, speaker: "cat", speakerName: "토키캣 (점원)", english: "It's right over there in aisle 3, next to the cold drinks!", korean: "3번 통로 저기 바로 옆, 시원한 음료 코너 쪽에 있어요!" },
          { id: 4, speaker: "user", speakerName: "나 (손님)", english: "Oh, perfect! How much is this one?", korean: "아, 딱 좋네요! 이 매운 건 얼마예요?" }
        ],
        completedCount: 0
      };
      setScript(fallback);
    } catch (e) {
      console.error("Failed to load script in TalkyRoom", e);
    }
  }, [id]);

  useEffect(() => {
    setIsMounted(true);
    loadScriptData();
  }, [loadScriptData]);

  const speakCurrentLine = useCallback(async (text: string, onEndCallback?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (onEndCallback) onEndCallback();
      return;
    }

    // 1. Teardown STT completely and wake up audio output channel
    teardownSTT();
    await wakeAudioOutput();

    const speak = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = speed;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => {
        setSpeaking(true);
        setStatusText("토키캣 말하는 중 🐾");
      };
      utterance.onend = () => {
        setSpeaking(false);
        if (onEndCallback) onEndCallback();
      };
      utterance.onerror = () => {
        setSpeaking(false);
        if (onEndCallback) onEndCallback();
      };

      window.speechSynthesis.speak(utterance);
    };

    if (isFirstPlayRef.current) {
      isFirstPlayRef.current = false;
      kickstartAudioHardware();
      setTimeout(() => {
        speak();
      }, 300);
    } else {
      // 300ms safety buffer for hardware output switching from mic to speaker
      setTimeout(() => {
        speak();
      }, 300);
    }
  }, [speed, selectedVoice, teardownSTT]);

  const handleFullNextTurn = useCallback((finishedTurn: number, dialogueList: DialogueLine[]) => {
    if (finishedTurn < dialogueList.length - 1) {
      setStatusText("1.5초 후 다음 문장으로 이동합니다... 🐾");
      timerRef.current = setTimeout(() => {
        setCurrentTurn(finishedTurn + 1);
        setShowKorean(false);
      }, 1500);
    } else {
      setStatusText("미션 완료! 🐾");
      setIsFeedbackModalOpen(true);
      // Save completion
      try {
        const newCount = (script?.completedCount || 0) + 1;
        const updatedScript = { ...script!, completedCount: newCount };
        localStorage.setItem(`talkycat_script_${script?.id}`, JSON.stringify(updatedScript));

        const saved = localStorage.getItem("talkycat_scripts");
        if (saved) {
          const parsedList: GeneratedScript[] = JSON.parse(saved);
          if (Array.isArray(parsedList)) {
            const updatedList = parsedList.map((s) => (s.id === script?.id ? updatedScript : s));
            localStorage.setItem("talkycat_scripts", JSON.stringify(updatedList));
          }
        }

        const todaySent = Number(localStorage.getItem("talkycat_today_sentences") || "0") + dialogueList.length;
        localStorage.setItem("talkycat_today_sentences", todaySent.toString());
      } catch (e) {
        console.error("Failed to save session completion", e);
      }
    }
  }, [script]);

  // Main playback & timing control flow with initial wait and anti-echo buffer
  useEffect(() => {
    clearTimer();
    teardownSTT();
    setSttStatus("idle");
    setRecognizedText("");
    latestTranscriptRef.current = "";

    if (!script || !script.dialogue) return;
    const dialogueList = script.dialogue;

    if (mode === "listen_all") {
      if (currentTurn === 0) {
        setStatusText("1.5초 후 전체듣기가 시작됩니다... 🐾");
        timerRef.current = setTimeout(() => {
          speakCurrentLine(dialogueList[0].english, () => {
            handleFullNextTurn(0, dialogueList);
          });
        }, 1500);
      } else if (currentTurn < dialogueList.length) {
        speakCurrentLine(dialogueList[currentTurn].english, () => {
          handleFullNextTurn(currentTurn, dialogueList);
        });
      }
    } else {
      // Speaking modes with initial 1.5s wait and anti-echo buffer (900ms)
      setStatusText("1.5초 후 발화 준비... 🐾");
      timerRef.current = setTimeout(() => {
        speakCurrentLine(dialogueList[currentTurn].english, () => {
          setStatusText("마이크 활성화 대기 중... 🎙️");
          timerRef.current = setTimeout(() => {
            startListening();
          }, 900);
        });
      }, 1500);
    }
  }, [currentTurn, script, mode, speakCurrentLine, handleFullNextTurn, startListening, teardownSTT]);

  const handleManualReplay = () => {
    clearTimer();
    teardownSTT();
    if (!script || !script.dialogue) return;

    speakCurrentLine(script.dialogue[currentTurn].english, () => {
      if (mode === "listen_all") {
        handleFullNextTurn(currentTurn, script.dialogue);
      } else {
        setStatusText("마이크 활성화 대기 중... 🎙️");
        timerRef.current = setTimeout(() => {
          startListening();
        }, 900);
      }
    });
  };

  const handleMicClick = () => {
    if (!isSpeakingMode) {
      setStatusText("전체듣기 모드에서는 마이크를 사용할 수 없습니다 🎧");
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isMounted || !script) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#004ac6] border-t-transparent animate-spin" />
      </div>
    );
  }

  const dialogueList: DialogueLine[] = script.dialogue || [];
  const currentLine = dialogueList[currentTurn] || dialogueList[0];
  const progressPercent = Math.round(((currentTurn + 1) / dialogueList.length) * 100);
  const isCat = currentLine.speaker === "cat";
  const nextLine = dialogueList[currentTurn + 1];

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col items-center justify-start relative select-none">
      <div className="w-full max-w-[480px] min-h-screen bg-[#faf8ff] relative shadow-xl border-x border-[#eaedff]/60 flex flex-col pb-72">
        
        {/* Top Header */}
        <header className="fixed top-0 w-full max-w-[480px] z-40 pt-safe bg-[#faf8ff]/90 backdrop-blur-md border-b border-[#eaedff]">
          <div className="h-16 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="w-10 h-10 rounded-full bg-[#eaedff] hover:bg-[#e2e7ff] text-[#131b2e] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                onClick={() => router.push("/")}
                type="button"
                aria-label="메인으로 돌아가기"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <Image src="/logo.png" alt="Logo" width={26} height={26} className="h-6 w-auto object-contain" />
              <h1 className="font-headline-sm text-sm font-bold text-[#131b2e] truncate max-w-[110px]">
                Talky Room
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#e2e7ff] text-[#131b2e] hover:bg-[#dae2fd] active:scale-95 transition shadow-sm cursor-pointer"
                onClick={() => router.push(`/talky-sheet?id=${script.id}`)}
                type="button"
                title="스크립트 시트 보기"
              >
                <span className="material-symbols-outlined text-[16px] text-[#004ac6]">description</span>
                <span className="font-label-md text-xs font-bold">스크립트</span>
              </button>

              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e2e7ff] text-[#434655] font-label-sm text-xs shadow-sm">
                <span>{nickname}님</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content (Scrollable Flow including title, avatar, and sentence card) */}
        <main className="flex-1 flex flex-col relative w-full pt-16 pb-28 bg-[#faf8ff]">
          <div className="flex flex-col w-full relative select-none gap-3 px-3">

            {/* Topic Bar */}
            <div className="pt-1 pb-0.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#fea619]/20 text-[#855300]">
                  <span className="material-symbols-outlined text-[16px]">storefront</span>
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-headline-sm text-xs sm:text-sm text-[#131b2e] truncate font-bold">{script.title}</p>
                    <span className="px-2 py-0.5 rounded-full bg-[#e2e7ff] text-[#004ac6] font-label-sm text-[10px] shrink-0 font-bold">
                      {script.category}
                    </span>
                  </div>
                  <p className="font-body-sm text-[10px] text-[#434655] truncate">
                    {mode === "listen_all" ? "전체듣기 모드 (핸즈프리)" : "발화 훈련 모드 (정밀 음성 인식)"}
                  </p>
                </div>
              </div>
            </div>

            {/* Central TalkyCat Avatar & Live Voice Aura Stage */}
            <div className="flex flex-col items-center justify-center py-1 relative">
              <div className="relative flex items-center justify-center w-32 h-32 sm:w-36 sm:h-36 my-1">
                <div className={`absolute inset-0 rounded-full bg-[#004ac6]/15 ${speaking || isListening ? "animate-ping" : ""} opacity-75`} />
                <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-[#dbe1ff]/50 via-[#fea619]/20 to-[#dae2fd]/40 blur-md" />
                
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden p-2 border-2 border-[#dbe1ff]">
                  <Image src="/talkycat-m.png" alt="TalkyCat Avatar" width={140} height={140} className="w-full h-full object-contain p-0.5" priority />
                </div>

                <div className="absolute -bottom-2 flex items-center gap-1 px-3 py-1 rounded-full bg-[#004ac6] text-white shadow-sm">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full bg-[#6ffbbe] ${speaking || isListening ? "animate-pulse" : ""}`} />
                  <span className="font-label-sm text-[11px] tracking-wide font-bold">
                    {speaking ? "토키캣 말하는 중 🐾" : isListening ? "듣고 있어요 🎙️" : "대화 준비 중 🐾"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-1 w-full mt-1.5">
                <div className="flex items-center justify-center gap-1.5 h-6 px-3 py-1 rounded-full bg-[#f2f3ff] shadow-sm">
                  <div className="w-1 rounded-full bg-[#004ac6] animate-[pulse_0.7s_infinite] h-2.5" />
                  <div className="w-1 rounded-full bg-[#004ac6] animate-[pulse_0.5s_infinite] h-4" />
                  <div className="w-1 rounded-full bg-[#004ac6] animate-[pulse_0.9s_infinite] h-2" />
                  <div className="w-1 rounded-full bg-[#2563eb] animate-[pulse_0.4s_infinite] h-5" />
                  <div className="w-1 rounded-full bg-[#004ac6] animate-[pulse_0.6s_infinite] h-3.5" />
                  <div className="w-1 rounded-full bg-[#006242] animate-[pulse_0.5s_infinite] h-3.5" />
                  <span className="font-label-sm text-[11px] text-[#434655] ml-1 font-medium">
                    {statusText}
                  </span>
                </div>

                {sttStatus === "success" && (
                  <div className="mt-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1 animate-in fade-in shadow-sm">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>완벽하다냥! 🎉 다음 단계로! 🌟</span>
                  </div>
                )}
                {recognizedText && (
                  <p className="text-[10px] text-[#434655] mt-0.5 italic text-center font-medium">
                    인식된 음성: &quot;{recognizedText}&quot;
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <button
                  className={`px-3 py-0.5 rounded-full text-[11px] font-bold shadow-sm transition active:scale-95 cursor-pointer ${
                    speed === 1.0 ? "bg-[#004ac6] text-white" : "bg-[#eaedff] text-[#434655] hover:bg-[#e2e7ff]"
                  }`}
                  onClick={() => setSpeed(1.0)}
                  type="button"
                >
                  1.0x 표준속도
                </button>
                <button
                  className={`px-3 py-0.5 rounded-full text-[11px] font-bold shadow-sm transition active:scale-95 cursor-pointer ${
                    speed === 0.8 ? "bg-[#004ac6] text-white" : "bg-[#eaedff] text-[#434655] hover:bg-[#e2e7ff]"
                  }`}
                  onClick={() => setSpeed(0.8)}
                  type="button"
                >
                  0.8x 또박또박
                </button>
              </div>
            </div>

            {/* Main Focus Card: Current Sentence Target */}
            <div className="w-full">
              <div className="relative w-full rounded-2xl bg-white shadow-md p-3.5 flex flex-col gap-2.5 overflow-hidden border border-[#eaedff]">
                
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                      isCat ? "bg-[#dbe1ff] text-[#00174b]" : "bg-[#6ffbbe]/40 text-[#002113]"
                    }`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {isCat ? "smart_toy" : "person"}
                      </span>
                      {currentLine.speakerName || (isCat ? "토키캣" : "나")}
                    </span>
                    <span className="font-label-sm text-[11px] text-[#737686] font-semibold">
                      문장 {currentTurn + 1} / {dialogueList.length}
                    </span>
                  </div>
                  <button
                    aria-label="이 문장 다시 듣기"
                    className="w-8 h-8 rounded-full bg-[#dbe1ff] flex items-center justify-center text-[#004ac6] hover:bg-[#004ac6] hover:text-white active:scale-90 transition shadow-sm cursor-pointer"
                    onClick={handleManualReplay}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">volume_up</span>
                  </button>
                </div>

                <div className="w-full bg-[#eaedff] h-1.5 rounded-full overflow-hidden flex items-center p-0.5">
                  <div
                    className="bg-[#004ac6] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="pt-0.5">
                  <h2 className="font-headline-md text-base sm:text-lg text-[#131b2e] font-bold leading-snug">
                    &quot;{currentLine.english}&quot;
                  </h2>
                </div>

                <div className="pt-1 border-t border-[#eaedff]/60 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-[11px] text-[#737686] font-medium">한국어 해석</span>
                    <button
                      className="font-label-sm text-[11px] text-[#004ac6] hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      onClick={() => setShowKorean(!showKorean)}
                      type="button"
                    >
                      <span>{showKorean ? "해석 숨기기" : "해석 보기"}</span>
                      <span className="material-symbols-outlined text-[14px]">
                        {showKorean ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {showKorean && (
                    <p className="font-body-md text-xs sm:text-sm text-[#434655] mt-1 font-medium animate-in fade-in">
                      &quot;{currentLine.korean}&quot;
                    </p>
                  )}

                  {nextLine && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-[#004ac6]/10 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#004ac6] text-[16px] shrink-0">
                        chat_bubble_outline
                      </span>
                      <div className="min-w-0 text-[11px] font-medium">
                        <span className="text-[#004ac6] font-bold">다음 대사: </span>
                        <span className="text-[#131b2e] truncate">&quot;{nextLine.english}&quot;</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        </main>

        {/* Fixed Bottom Deck: Combined Control Deck (3 buttons) & Action Buttons (4 buttons) in a single frame */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#faf8ff]/95 backdrop-blur-md border-t border-[#e2e7ff]/60 p-2 pb-safe flex items-center justify-center shadow-lg">
          <div className="w-full max-w-[480px] flex flex-col gap-2 bg-white/90 p-2.5 rounded-2xl border border-[#eaedff] shadow-sm">
            {/* Control Deck (3 buttons: 다시듣기, 마이크터치/제어, 종료) */}
            <div className="w-full rounded-xl bg-[#f2f3ff] p-2 shadow-sm flex items-center justify-around border border-[#eaedff]">
              <div className="flex flex-col items-center">
                <button
                  className="w-10 h-10 rounded-full bg-[#dae2fd] text-[#131b2e] flex items-center justify-center hover:bg-[#c3c6d7] active:scale-90 transition shadow-sm cursor-pointer"
                  onClick={handleManualReplay}
                  type="button"
                  aria-label="다시듣기"
                >
                  <span className="material-symbols-outlined text-[20px]">replay</span>
                </button>
                <span className="font-label-sm text-[10px] text-[#434655] mt-1 font-bold">다시듣기</span>
              </div>

              <div className="flex flex-col items-center">
                <button
                  className={`w-12 h-12 rounded-full ${
                    !isSpeakingMode
                      ? "bg-slate-300 cursor-not-allowed opacity-50"
                      : isListening
                      ? "bg-emerald-600 animate-pulse shadow-md shadow-emerald-600/30"
                      : "bg-[#004ac6] shadow-md shadow-[#004ac6]/30"
                  } text-white flex items-center justify-center active:scale-95 transition cursor-pointer`}
                  onClick={handleMicClick}
                  type="button"
                  aria-label="음성 인식 제어"
                  disabled={!isSpeakingMode}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {!isSpeakingMode ? "mic_off" : isListening ? "mic" : "mic"}
                  </span>
                </button>
                <span className="font-label-sm text-[10px] text-[#004ac6] font-bold mt-1" id="mic-hint-text">
                  {!isSpeakingMode
                    ? "마이크 비활성화됨"
                    : isListening
                    ? "듣고 있어요... (터치시 일시정지)"
                    : "버튼을 눌러 다시 말해보라냥! 🐾"}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <button
                  className="w-10 h-10 rounded-full bg-[#ffdad6] text-[#93000a] flex items-center justify-center hover:bg-[#ba1a1a] hover:text-white active:scale-90 transition shadow-sm cursor-pointer"
                  onClick={() => router.push("/")}
                  type="button"
                  aria-label="학습 종료"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
                <span className="font-label-sm text-[10px] text-[#93000a] mt-1 font-bold">종료</span>
              </div>
            </div>

            {/* Action Buttons (4 buttons: 전체듣기, 따라하기, 롤플레이, 역할교대) */}
            <div className="w-full grid grid-cols-4 gap-1.5">
              <button
                className={`py-2.5 px-1 rounded-xl ${
                  mode === "listen_all" ? "bg-[#004ac6] text-white shadow-md shadow-[#004ac6]/25" : "bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e]"
                } font-label-md text-[11px] font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 shadow-sm`}
                onClick={() => {
                  clearTimer();
                  teardownSTT();
                  if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  }
                  setMode("listen_all");
                  setCurrentTurn(0);
                  setShowKorean(false);
                }}
                type="button"
              >
                <span className="text-[15px]">🎧</span>
                <span>전체듣기</span>
              </button>
              <button
                className={`py-2.5 px-1 rounded-xl ${
                  mode === "shadowing" ? "bg-[#004ac6] text-white shadow-md shadow-[#004ac6]/25" : "bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e]"
                } font-label-md text-[11px] font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 shadow-sm`}
                onClick={() => {
                  clearTimer();
                  teardownSTT();
                  if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  }
                  setMode("shadowing");
                  setCurrentTurn(0);
                  setShowKorean(false);
                }}
                type="button"
              >
                <span className="text-[15px]">🗣️</span>
                <span>따라하기</span>
              </button>
              <button
                className={`py-2.5 px-1 rounded-xl ${
                  mode === "roleplay" ? "bg-[#004ac6] text-white shadow-md shadow-[#004ac6]/25" : "bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e]"
                } font-label-md text-[11px] font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 shadow-sm`}
                onClick={() => {
                  clearTimer();
                  teardownSTT();
                  if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  }
                  setMode("roleplay");
                  setCurrentTurn(0);
                  setShowKorean(false);
                }}
                type="button"
              >
                <span className="text-[15px]">🎭</span>
                <span>롤플레이</span>
              </button>
              <button
                className={`py-2.5 px-1 rounded-xl ${
                  mode === "role_switch" ? "bg-[#004ac6] text-white shadow-md shadow-[#004ac6]/25" : "bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e]"
                } font-label-md text-[11px] font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 shadow-sm`}
                onClick={() => {
                  clearTimer();
                  teardownSTT();
                  if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  }
                  setMode("role_switch");
                  setCurrentTurn(0);
                  setShowKorean(false);
                }}
                type="button"
              >
                <span className="text-[15px]">🔄</span>
                <span>역할교대</span>
              </button>
            </div>
          </div>
        </div>

        {/* MODAL: Celebratory Feedback Completion Modal */}
        {isFeedbackModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-[380px] bg-white rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center gap-4 animate-in zoom-in-95">
              <div className="w-20 h-20 rounded-full bg-[#ffddb8] flex items-center justify-center text-[#855300] text-4xl shadow-inner animate-bounce">
                🏆
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-headline-md text-xl font-bold text-[#131b2e]">
                  미션 완료 축하해요냥! 🎉
                </h3>
                <p className="font-body-sm text-xs text-[#737686]">
                  모든 대화 턴을 훌륭하게 완수했습니다. 보관함에 완료 횟수가 반영되었어요!
                </p>
              </div>

              <div className="w-full bg-[#f2f3ff] rounded-2xl p-4 flex flex-col gap-2 border border-[#eaedff]">
                <div className="flex justify-between text-xs text-[#434655]">
                  <span>완료된 문장</span>
                  <span className="font-bold text-[#004ac6]">{dialogueList.length}문장</span>
                </div>
                <div className="flex justify-between text-xs text-[#434655]">
                  <span>학습 성취도</span>
                  <span className="font-bold text-[#007d55]">100% 🌟</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 w-full pt-2">
                <button
                  className="w-full py-3 rounded-2xl bg-[#004ac6] text-white font-label-md text-sm font-bold shadow-md hover:bg-[#2563eb] transition cursor-pointer"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  type="button"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function TalkyRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-[#004ac6] border-t-transparent animate-spin" />
        </div>
      }
    >
      <TalkyRoomContent />
    </Suspense>
  );
}
