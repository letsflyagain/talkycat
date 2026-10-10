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
  const wakeLockRef = useRef<any>(null);
  const currentSessionIdRef = useRef<number>(0);

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
          console.warn("Wake Lock request failed:", err);
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

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

  const resetLearningSession = useCallback(() => {
    currentSessionIdRef.current += 1;
    clearTimer();
    teardownSTT();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setSttStatus("idle");
    setRecognizedText("");
    setShowKorean(false);
  }, [teardownSTT]);

  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  };

  const checkMatch = (spoken: string, target: string, isFinal: boolean = false) => {
    const normSpoken = normalizeText(spoken);
    const normTarget = normalizeText(target);
    if (!normSpoken || !normTarget) return false;

    const targetWords = normTarget.split(/\s+/);
    const spokenWords = normSpoken.split(/\s+/);

    // Minimum word count validation guard: at least 70% of target words count unless final with high match
    const minRequiredWords = Math.max(1, Math.floor(targetWords.length * 0.7));
    if (spokenWords.length < minRequiredWords && !isFinal) {
      return false;
    }

    if (normTarget.includes(normSpoken) || normSpoken.includes(normTarget)) {
      if (spokenWords.length >= minRequiredWords || isFinal) return true;
    }

    // Full match rate
    let matches = 0;
    for (const w of targetWords) {
      if (spokenWords.includes(w)) matches++;
    }
    const fullMatchRate = matches / Math.max(1, targetWords.length);

    // First-word drop tolerance match rate (omitting first word if target has >= 2 words)
    let subMatchRate = 0;
    if (targetWords.length > 1) {
      const subTargetWords = targetWords.slice(1);
      let subMatches = 0;
      for (const w of subTargetWords) {
        if (spokenWords.includes(w)) subMatches++;
      }
      subMatchRate = subMatches / Math.max(1, subTargetWords.length);
    }

    return (fullMatchRate >= 0.7 || subMatchRate >= 0.65) && (spokenWords.length >= minRequiredWords || isFinal);
  };

  const stopListening = useCallback(() => {
    teardownSTT();
    setSttStatus("idle");
    setStatusText("음성 인식이 일시중지되었습니다. 다시 누르면 시작합니다. 🐾");
  }, [teardownSTT]);

  const handleMissionComplete = useCallback((totalSentences: number, sessionId: number) => {
    if (sessionId !== currentSessionIdRef.current) return;
    setStatusText("미션 완료! 🐾");
    setIsFeedbackModalOpen(true);
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

      const todaySent = Number(localStorage.getItem("talkycat_today_sentences") || "0") + totalSentences;
      localStorage.setItem("talkycat_today_sentences", todaySent.toString());
    } catch (e) {
      console.error("Failed to save session completion", e);
    }
  }, [script]);

  const handleFullNextTurn = useCallback((finishedTurn: number, dialogueList: DialogueLine[], sessionId: number) => {
    if (sessionId !== currentSessionIdRef.current) return;
    if (finishedTurn < dialogueList.length - 1) {
      setStatusText("1.5초 후 다음 문장으로 이동합니다... 🐾");
      timerRef.current = setTimeout(() => {
        if (sessionId !== currentSessionIdRef.current) return;
        setCurrentTurn(finishedTurn + 1);
        setShowKorean(false);
      }, 1500);
    } else {
      handleMissionComplete(dialogueList.length, sessionId);
    }
  }, [handleMissionComplete]);

  const evaluateSpeech = useCallback((transcript: string, isFinal: boolean = false) => {
    const sessionId = currentSessionIdRef.current;
    if (!script || !script.dialogue) return;
    const dialogueList = script.dialogue;
    const currentLine = dialogueList[currentTurn];
    const target = currentLine?.english || "";

    if (checkMatch(transcript, target, isFinal)) {
      teardownSTT();
      setSttStatus("success");
      setIsListening(false);
      setStatusText("완벽하다냥! 🎉");

      // Sentence transition buffer: 1.5 seconds delay before moving to next step / turn
      timerRef.current = setTimeout(() => {
        if (sessionId !== currentSessionIdRef.current) return;
        if (currentTurn < dialogueList.length - 1) {
          setCurrentTurn((prev) => prev + 1);
          setShowKorean(false);
          setSttStatus("idle");
          setRecognizedText("");
          latestTranscriptRef.current = "";
        } else {
          handleMissionComplete(dialogueList.length, sessionId);
        }
      }, 1500);
    }
  }, [script, currentTurn, teardownSTT, handleMissionComplete]);

  const startListeningImmediate = useCallback(() => {
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
        setStatusText("지금 말해보라냥! 🎙️");
      } catch (e) {
        console.warn("Recognition start error:", e);
        isRecognizingRef.current = false;
        setIsListening(false);
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSpeakingMode && mode === "listen_all") return;
    startListeningImmediate();
  }, [isSpeakingMode, mode, startListeningImmediate]);

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

        // Silence debounce fallback (1.8s) for breathing and natural pauses
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (isRecognizingRef.current && currentTranscript) {
            evaluateSpeech(currentTranscript, false);
          }
        }, 1800);

        if (finalTranscript) {
          evaluateSpeech(finalTranscript, true);
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

      // Fallback mock script with 8 turns for rich Tiki-Taka roleplay
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
          { id: 3, speaker: "user", speakerName: "나 (손님)", english: "I'd like a bottle of cold water, please.", korean: "시원한 생수 한 병 주세요." },
          { id: 4, speaker: "cat", speakerName: "토키캣 (점원)", english: "It's right over there in aisle 3, next to the cold drinks!", korean: "3번 통로 저기 바로 옆, 시원한 음료 코너 쪽에 있어요!" },
          { id: 5, speaker: "user", speakerName: "나 (손님)", english: "Got it! How much is this one?", korean: "알겠습니다! 이건 얼마인가요?" },
          { id: 6, speaker: "cat", speakerName: "토키캣 (점원)", english: "That will be 1,500 won. Anything else you need?", korean: "1,500원입니다. 다른 필요한 거 있으신가요?" },
          { id: 7, speaker: "user", speakerName: "나 (손님)", english: "No, that's all. Can I pay by card?", korean: "아니요, 이게 다예요. 카드 결제 되나요?" },
          { id: 8, speaker: "cat", speakerName: "토키캣 (점원)", english: "Sure, insert your card right here. Thank you!", korean: "네, 여기에 카드 넣어주세요. 감사합니다!" }
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
      setTimeout(() => {
        speak();
      }, 300);
    }
  }, [speed, selectedVoice, teardownSTT]);

  // Main playback & timing control flow with Session ID (Run Token)
  useEffect(() => {
    const sessionId = currentSessionIdRef.current;
    clearTimer();
    teardownSTT();
    setSttStatus("idle");
    setRecognizedText("");
    latestTranscriptRef.current = "";

    if (!script || !script.dialogue) return;
    const dialogueList = script.dialogue;
    if (currentTurn >= dialogueList.length) return;

    const currentLine = dialogueList[currentTurn];
    let effectiveSpeaker = currentLine.speaker;
    if (mode === "role_switch") {
      effectiveSpeaker = currentLine.speaker === "cat" ? "user" : "cat";
    }

    if (mode === "listen_all") {
      if (currentTurn === 0) {
        setStatusText("1.5초 후 전체듣기가 시작됩니다... 🐾");
        timerRef.current = setTimeout(() => {
          if (sessionId !== currentSessionIdRef.current) return;
          speakCurrentLine(currentLine.english, () => {
            if (sessionId !== currentSessionIdRef.current) return;
            handleFullNextTurn(currentTurn, dialogueList, sessionId);
          });
        }, 1500);
      } else {
        speakCurrentLine(currentLine.english, () => {
          if (sessionId !== currentSessionIdRef.current) return;
          handleFullNextTurn(currentTurn, dialogueList, sessionId);
        });
      }
    } else if (mode === "shadowing") {
      setStatusText("1.5초 후 발화 준비... 🐾");
      timerRef.current = setTimeout(() => {
        if (sessionId !== currentSessionIdRef.current) return;
        speakCurrentLine(currentLine.english, () => {
          if (sessionId !== currentSessionIdRef.current) return;
          setIsListening(true);
          setSttStatus("listening");
          setStatusText("지금 말해보라냥! 🎙️");
          setTimeout(() => {
            if (sessionId !== currentSessionIdRef.current) return;
            startListeningImmediate();
          }, 300);
        });
      }, 1500);
    } else {
      // Roleplay or Role Switch (Tiki-Taka Turn-Based Mode)
      if (effectiveSpeaker === "cat") {
        // System (TalkyCat) Turn
        setStatusText("1.5초 후 토키캣이 대화합니다... 🐾");
        timerRef.current = setTimeout(() => {
          if (sessionId !== currentSessionIdRef.current) return;
          speakCurrentLine(currentLine.english, () => {
            if (sessionId !== currentSessionIdRef.current) return;
            const nextIdx = currentTurn + 1;
            if (nextIdx < dialogueList.length) {
              const nextLine = dialogueList[nextIdx];
              let nextEffectiveSpeaker = nextLine.speaker;
              if (mode === "role_switch") {
                nextEffectiveSpeaker = nextLine.speaker === "cat" ? "user" : "cat";
              }

              if (nextEffectiveSpeaker === "user") {
                if (sessionId !== currentSessionIdRef.current) return;
                setCurrentTurn(nextIdx);
                setShowKorean(false);
                setIsListening(true);
                setSttStatus("listening");
                setStatusText("지금 말해보라냥! 🎙️");

                timerRef.current = setTimeout(() => {
                  if (sessionId !== currentSessionIdRef.current) return;
                  startListeningImmediate();
                }, 300);
              } else {
                setStatusText("1.5초 후 다음 턴으로 전환됩니다... 🐾");
                timerRef.current = setTimeout(() => {
                  if (sessionId !== currentSessionIdRef.current) return;
                  setCurrentTurn(nextIdx);
                  setShowKorean(false);
                }, 1500);
              }
            } else {
              handleMissionComplete(dialogueList.length, sessionId);
            }
          });
        }, 1500);
      } else {
        // User Turn (at index 0 or when starting)
        setStatusText("내 차례다냥! 1.5초 후 마이크가 켜집니다 🎙️");
        timerRef.current = setTimeout(() => {
          if (sessionId !== currentSessionIdRef.current) return;
          setIsListening(true);
          setSttStatus("listening");
          setStatusText("지금 말해보라냥! 🎙️");
          timerRef.current = setTimeout(() => {
            if (sessionId !== currentSessionIdRef.current) return;
            startListeningImmediate();
          }, 300);
        }, 1500);
      }
    }
  }, [currentTurn, script, mode, speakCurrentLine, startListeningImmediate, handleMissionComplete, handleFullNextTurn, teardownSTT]);

  const handleManualReplay = () => {
    const sessionId = currentSessionIdRef.current;
    clearTimer();
    teardownSTT();
    if (!script || !script.dialogue) return;
    const currentLine = script.dialogue[currentTurn];
    let effectiveSpeaker = currentLine.speaker;
    if (mode === "role_switch") {
      effectiveSpeaker = currentLine.speaker === "cat" ? "user" : "cat";
    }

    if (mode === "listen_all" || mode === "shadowing" || effectiveSpeaker === "cat") {
      speakCurrentLine(currentLine.english, () => {
        if (sessionId !== currentSessionIdRef.current) return;
        if (mode === "listen_all") {
          handleFullNextTurn(currentTurn, script.dialogue, sessionId);
        } else if (mode === "shadowing") {
          setIsListening(true);
          setSttStatus("listening");
          setStatusText("지금 말해보라냥! 🎙️");
          setTimeout(() => {
            if (sessionId !== currentSessionIdRef.current) return;
            startListeningImmediate();
          }, 300);
        }
      });
    } else {
      setIsListening(true);
      setSttStatus("listening");
      setStatusText("지금 말해보라냥! 🎙️");
      setTimeout(() => {
        if (sessionId !== currentSessionIdRef.current) return;
        startListeningImmediate();
      }, 300);
    }
  };

  const handleMicClick = () => {
    if (!isSpeakingMode && mode === "listen_all") {
      setStatusText("전체듣기 모드에서는 마이크를 사용할 수 없습니다 🎧");
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleModeChange = (newMode: LearningMode) => {
    if (newMode === mode) return;
    resetLearningSession();
    setMode(newMode);
    const sessionId = currentSessionIdRef.current;
    setTimeout(() => {
      if (sessionId !== currentSessionIdRef.current) return;
      setCurrentTurn(0);
    }, 200);
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
  const nextLine = dialogueList[currentTurn + 1];

  // Dynamic Speaker Determination based on mode and speech state
  const isUserActiveState = mode !== "listen_all" && isListening;
  const speakerBadgeLabel = isUserActiveState
    ? `${nickname} (${currentLine.speakerName && currentLine.speakerName.includes("손님") ? "손님" : "나"})`
    : `토키캣 (${currentLine.speakerName && (currentLine.speakerName.includes("점원") || currentLine.speakerName.includes("토키캣")) ? currentLine.speakerName : "시스템"})`;
  const speakerBadgeIcon = isUserActiveState ? "mic" : "smart_toy";
  const speakerBadgeStyle = isUserActiveState
    ? "bg-[#6ffbbe]/40 text-[#002113]"
    : "bg-[#dbe1ff] text-[#00174b]";

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col items-center justify-start relative select-none">
      <div className="w-full max-w-[480px] min-h-screen bg-[#faf8ff] relative shadow-xl border-x border-[#eaedff]/60 flex flex-col pb-72">
        
        {/* Top Header */}
        <header className="fixed top-0 w-full max-w-[480px] z-40 pt-safe bg-[#faf8ff]/90 backdrop-blur-md border-b border-[#eaedff]">
          <div className="h-16 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="w-10 h-10 rounded-full bg-[#eaedff] hover:bg-[#e2e7ff] text-[#131b2e] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                onClick={() => router.replace("/")}
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

        {/* Main Content */}
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
                    {mode === "listen_all" && "전체듣기 모드 (핸즈프리)"}
                    {mode === "shadowing" && "따라하기 훈련 모드"}
                    {mode === "roleplay" && "롤플레이 턴제 대화 모드 (티키타카)"}
                    {mode === "role_switch" && "역할교대 턴제 대화 모드 (반대 역할)"}
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
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${speakerBadgeStyle}`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {speakerBadgeIcon}
                      </span>
                      {speakerBadgeLabel}
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

        {/* Fixed Bottom Deck: Combined Control Deck (3 buttons) & Action Buttons (4 buttons) */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#faf8ff]/95 backdrop-blur-md border-t border-[#e2e7ff]/60 p-2 pb-safe flex items-center justify-center shadow-lg">
          <div className="w-full max-w-[480px] flex flex-col gap-2 bg-white/90 p-2.5 rounded-2xl border border-[#eaedff] shadow-sm">
            {/* Control Deck (3 buttons) */}
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
                    !isSpeakingMode && mode === "listen_all"
                      ? "bg-slate-300 cursor-not-allowed opacity-50"
                      : isListening
                      ? "bg-emerald-600 animate-pulse shadow-md shadow-emerald-600/30"
                      : "bg-[#004ac6] shadow-md shadow-[#004ac6]/30"
                  } text-white flex items-center justify-center active:scale-95 transition cursor-pointer`}
                  onClick={handleMicClick}
                  type="button"
                  aria-label="음성 인식 제어"
                  disabled={!isSpeakingMode && mode === "listen_all"}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {!isSpeakingMode && mode === "listen_all" ? "mic_off" : isListening ? "mic" : "mic"}
                  </span>
                </button>
                <span className="font-label-sm text-[10px] text-[#004ac6] font-bold mt-1" id="mic-hint-text">
                  {!isSpeakingMode && mode === "listen_all"
                    ? "마이크 비활성화됨"
                    : isListening
                    ? "듣고 있어요... (터치시 일시정지)"
                    : "버튼을 눌러 다시 말해보라냥! 🐾"}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <button
                  className="w-10 h-10 rounded-full bg-[#ffdad6] text-[#93000a] flex items-center justify-center hover:bg-[#ba1a1a] hover:text-white active:scale-90 transition shadow-sm cursor-pointer"
                  onClick={() => router.replace("/")}
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
                onClick={() => handleModeChange("listen_all")}
                type="button"
              >
                <span className="text-[15px]">🎧</span>
                <span>전체듣기</span>
              </button>
              <button
                className={`py-2.5 px-1 rounded-xl ${
                  mode === "shadowing" ? "bg-[#004ac6] text-white shadow-md shadow-[#004ac6]/25" : "bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e]"
                } font-label-md text-[11px] font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 shadow-sm`}
                onClick={() => handleModeChange("shadowing")}
                type="button"
              >
                <span className="text-[15px]">🗣️</span>
                <span>따라하기</span>
              </button>
              <button
                className={`py-2.5 px-1 rounded-xl ${
                  mode === "roleplay" ? "bg-[#004ac6] text-white shadow-md shadow-[#004ac6]/25" : "bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e]"
                } font-label-md text-[11px] font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 shadow-sm`}
                onClick={() => handleModeChange("roleplay")}
                type="button"
              >
                <span className="text-[15px]">🎭</span>
                <span>롤플레이</span>
              </button>
              <button
                className={`py-2.5 px-1 rounded-xl ${
                  mode === "role_switch" ? "bg-[#004ac6] text-white shadow-md shadow-[#004ac6]/25" : "bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e]"
                } font-label-md text-[11px] font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 shadow-sm`}
                onClick={() => handleModeChange("role_switch")}
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
                  onClick={() => {
                    setIsFeedbackModalOpen(false);
                  }}
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
