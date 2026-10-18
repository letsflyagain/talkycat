"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { GeneratedScript, DialogueLine, UserLevel } from "@/types/script";
import NicknameModal from "@/components/NicknameModal";

function TalkySheetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [nickname, setNickname] = useState("사용자");
  const [userLevel, setUserLevel] = useState<UserLevel>("A1");
  const [streakGoal, setStreakGoal] = useState(7);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);

  const isMounted = typeof window !== "undefined";
  const [speakingLineId, setSpeakingLineId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bottom Sheet State
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [selectedDialogueItem, setSelectedDialogueItem] = useState<DialogueLine | null>(null);
  const [bottomSheetLoading, setBottomSheetLoading] = useState(false);
  const [bottomSheetSummary, setBottomSheetSummary] = useState("");
  const [bottomSheetItems, setBottomSheetItems] = useState<{ en: string; ko: string }[]>([]);
  const [customQuestionInput, setCustomQuestionInput] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const loadScriptData = useCallback(() => {
    try {
      const savedNickname = localStorage.getItem("talkycat_nickname");
      if (savedNickname) setNickname(savedNickname);
      const savedLevel = localStorage.getItem("talkycat_user_level") as UserLevel;
      if (savedLevel) setUserLevel(savedLevel);
      const savedGoal = localStorage.getItem("talkycat_streak_goal");
      if (savedGoal) setStreakGoal(Number(savedGoal));

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

      // Fallback mock script matching Stitch design
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
          tip: "'s'는 묵음이에요! '아일'이라고 읽어보세요. 🐾"
        },
        catTip: "점원을 부를 땐 'Excuse me'로 부드럽게 시작해보라냥! 🐾",
        dialogue: [
          { id: 1, speaker: "user", speakerName: "나 (손님)", english: "Excuse me, where can I find the bottled water?", korean: "실례합니다, 생수는 어디에 있나요?" },
          { id: 2, speaker: "cat", speakerName: "토키캣 (점원)", english: "Are you looking for cold water or room temperature water?", korean: "찬물 찾으세요, 상온 물 찾으세요?" },
          { id: 3, speaker: "cat", speakerName: "토키캣 (점원)", english: "It's right over there in aisle 3, next to the cold drinks!", korean: "3번 통로 저기 바로 옆, 시원한 음료 코너 쪽에 있어요!" },
          { id: 4, speaker: "user", speakerName: "나 (손님)", english: "Oh, perfect! How much is this one?", korean: "아, 딱 좋네요! 이 매운 건 얼마예요?" },
          { id: 5, speaker: "cat", speakerName: "토키캣 (점원)", english: "That one is two dollars, and it's buy one get one free today!", korean: "그건 2달러인데, 오늘 1+1 행사 중이에요!" },
          { id: 6, speaker: "user", speakerName: "나 (손님)", english: "Awesome, I'll take two then! Can I pay by card?", korean: "좋네요, 그럼 두 개 살게요! 카드로 결제되나요?" },
          { id: 7, speaker: "cat", speakerName: "토키캣 (점원)", english: "Sure thing! Just tap your card on the reader here.", korean: "물론이죠! 여기 리더기에 카드를 터치해 주세요." },
          { id: 8, speaker: "user", speakerName: "나 (손님)", english: "Thank you so much! Have a great day.", korean: "정말 감사합니다! 좋은 하루 보내세요." }
        ],
        completedCount: 0
      };
      setScript(fallback);
    } catch (e) {
      console.error("Failed to load script in TalkySheet", e);
    }
  }, [id]);

  useEffect(() => {
    loadScriptData();
  }, [loadScriptData]);

  const handleSaveProfile = (newNickname: string, newGoal: number, newLevel: UserLevel) => {
    setNickname(newNickname);
    setStreakGoal(newGoal);
    setUserLevel(newLevel);
    try {
      localStorage.setItem("talkycat_nickname", newNickname);
      localStorage.setItem("talkycat_streak_goal", newGoal.toString());
      localStorage.setItem("talkycat_user_level", newLevel);
    } catch (e) {
      console.error("Failed to save profile", e);
    }
  };

  const handleSpeakEnglish = (text: string, lineId: number, index: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("이 브라우저는 음성 재생을 지원하지 않습니다.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;

    utterance.onstart = () => {
      setSpeakingLineId(lineId);
      showToast(`Step #${index + 1} 문장 음성을 재생합니다 🔊`);
    };
    utterance.onend = () => setSpeakingLineId(null);
    utterance.onerror = () => setSpeakingLineId(null);

    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakItem = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showToast("이 브라우저는 음성 재생을 지원하지 않습니다.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
    showToast("영문 발음을 재생한다냥! 🔊");
  };

  const fetchExplanation = async (qType: "alternative" | "nuance" | "pronunciation" | "custom", customText?: string) => {
    if (!script || !selectedDialogueItem) return;
    setBottomSheetLoading(true);
    setBottomSheetSummary("");
    setBottomSheetItems([]);

    try {
      const res = await fetch("/api/explain-dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptTitle: script.title,
          targetEnglish: selectedDialogueItem.english,
          targetKorean: selectedDialogueItem.korean,
          questionType: qType,
          customQuestion: customText || customQuestionInput
        })
      });
      const data = await res.json();
      if (data.success) {
        setBottomSheetSummary(data.summary || "토키캣의 코칭 답변이다냥! 🐾");
        setBottomSheetItems(Array.isArray(data.items) ? data.items : []);
      } else {
        setBottomSheetSummary("토키캣이 졸고 있나 보다냥, 다시 물어봐달라냥! 🐾");
        setBottomSheetItems([{ en: selectedDialogueItem.english, ko: "잠시 후 다시 시도해달라냥." }]);
      }
    } catch (e) {
      console.error("Failed to fetch explanation", e);
      setBottomSheetSummary("토키캣이 졸고 있나 보다냥, 다시 물어봐달라냥! 🐾");
      setBottomSheetItems([{ en: selectedDialogueItem.english, ko: "네트워크 연결을 확인해달라냥." }]);
    } finally {
      setBottomSheetLoading(false);
    }
  };

  const handleOpenBottomSheet = (item: DialogueLine) => {
    setSelectedDialogueItem(item);
    setIsBottomSheetOpen(true);
    setBottomSheetSummary("");
    setBottomSheetItems([]);
    setCustomQuestionInput("");
  };

  const handleStartRoleplay = () => {
    if (script) {
      showToast("롤플레이 룸으로 이동합니다 🚀");
      setTimeout(() => {
        router.push(`/talky-room?id=${script.id}`);
      }, 500);
    } else {
      router.push("/talky-room");
    }
  };

  if (!isMounted || !script) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#004ac6] border-t-transparent animate-spin" />
      </div>
    );
  }

  const pronTip = script.pronunciationTip || (script.pronunciationTips && script.pronunciationTips[0]) || {
    word: "aisle",
    phonetic: "[aɪl]",
    tip: "'s' 묵음 주의! (아일)"
  };

  const dialogueList: DialogueLine[] = script.dialogue || [];

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col items-center justify-start relative select-none pb-32">
      {/* Mobile Wrapper Container */}
      <div className="w-full max-w-[480px] min-h-screen bg-[#faf8ff] relative shadow-xl border-x border-[#eaedff]/60 flex flex-col">
        
        {/* Top Header */}
        <header className="fixed top-0 w-full max-w-[480px] z-40 pt-safe bg-[#faf8ff]/90 backdrop-blur-md border-b border-[#eaedff]">
          <div className="h-16 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="w-10 h-10 rounded-full bg-[#eaedff] hover:bg-[#e2e7ff] text-[#131b2e] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                onClick={() => router.replace("/")}
                type="button"
                aria-label="뒤로가기"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <Image src="/logo.png" alt="Logo" width={28} height={28} className="h-7 w-auto object-contain" />
              <h1 className="font-headline-sm text-sm font-bold text-[#131b2e] truncate max-w-[150px]">
                스크립트
              </h1>
            </div>
            <button
              className="flex items-center gap-1.5 p-1 rounded-full bg-orange-50/60 border border-orange-100 shadow-xs hover:bg-orange-100/60 transition cursor-pointer"
              onClick={() => setIsNicknameModalOpen(true)}
              type="button"
              title="프로필 및 레벨 수정"
            >
              <span>🐾</span>
              <span className="text-xs sm:text-sm font-bold text-gray-800 max-w-[70px] sm:max-w-[90px] truncate">{nickname}님</span>
              <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-orange-600 border border-orange-200/80 shadow-2xs whitespace-nowrap">
                {(userLevel || "A1").replace("-", "~")}
              </span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative w-full pt-20 px-4 gap-5">
          
          {/* Section 1: Mission & Strategy & Cat Tip */}
          <section className="flex flex-col gap-4 w-full">
            
            {/* Mission Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#eaedff] flex items-start gap-3 relative overflow-hidden">
              <div className="w-11 h-11 rounded-2xl bg-[#dbe1ff] text-[#004ac6] flex items-center justify-center flex-shrink-0 shadow-inner">
                <span className="material-symbols-outlined text-[24px]">flag</span>
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-[11px] text-[#004ac6] font-bold px-2 py-0.5 rounded-full bg-[#dbe1ff]/60">
                    {script.category} 미션
                  </span>
                  <span className="font-label-sm text-[11px] text-[#737686]">
                    {script.date}
                  </span>
                </div>
                <h3 className="font-headline-sm text-sm font-bold text-[#131b2e] leading-snug">
                  {script.mission}
                </h3>
              </div>
            </div>

            {/* Vertical Stack: Core Patterns & Pronunciation Tip */}
            <div className="flex flex-col gap-3 w-full">
              
              {/* Core Patterns Box */}
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#eaedff] flex flex-col gap-2">
                <div className="flex items-center gap-1 text-[#004ac6]">
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  <h4 className="font-headline-sm text-xs font-bold text-[#131b2e]">핵심 표현 패턴</h4>
                </div>
                <div className="flex flex-col gap-1.5 mt-0.5">
                  {script.corePatterns?.map((p, idx) => (
                    <div key={idx} className="bg-[#f2f3ff] rounded-xl p-2 text-[11px] flex flex-col gap-0.5">
                      <span className="font-bold text-[#004ac6] truncate">{p.pattern}</span>
                      <span className="text-[#434655] text-[10px] truncate">{p.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pronunciation Tip Box */}
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#eaedff] flex flex-col gap-2 justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1 text-[#855300]">
                    <span className="material-symbols-outlined text-[16px]">mic</span>
                    <h4 className="font-headline-sm text-xs font-bold text-[#131b2e]">발음 & 주의 팁</h4>
                  </div>
                  <div className="bg-[#fffae8] rounded-xl p-2.5 flex flex-col gap-1 border border-[#ffddb8]/50">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#2a1700] text-xs">
                        {pronTip.word}
                      </span>
                      <span className="text-[10px] text-[#855300] bg-[#ffddb8] px-1.5 py-0.5 rounded font-mono">
                        {pronTip.phonetic}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#434655] leading-relaxed">
                      {pronTip.tip}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* TalkyCat Nuance Tip Card */}
            <div className="bg-[#e2e7ff]/70 rounded-2xl p-4 border border-[#dbe1ff] flex items-center gap-3 relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-[#004ac6] text-white flex items-center justify-center flex-shrink-0 shadow-md p-1.5">
                <Image src="/talkycat-s.png" alt="TalkyCat" width={32} height={32} className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="font-label-sm text-[11px] text-[#004ac6] font-bold">
                  토키캣의 비밀 뉘앙스 팁
                </span>
                <p className="font-body-sm text-xs text-[#131b2e] font-medium leading-relaxed">
                  {script.catTip}
                </p>
              </div>
            </div>

          </section>

          {/* Section 2: Full Dialogue List */}
          <section className="flex flex-col gap-3 w-full pb-6">
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px] text-[#004ac6]">chat_bubble</span>
                <h3 className="font-headline-sm text-sm font-bold text-[#131b2e]">
                  롤플레이 대화 시트 ({dialogueList.length}턴)
                </h3>
              </div>
              <span className="font-label-sm text-[11px] text-[#737686]">
                볼륨 아이콘을 눌러 들어보세요 🎧
              </span>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {dialogueList.map((line, index) => {
                const isCat = line.speaker === "cat";
                const isSpeaking = speakingLineId === line.id;

                return (
                  <div
                    key={line.id || index}
                    className={`bg-white rounded-2xl p-4 shadow-sm border transition-all flex flex-col gap-2.5 cursor-pointer hover:border-[#004ac6]/40 ${
                      isCat
                        ? "border-[#dbe1ff] bg-gradient-to-r from-[#faf8ff] to-white"
                        : "border-[#eaedff] bg-white"
                    }`}
                    onClick={() => handleSpeakEnglish(line.english, line.id, index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#eaedff] text-[#131b2e] font-bold text-[11px] flex items-center justify-center">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`font-label-sm text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                            isCat
                              ? "bg-[#dbe1ff] text-[#00174b]"
                              : "bg-[#6ffbbe]/50 text-[#002113]"
                          }`}
                        >
                          {line.speakerName || (isCat ? "토키캣" : "나")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="px-2.5 py-1.5 rounded-xl bg-[#dbe1ff]/60 hover:bg-[#dbe1ff] text-[#004ac6] font-label-sm text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBottomSheet(line);
                          }}
                          type="button"
                          title="토키캣에게 심화 질문하기"
                        >
                          <span className="material-symbols-outlined text-[15px]">psychology</span>
                          <span>토키캣에게 묻기 🐾</span>
                        </button>
                        <button
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isSpeaking
                              ? "bg-[#004ac6] text-white animate-pulse"
                              : "bg-[#eaedff] text-[#004ac6] hover:bg-[#dbe1ff]"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeakEnglish(line.english, line.id, index);
                          }}
                          type="button"
                          title="영어 음성 듣기"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {isSpeaking ? "volume_up" : "volume_up"}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 pl-8">
                      <p className="font-headline-sm text-sm text-[#131b2e] font-semibold tracking-wide">
                        &quot;{line.english}&quot;
                      </p>
                      <p className="font-body-sm text-xs text-[#737686]">
                        {line.korean}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </main>

        {/* Bottom Fixed Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#faf8ff]/95 backdrop-blur-md border-t border-[#e2e7ff]/60 p-4 pb-safe flex items-center justify-center">
          <div className="w-full max-w-[480px]">
            <button
              className="w-full h-13 bg-[#004ac6] text-white font-label-lg text-sm font-bold rounded-2xl shadow-lg shadow-[#004ac6]/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer hover:bg-[#2563eb]"
              onClick={handleStartRoleplay}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">mic</span>
              <span>이 스크립트로 롤플레잉 계속하기</span>
            </button>
          </div>
        </div>

        {/* TalkyCat Deep Learning Bottom Sheet */}
        {isBottomSheetOpen && selectedDialogueItem && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-[480px] bg-white rounded-t-[2.5rem] shadow-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#eaedff] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#004ac6] text-white flex items-center justify-center p-1">
                    <Image src="/talkycat-s.png" alt="TalkyCat" width={24} height={24} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-headline-md text-sm font-bold text-[#131b2e]">
                      토키캣 심화 코칭 🐾
                    </h3>
                    <p className="font-body-sm text-[10px] text-[#737686]">
                      선택한 대사 문장에 대해 무엇이든 물어보세요!
                    </p>
                  </div>
                </div>
                <button
                  className="w-8 h-8 rounded-full bg-[#eaedff] text-[#434655] flex items-center justify-center hover:bg-[#e2e7ff] transition cursor-pointer"
                  onClick={() => setIsBottomSheetOpen(false)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Selected Sentence Card */}
              <div className="bg-[#f2f3ff] rounded-2xl p-3.5 flex flex-col gap-1 border border-[#e2e7ff]">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-[10px] text-[#004ac6] font-bold">
                    선택한 대사 문장
                  </span>
                  <button
                    className="w-7 h-7 rounded-full bg-[#004ac6] text-white flex items-center justify-center hover:bg-[#2563eb] transition cursor-pointer shadow-sm"
                    onClick={() => handleSpeakItem(selectedDialogueItem.english)}
                    type="button"
                    title="원본 문장 듣기"
                  >
                    <span className="material-symbols-outlined text-[15px]">volume_up</span>
                  </button>
                </div>
                <p className="font-headline-sm text-xs font-bold text-[#131b2e]">
                  &quot;{selectedDialogueItem.english}&quot;
                </p>
                <p className="font-body-sm text-[11px] text-[#737686]">
                  {selectedDialogueItem.korean}
                </p>
              </div>

              {/* One-touch Question Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-[#eaedff] hover:bg-[#dbe1ff] text-[#004ac6] font-label-sm text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                  onClick={() => fetchExplanation("alternative")}
                >
                  <span>💡 다른 표현</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-[#eaedff] hover:bg-[#dbe1ff] text-[#004ac6] font-label-sm text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                  onClick={() => fetchExplanation("nuance")}
                >
                  <span>🧐 뉘앙스 차이</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-[#eaedff] hover:bg-[#dbe1ff] text-[#004ac6] font-label-sm text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                  onClick={() => fetchExplanation("pronunciation")}
                >
                  <span>🗣️ 발음 꿀팁</span>
                </button>
              </div>

              {/* Custom Question Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!customQuestionInput.trim()) return;
                  fetchExplanation("custom", customQuestionInput.trim());
                  setCustomQuestionInput("");
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  className="flex-1 h-11 bg-[#faf8ff] border border-[#eaedff] focus:border-[#004ac6] focus:ring-2 focus:ring-[#004ac6]/20 rounded-xl px-3.5 text-xs text-[#131b2e] placeholder:text-gray-400 outline-none transition"
                  placeholder="궁금한 점을 직접 물어보라냥! 🐾"
                  value={customQuestionInput}
                  onChange={(e) => setCustomQuestionInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="w-11 h-11 bg-[#004ac6] text-white rounded-xl flex items-center justify-center hover:bg-[#2563eb] transition cursor-pointer flex-shrink-0 shadow-md shadow-[#004ac6]/20"
                  title="질문 전송"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </form>

              {/* Answer Box / Loading */}
              <div className="bg-[#faf8ff] rounded-2xl p-4 border border-[#eaedff] flex flex-col gap-3 min-h-[160px] max-h-[260px] overflow-y-auto">
                <div className="flex items-center gap-1.5 text-[#004ac6]">
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  <span className="font-label-sm text-xs font-bold">토키캣의 코칭 답변</span>
                </div>

                {bottomSheetLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-[#737686]">
                    <div className="w-6 h-6 rounded-full border-2 border-[#004ac6] border-t-transparent animate-spin" />
                    <span className="font-body-sm text-xs">토키캣이 생각 중이다냥... 🐾</span>
                  </div>
                ) : bottomSheetItems.length === 0 && !bottomSheetSummary ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-[#737686] gap-1">
                    <span className="text-xl">🐾</span>
                    <span className="font-body-sm text-xs">무엇이 궁금하냥? 아래 버튼을 눌러보라냥!</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {bottomSheetSummary && (
                      <div className="bg-[#dbe1ff]/50 rounded-xl p-2.5 text-xs text-[#00174b] font-medium leading-relaxed">
                        {bottomSheetSummary}
                      </div>
                    )}
                    {bottomSheetItems.map((item, idx) => (
                      <div key={idx} className="bg-white rounded-xl p-3 border border-[#eaedff] flex flex-col gap-1.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-headline-sm text-xs font-bold text-[#131b2e]">
                            &quot;{item.en}&quot;
                          </span>
                          <button
                            className="w-7 h-7 rounded-full bg-[#eaedff] hover:bg-[#dbe1ff] text-[#004ac6] flex items-center justify-center transition cursor-pointer flex-shrink-0"
                            onClick={() => handleSpeakItem(item.en)}
                            type="button"
                            title="이 예문 발음 듣기"
                          >
                            <span className="material-symbols-outlined text-[15px]">volume_up</span>
                          </button>
                        </div>
                        <p className="font-body-sm text-[11px] text-[#737686] leading-relaxed">
                          {item.ko}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#283044]/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="material-symbols-outlined text-[#4edea3] text-[18px]">info</span>
            <span>{toastMessage}</span>
          </div>
        )}

      </div>

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

export default function TalkySheetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-[#004ac6] border-t-transparent animate-spin" />
        </div>
      }
    >
      <TalkySheetContent />
    </Suspense>
  );
}
