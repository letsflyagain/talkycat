"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import NicknameModal from "@/components/NicknameModal";
import GenerateProgressModal from "@/components/GenerateProgressModal";
import { GeneratedScript } from "@/types/script";

interface ScriptListItem {
  id: string;
  date: string;
  completedCount: number;
  category: "생활영어" | "비즈니스" | "여행/식당";
  title: string;
}

export default function Home() {
  const router = useRouter();

  // State with localStorage and Hydration Mismatch prevention
  const [nickname, setNickname] = useState("사용자");
  const [streakCount, setStreakCount] = useState(1);
  const [streakGoal, setStreakGoal] = useState(7);
  const [todaySentences, setTodaySentences] = useState(0);

  const [scripts, setScripts] = useState<ScriptListItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"전체" | "생활영어" | "비즈니스" | "여행/식당">("전체");
  const [generatedScriptId, setGeneratedScriptId] = useState<string | null>(null);

  const [scriptToDelete, setScriptToDelete] = useState<ScriptListItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteToastVisible, setDeleteToastVisible] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const startLongPress = (item: ScriptListItem) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setScriptToDelete(item);
      setIsDeleteModalOpen(true);
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleScriptClick = (item: ScriptListItem) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    router.push(`/talky-room?id=${item.id}`);
  };

  const confirmDeleteScript = () => {
    if (!scriptToDelete) return;
    try {
      localStorage.removeItem(`talkycat_script_${scriptToDelete.id}`);
      const saved = localStorage.getItem("talkycat_scripts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter((s: ScriptListItem) => s.id !== scriptToDelete.id);
          localStorage.setItem("talkycat_scripts", JSON.stringify(updated));
          setScripts(updated);
        }
      }
    } catch (e) {
      console.error("Failed to delete script", e);
    }
    setIsDeleteModalOpen(false);
    setScriptToDelete(null);
    setDeleteToastVisible(true);
    setTimeout(() => {
      setDeleteToastVisible(false);
    }, 2500);
  };

  const checkScripts = useCallback(() => {
    try {
      const savedScripts = localStorage.getItem("talkycat_scripts");
      if (savedScripts) {
        const parsed = JSON.parse(savedScripts);
        if (Array.isArray(parsed)) {
          setScripts(parsed);
        } else {
          setScripts([]);
        }
      } else {
        setScripts([]);
      }
    } catch (e) {
      console.error("Failed to load scripts", e);
      setScripts([]);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    try {
      const savedNickname = localStorage.getItem("talkycat_nickname");
      const savedStreakCount = localStorage.getItem("talkycat_streak_count");
      const savedStreakGoal = localStorage.getItem("talkycat_streak_goal");
      const savedTodaySentences = localStorage.getItem("talkycat_today_sentences");

      if (savedStreakCount) setStreakCount(Number(savedStreakCount));
      if (savedStreakGoal) setStreakGoal(Number(savedStreakGoal));
      if (savedTodaySentences) setTodaySentences(Number(savedTodaySentences));

      if (!savedNickname) {
        setIsNicknameModalOpen(true);
      } else {
        setNickname(savedNickname);
        checkScripts();
      }
    } catch (e) {
      console.error("Failed to load from localStorage", e);
      setIsNicknameModalOpen(true);
    }
  }, [checkScripts]);

  const handleSaveProfile = (newNickname: string, newGoal: number) => {
    setNickname(newNickname);
    setStreakGoal(newGoal);
    try {
      localStorage.setItem("talkycat_nickname", newNickname);
      localStorage.setItem("talkycat_streak_goal", newGoal.toString());
      if (!localStorage.getItem("talkycat_streak_count")) {
        localStorage.setItem("talkycat_streak_count", "1");
        setStreakCount(1);
      }
    } catch (e) {
      console.error("Failed to save profile", e);
    }
    checkScripts();
  };

  const handleStartGeneration = async () => {
    setIsGenerating(true);
    setGeneratedScriptId(null);

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success && data.script) {
        if (data.fallback) {
          console.error("[TalkyCat] Gemini API call failed or unavailable. Using mock fallback script. Exact Error:", data.error || "Unknown error");
        }
        const newScript: GeneratedScript = data.script;
        setGeneratedScriptId(newScript.id);

        let existing: GeneratedScript[] = [];
        try {
          const saved = localStorage.getItem("talkycat_scripts");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) existing = parsed;
          }
        } catch (err) {
          console.error("Error reading existing scripts", err);
        }

        const updated = [newScript, ...existing];
        localStorage.setItem("talkycat_scripts", JSON.stringify(updated));
        localStorage.setItem(`talkycat_script_${newScript.id}`, JSON.stringify(newScript));
        
        setScripts(updated);
      } else {
        const errorDetail = data.error || "Failed to generate script";
        console.error("[TalkyCat] API returned failure response:", errorDetail);
        throw new Error(errorDetail);
      }
    } catch (err: any) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error("[TalkyCat] Generation API error / Fallback triggered. Exact Error:", errMessage);
      const fallbackId = Date.now().toString();
      const fallbackScript: GeneratedScript = {
        id: fallbackId,
        date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
        category: "생활영어",
        title: "편의점에서 생수와 간식 찾기",
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
          { id: 1, speaker: "user", speakerName: "나 (손님)", english: "Excuse me, where can I find the water?", korean: "실례합니다, 물은 어디 있나요?" },
          { id: 2, speaker: "cat", speakerName: "토키캣 (점원)", english: "It's in aisle 3, right next to the refrigerator.", korean: "3번 통로 냉장고 바로 옆에 있어요." }
        ],
        completedCount: 0
      };
      setGeneratedScriptId(fallbackId);

      let existing: GeneratedScript[] = [];
      try {
        const saved = localStorage.getItem("talkycat_scripts");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) existing = parsed;
        }
      } catch (e) {
        console.error(e);
      }
      const updated = [fallbackScript, ...existing];
      localStorage.setItem("talkycat_scripts", JSON.stringify(updated));
      localStorage.setItem(`talkycat_script_${fallbackId}`, JSON.stringify(fallbackScript));
      setScripts(updated);
    }
  };

  const handleGenerationComplete = () => {
    setIsGenerating(false);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
      const targetId = generatedScriptId || (scripts.length > 0 ? scripts[0].id : Date.now().toString());
      router.push(`/talky-room?id=${targetId}`);
    }, 800);
  };

  const handleFreeTalk = () => {
    router.push("/free-talk");
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((streakCount / (streakGoal > 0 ? streakGoal : 7)) * 100))
  );

  const remainingSentences = Math.max(0, 3 - todaySentences);

  const filteredScripts =
    activeTab === "전체"
      ? scripts
      : scripts.filter((s) => s.category === activeTab);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#004ac6] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col items-center justify-start relative select-none">
      {/* Mobile Wrapper Container */}
      <div className="w-full max-w-[480px] min-h-screen bg-[#faf8ff] relative shadow-xl border-x border-[#eaedff]/60 flex flex-col">
        
        {/* Top Header */}
        <header className="fixed top-0 w-full max-w-[480px] z-40 pt-safe bg-[#faf8ff]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="h-16 px-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="TalkyCat Logo"
                width={32}
                height={32}
                className="h-8 w-auto object-contain"
                priority
              />
              <span className="font-headline-sm text-[17px] text-[#004ac6] font-bold tracking-tight">
                TalkyCat
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#ffddb8] text-[#2a1700] px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[16px] text-[#855300]">
                  local_fire_department
                </span>
                <span className="font-label-sm text-[11px] font-bold">
                  {streakCount}일
                </span>
              </div>
              <button
                className="flex items-center gap-1 bg-[#eaedff] hover:bg-[#e2e7ff] px-3 py-1 rounded-full text-[#131b2e] font-label-sm text-[11px] transition-colors active:scale-95 cursor-pointer"
                onClick={() => setIsNicknameModalOpen(true)}
                type="button"
              >
                <span className="font-semibold">{nickname}님</span>
                <span className="material-symbols-outlined text-[14px] text-[#737686]">
                  edit
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative w-full pt-20 bg-[#faf8ff] pb-32">
          <div className="flex flex-col w-full px-5 pb-6 gap-5">
            
            {/* Top Welcome & Daily Momentum Card */}
            <section className="w-full bg-white rounded-[2rem] p-4 shadow-sm border border-[#eaedff]/60 flex flex-col gap-3.5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-28 h-28 bg-[#eaedff] rounded-full opacity-60 pointer-events-none flex items-center justify-center">
                <span className="material-symbols-outlined text-[64px] text-[#004ac6]/10">
                  pets
                </span>
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-1 w-full">
                  <h2 className="font-headline-md text-[20px] text-[#131b2e] font-bold tracking-tight mt-1">
                    안녕하세요, <span>{nickname}</span>님!
                  </h2>
                  <p className="font-body-sm text-[13px] text-[#434655]">
                    오늘 토키캣과 함께 말해볼까요냥? 🐾
                  </p>
                </div>
              </div>

              {/* Compact Progress Track */}
              <div className="bg-[#f2f3ff] rounded-xl p-3 flex flex-col gap-2 relative z-10">
                <div className="flex items-center justify-between font-label-sm text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#131b2e] font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-[#855300]">
                      local_fire_department
                    </span>
                    <span>{streakCount}일 연속 말하기 달성 중!</span>
                  </div>
                  <span className="text-[#004ac6] font-bold">
                    목표 {progressPercent}% 달성
                  </span>
                </div>
                <div className="w-full bg-[#e2e7ff] h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#004ac6] h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[#737686] font-label-sm text-[11px]">
                  <span>{todaySentences}문장 말하기 완료</span>
                  <span className="text-[#434655] font-medium">
                    남은 목표: {remainingSentences}문장
                  </span>
                </div>
              </div>
            </section>

            {/* Script Archive List Section */}
            <section className="flex flex-col gap-4 w-full">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px] text-[#004ac6]">
                    folder_open
                  </span>
                  <h3 className="font-headline-sm text-[17px] text-[#131b2e] font-bold">
                    내 스크립트 보관함
                  </h3>
                </div>
                <p className="font-body-sm text-[11px] text-[#737686] ml-6">
                  💡 원하시는 스크립트 행을 길게 누르면 삭제할 수 있어요! 🐾
                </p>
              </div>

              {/* Filter Pills */}
              <div className="grid grid-cols-4 gap-1.5 w-full">
                {(["전체", "생활영어", "비즈니스", "여행/식당"] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      className={`py-1.5 rounded-full text-center font-label-sm text-[11px] font-semibold transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#004ac6] text-white shadow-sm"
                          : "bg-[#eaedff] text-[#434655] hover:bg-[#e2e7ff]"
                      }`}
                      onClick={() => setActiveTab(tab)}
                      type="button"
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Script Cards List or Empty State */}
              <div className="flex flex-col gap-2.5 w-full">
                {filteredScripts.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-3 border border-[#eaedff]/60 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-[#f2f3ff] flex items-center justify-center text-[#004ac6]">
                      <span className="material-symbols-outlined text-[24px]">
                        folder_off
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="font-headline-sm text-sm font-bold text-[#131b2e]">
                        아직 보관된 스크립트가 없어요냥! 🐾
                      </p>
                      <p className="font-body-sm text-xs text-[#737686]">
                        아래 버튼을 눌러 첫 번째 맞춤 스크립트를 만들어보세요.
                      </p>
                    </div>
                    <button
                      className="mt-2 px-4 py-2 bg-[#004ac6] text-white text-xs font-semibold rounded-xl shadow-md shadow-[#004ac6]/20 hover:bg-[#2563eb] transition-all cursor-pointer flex items-center gap-1.5"
                      onClick={handleStartGeneration}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        auto_awesome
                      </span>
                      <span>첫 스크립트 만들기</span>
                    </button>
                  </div>
                ) : (
                  filteredScripts.map((item) => {
                    let badgeBg = "bg-[#dbe1ff] text-[#00174b]";
                    let badgeText = "미완료";
                    if (item.completedCount > 0) {
                      badgeText = `🐾 ${item.completedCount}회 완료`;
                      if (item.completedCount >= 3) {
                        badgeBg = "bg-[#ffddb8] text-[#2a1700]";
                      } else if (item.completedCount === 2) {
                        badgeBg = "bg-[#6ffbbe] text-[#002113]";
                      } else {
                        badgeBg = "bg-[#e2e7ff] text-[#434655]";
                      }
                    }

                    return (
                      <article
                        key={item.id}
                        className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#eaedff]/60 hover:border-[#dbe1ff] transition-all flex items-center justify-between gap-3 active:scale-95 transition-transform cursor-pointer select-none"
                        onMouseDown={() => startLongPress(item)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onTouchStart={() => startLongPress(item)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onClick={() => handleScriptClick(item)}
                        title="길게 누르거나 우측 삭제 버튼으로 삭제 가능"
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-label-sm text-[11px] text-[#737686]">
                              {item.date}
                            </span>
                            <span
                              className={`font-label-sm text-[11px] px-2 py-0.5 rounded-full font-bold ${badgeBg}`}
                            >
                              {badgeText}
                            </span>
                            <span className="text-[10px] text-[#004ac6] bg-[#dbe1ff]/60 px-1.5 py-0.5 rounded font-medium">
                              {item.category}
                            </span>
                          </div>
                          <h4 className="font-headline-sm text-[15px] text-[#131b2e] font-bold truncate">
                            {item.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            className="w-8 h-8 rounded-full bg-[#ffdad6]/70 text-[#93000a] flex items-center justify-center hover:bg-[#ba1a1a] hover:text-white transition-colors shadow-sm cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setScriptToDelete(item);
                              setIsDeleteModalOpen(true);
                            }}
                            type="button"
                            title="스크립트 삭제"
                          >
                            <span className="material-symbols-outlined text-[17px]">
                              delete_outline
                            </span>
                          </button>
                          <button
                            className="w-9 h-9 rounded-full bg-[#dbe1ff]/50 text-[#004ac6] flex items-center justify-center hover:bg-[#004ac6] hover:text-white transition-colors shadow-sm cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/talky-room?id=${item.id}`);
                            }}
                            type="button"
                            title="토키룸으로 연습 시작"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              play_arrow
                            </span>
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </main>

        {/* Bottom Fixed Action Deck */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#faf8ff]/95 backdrop-blur-md border-t border-[#e2e7ff]/60 p-4 pb-safe flex items-center justify-center">
          <div className="w-full max-w-[480px] flex items-center gap-3">
            <button
              className="flex-1 h-14 bg-[#ffddb8] text-[#2a1700] font-label-md text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer px-2"
              onClick={handleFreeTalk}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px] text-[#855300]">
                call
              </span>
              <span>프리토킹</span>
            </button>
            <button
              className="flex-1 h-14 bg-[#2563eb] text-white font-label-md text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-[#2563eb]/25 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer hover:bg-[#1d4ed8] px-2 text-center leading-tight"
              onClick={handleStartGeneration}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">
                auto_awesome
              </span>
              <span>새 스크립트<br className="block sm:hidden" /> 만들기</span>
            </button>
          </div>
        </div>

        {/* Completion Toast Notification */}
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#283044]/90 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
            toastVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 pointer-events-none"
          }`}
        >
          <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
            check_circle
          </span>
          <span>스크립트 생성 완료! 토키룸으로 이동합니다 🚀</span>
        </div>

        {/* Deletion Toast Notification */}
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#283044]/90 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
            deleteToastVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 pointer-events-none"
          }`}
        >
          <span className="material-symbols-outlined text-[#ffdad6] text-[18px]">
            delete_outline
          </span>
          <span>스크립트가 삭제되었습니다 🗑️</span>
        </div>

        {/* Modals */}
        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && scriptToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-[360px] bg-white rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center gap-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-[#ffdad6] flex items-center justify-center text-[#93000a] text-3xl shadow-inner">
                <span className="material-symbols-outlined text-[32px]">delete_outline</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="font-headline-md text-base sm:text-lg font-bold text-[#131b2e]">
                  이 스크립트를 보관함에서 삭제할까요냥? 🐾
                </h3>
                <p className="font-body-sm text-[11px] text-[#ba1a1a] font-medium">
                  ⚠️ 스크립트 및 관련 학습 정보가 모두 영구 삭제됩니다.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full pt-2">
                <button
                  className="flex-1 py-3 rounded-2xl bg-[#eaedff] text-[#434655] font-label-md text-xs font-bold hover:bg-[#e2e7ff] transition cursor-pointer"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setScriptToDelete(null);
                  }}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="flex-1 py-3 rounded-2xl bg-[#ba1a1a] text-white font-label-md text-xs font-bold shadow-md hover:bg-[#93000a] transition cursor-pointer"
                  onClick={confirmDeleteScript}
                  type="button"
                >
                  삭제하기
                </button>
              </div>
            </div>
          </div>
        )}

        <NicknameModal
          isOpen={isNicknameModalOpen}
          initialNickname={nickname === "사용자" ? "" : nickname}
          initialGoal={streakGoal}
          onClose={() => setIsNicknameModalOpen(false)}
          onSave={handleSaveProfile}
        />

        <GenerateProgressModal
          isOpen={isGenerating}
          onClose={() => setIsGenerating(false)}
          onComplete={handleGenerationComplete}
        />
      </div>
    </div>
  );
}
