"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { GeneratedScript, DialogueLine } from "@/types/script";

function TalkyRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [nickname, setNickname] = useState("지은");
  const [currentTurn, setCurrentTurn] = useState(0);
  const [speed, setSpeed] = useState<number>(1.0);
  const [showKorean, setShowKorean] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [speaking, setSpeaking] = useState(false);

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

  const speakCurrentLine = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = speed;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [speed]);

  useEffect(() => {
    if (script && script.dialogue && script.dialogue[currentTurn]) {
      speakCurrentLine(script.dialogue[currentTurn].english);
    }
  }, [currentTurn, script, speakCurrentLine]);

  const handleNextTurn = () => {
    if (!script || !script.dialogue) return;
    if (currentTurn < script.dialogue.length - 1) {
      setCurrentTurn(currentTurn + 1);
      setShowKorean(false);
    } else {
      setIsFeedbackModalOpen(true);
      handleCompleteSession();
    }
  };

  const handleCompleteSession = () => {
    if (!script) return;
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
  };

  const handleMicClick = () => {
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      handleNextTurn();
    }, 1500);
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
      <div className="w-full max-w-[480px] min-h-screen bg-[#faf8ff] relative shadow-xl border-x border-[#eaedff]/60 flex flex-col pb-28">
        
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

        {/* Main Content (Scrollable Flow including title, avatar, sentence card, and control deck) */}
        <main className="flex-1 flex flex-col relative w-full pt-20 pb-8 bg-[#faf8ff]">
          <div className="flex flex-col w-full relative select-none gap-4 px-4">

            {/* Topic Bar */}
            <div className="pt-2 pb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#fea619]/20 text-[#855300]">
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-headline-sm text-sm text-[#131b2e] truncate font-bold">{script.title}</p>
                    <span className="px-2 py-0.5 rounded-full bg-[#e2e7ff] text-[#004ac6] font-label-sm text-[10px] shrink-0 font-bold">
                      {script.category}
                    </span>
                  </div>
                  <p className="font-body-sm text-[11px] text-[#434655] truncate">롤플레이 실전 음성 훈련</p>
                </div>
              </div>
            </div>

            {/* Central TalkyCat Avatar & Live Voice Aura Stage */}
            <div className="flex flex-col items-center justify-center py-2 relative">
              <div className="relative flex items-center justify-center w-44 h-44 my-2">
                <div className={`absolute inset-0 rounded-full bg-[#004ac6]/15 ${speaking || isListening ? "animate-ping" : ""} opacity-75`} />
                <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-[#dbe1ff]/50 via-[#fea619]/20 to-[#dae2fd]/40 blur-lg" />
                
                <div className="relative w-40 h-40 rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden p-2.5 border-3 border-[#dbe1ff]">
                  <Image src="/talkycat-m.png" alt="TalkyCat Avatar" width={160} height={160} className="w-full h-full object-contain p-1" priority />
                </div>

                <div className="absolute -bottom-2.5 flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#004ac6] text-white shadow-md">
                  <span className={`inline-block w-2 h-2 rounded-full bg-[#6ffbbe] ${speaking ? "animate-pulse" : ""}`} />
                  <span className="font-label-sm text-xs tracking-wide font-bold">
                    {speaking ? "토키캣 말하는 중 🐾" : isListening ? "듣고 있어요 🎙️" : "대화 준비 중 🐾"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 h-7 mt-4 px-4 py-1.5 rounded-full bg-[#f2f3ff] shadow-sm">
                <div className="w-1 rounded-full bg-[#004ac6] animate-[pulse_0.7s_infinite] h-3" />
                <div className="w-1 rounded-full bg-[#004ac6] animate-[pulse_0.5s_infinite] h-5" />
                <div className="w-1 rounded-full bg-[#004ac6] animate-[pulse_0.9s_infinite] h-2" />
                <div className="w-1 rounded-full bg-[#2563eb] animate-[pulse_0.4s_infinite] h-6" />
                <div className="w-1 rounded-full bg-[#004ac6] animate-[pulse_0.6s_infinite] h-4" />
                <div className="w-1 rounded-full bg-[#006242] animate-[pulse_0.5s_infinite] h-4" />
                <span className="font-label-sm text-xs text-[#434655] ml-1.5 font-medium">
                  {isListening ? "말씀하세요, 음성 인식 중... 🎙️" : "편하게 듣고 따라해보세요냥 🐾"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-3">
                <button
                  className={`px-3.5 py-1 rounded-full text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer ${
                    speed === 1.0 ? "bg-[#004ac6] text-white" : "bg-[#eaedff] text-[#434655] hover:bg-[#e2e7ff]"
                  }`}
                  onClick={() => setSpeed(1.0)}
                  type="button"
                >
                  1.0x 표준속도
                </button>
                <button
                  className={`px-3.5 py-1 rounded-full text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer ${
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
              <div className="relative w-full rounded-2xl bg-white shadow-md p-4 flex flex-col gap-3 overflow-hidden border border-[#eaedff]">
                
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      isCat ? "bg-[#dbe1ff] text-[#00174b]" : "bg-[#6ffbbe]/40 text-[#002113]"
                    }`}>
                      <span className="material-symbols-outlined text-[15px]">
                        {isCat ? "smart_toy" : "person"}
                      </span>
                      {currentLine.speakerName || (isCat ? "토키캣" : "나")}
                    </span>
                    <span className="font-label-sm text-xs text-[#737686] font-semibold">
                      문장 {currentTurn + 1} / {dialogueList.length}
                    </span>
                  </div>
                  <button
                    aria-label="이 문장 다시 듣기"
                    className="w-10 h-10 rounded-full bg-[#dbe1ff] flex items-center justify-center text-[#004ac6] hover:bg-[#004ac6] hover:text-white active:scale-90 transition shadow-sm cursor-pointer"
                    onClick={() => speakCurrentLine(currentLine.english)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[22px]">volume_up</span>
                  </button>
                </div>

                <div className="w-full bg-[#eaedff] h-2 rounded-full overflow-hidden flex items-center p-0.5">
                  <div
                    className="bg-[#004ac6] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="pt-1">
                  <h2 className="font-headline-md text-lg text-[#131b2e] font-bold leading-snug">
                    &quot;{currentLine.english}&quot;
                  </h2>
                </div>

                <div className="pt-1 border-t border-[#eaedff]/60 pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-xs text-[#737686] font-medium">한국어 해석</span>
                    <button
                      className="font-label-sm text-xs text-[#004ac6] hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      onClick={() => setShowKorean(!showKorean)}
                      type="button"
                    >
                      <span>{showKorean ? "해석 숨기기" : "해석 보기"}</span>
                      <span className="material-symbols-outlined text-[16px]">
                        {showKorean ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {showKorean && (
                    <p className="font-body-md text-sm text-[#434655] mt-1.5 font-medium animate-in fade-in">
                      &quot;{currentLine.korean}&quot;
                    </p>
                  )}

                  {nextLine && (
                    <div className="mt-3 p-3 rounded-xl bg-[#004ac6]/10 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#004ac6] text-[18px] shrink-0">
                        chat_bubble_outline
                      </span>
                      <div className="min-w-0 text-xs font-medium">
                        <span className="text-[#004ac6] font-bold">다음 대사: </span>
                        <span className="text-[#131b2e] truncate">&quot;{nextLine.english}&quot;</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Control Deck (In-flow with content: 다시듣기, 마이크터치, 종료) */}
            <div className="w-full">
              <div className="w-full rounded-2xl bg-[#f2f3ff] p-4 shadow-sm flex items-center justify-around border border-[#eaedff]">
                <div className="flex flex-col items-center">
                  <button
                    className="w-12 h-12 rounded-full bg-[#dae2fd] text-[#131b2e] flex items-center justify-center hover:bg-[#c3c6d7] active:scale-90 transition shadow-sm cursor-pointer"
                    onClick={() => speakCurrentLine(currentLine.english)}
                    type="button"
                    aria-label="다시듣기"
                  >
                    <span className="material-symbols-outlined text-[24px]">replay</span>
                  </button>
                  <span className="font-label-sm text-xs text-[#434655] mt-1.5 font-bold">다시듣기</span>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    className={`w-14 h-14 rounded-full ${
                      isListening ? "bg-emerald-600 animate-pulse" : "bg-[#004ac6]"
                    } text-white shadow-lg shadow-[#004ac6]/30 flex items-center justify-center active:scale-95 transition cursor-pointer`}
                    onClick={handleMicClick}
                    type="button"
                    aria-label="음성 녹음 및 말하기"
                  >
                    <span className="material-symbols-outlined text-[26px]">
                      {isListening ? "mic_off" : "mic"}
                    </span>
                  </button>
                  <span className="font-label-sm text-xs text-[#004ac6] font-bold mt-1" id="mic-hint-text">
                    {isListening ? "듣고 있어요..." : "마이크 터치"}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#93000a] flex items-center justify-center hover:bg-[#ba1a1a] hover:text-white active:scale-90 transition shadow-sm cursor-pointer"
                    onClick={() => router.push("/")}
                    type="button"
                    aria-label="학습 종료"
                  >
                    <span className="material-symbols-outlined text-[22px]">logout</span>
                  </button>
                  <span className="font-label-sm text-xs text-[#93000a] mt-1.5 font-bold">종료</span>
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* Fixed Bottom Deck: Only the 4 Enlarged Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#faf8ff]/95 backdrop-blur-md border-t border-[#e2e7ff]/60 p-3 pb-safe flex items-center justify-center">
          <div className="w-full max-w-[480px] grid grid-cols-4 gap-2">
            <button
              className="py-3.5 px-1 rounded-2xl bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e] font-label-md text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-sm"
              onClick={() => speakCurrentLine(currentLine.english)}
              type="button"
            >
              <span className="text-[17px]">🎧</span>
              <span>전체듣기</span>
            </button>
            <button
              className="py-3.5 px-1 rounded-2xl bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e] font-label-md text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-sm"
              onClick={handleMicClick}
              type="button"
            >
              <span className="text-[17px]">🗣️</span>
              <span>따라하기</span>
            </button>
            <button
              className="py-3.5 px-1 rounded-2xl bg-[#004ac6] hover:bg-[#2563eb] text-white font-label-md text-xs font-bold whitespace-nowrap shadow-md shadow-[#004ac6]/25 active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-1"
              type="button"
            >
              <span className="text-[17px]">🎭</span>
              <span>롤플레이</span>
            </button>
            <button
              className="py-3.5 px-1 rounded-2xl bg-[#eaedff] hover:bg-[#e2e7ff]/80 text-[#131b2e] font-label-md text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-sm"
              onClick={handleNextTurn}
              type="button"
            >
              <span className="text-[17px]">🔄</span>
              <span>역할교대</span>
            </button>
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
                  onClick={() => router.push(`/talky-sheet?id=${script.id}`)}
                  type="button"
                >
                  스크립트 시트로 돌아가기
                </button>
                <button
                  className="w-full py-3 rounded-2xl bg-[#eaedff] text-[#131b2e] font-label-md text-sm font-semibold hover:bg-[#e2e7ff] transition cursor-pointer"
                  onClick={() => router.push("/")}
                  type="button"
                >
                  메인 화면으로 가기
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
