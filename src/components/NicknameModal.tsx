"use client";

import React, { useState, useEffect } from "react";
import { UserLevel } from "@/types/script";

interface NicknameModalProps {
  isOpen: boolean;
  initialNickname: string;
  initialGoal: number;
  initialLevel?: UserLevel;
  onClose: () => void;
  onSave: (newNickname: string, newGoal: number, newLevel: UserLevel) => void;
}

export default function NicknameModal({
  isOpen,
  initialNickname,
  initialGoal,
  initialLevel = "A1",
  onClose,
  onSave,
}: NicknameModalProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [goal, setGoal] = useState(initialGoal);
  const [level, setLevel] = useState<UserLevel>(initialLevel);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNickname(initialNickname);
    setGoal(initialGoal);
    setLevel(initialLevel || "A1");
  }, [initialNickname, initialGoal, initialLevel, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = nickname.trim() || "사용자";
    const parsedGoal = Number(goal) > 0 ? Number(goal) : 7;
    onSave(trimmed, parsedGoal, level);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#283044]/50 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 border border-[#eaedff]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="font-headline-sm text-lg font-bold text-[#131b2e] tracking-tight">
              프로필 & 학습 목표 설정 🐾
            </h3>
            <p className="font-body-sm text-sm text-[#434655]">
              닉네임, 학습 레벨 및 연속 학습 목표일수를 정해주세요.
            </p>
          </div>
          <button
            className="text-[#737686] hover:text-[#131b2e] p-1 rounded-full transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Nickname Input */}
        <div className="flex flex-col gap-1.5">
          <label
            className="font-label-sm text-xs font-medium text-[#434655]"
            htmlFor="nickname-input"
          >
            닉네임
          </label>
          <input
            id="nickname-input"
            ref={inputRef}
            type="text"
            maxLength={10}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="닉네임을 입력하세요"
            className="w-full px-4 py-2.5 rounded-xl border border-[#e2e7ff] bg-[#faf8ff] text-[#131b2e] font-body-md focus:outline-none focus:ring-2 focus:ring-[#004ac6]/40 focus:border-[#004ac6] transition-all"
          />
        </div>

        {/* CEFR Level Select Combo Box */}
        <div className="flex flex-col gap-1.5">
          <label
            className="font-label-sm text-xs font-medium text-[#434655]"
            htmlFor="level-select"
          >
            학습 레벨 (CEFR)
          </label>
          <select
            id="level-select"
            value={level}
            onChange={(e) => setLevel(e.target.value as UserLevel)}
            className="w-full px-4 py-2.5 rounded-xl border border-[#e2e7ff] bg-[#faf8ff] text-[#131b2e] font-body-md focus:outline-none focus:ring-2 focus:ring-[#004ac6]/40 focus:border-[#004ac6] transition-all cursor-pointer"
          >
            <option value="A1">A1 - 입문 (단어 및 매우 기초적인 일상 표현)</option>
            <option value="A1-A2">A1~A2 - 초급 도약 (기초 표현에 간단한 상태/감정 덧붙이기)</option>
            <option value="A2">A2 - 초급 (식당, 카페 등 친숙한 상황의 일상 회화)</option>
            <option value="A2-B1">A2~B1 - 중급 진입 (짧은 문장을 이어 이유나 의견 말하기)</option>
            <option value="B1">B1 - 중급 (여행, 취미 등 다양한 주제로 문맥 연결 대화)</option>
            <option value="B2">B2 - 중상급 (자연스럽고 유창한 의사표현)</option>
          </select>
        </div>

        {/* Goal Days Input */}
        <div className="flex flex-col gap-1.5">
          <label
            className="font-label-sm text-xs font-medium text-[#434655]"
            htmlFor="goal-input"
          >
            연속 학습 목표 (일)
          </label>
          <input
            id="goal-input"
            type="number"
            min="1"
            max="365"
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            placeholder="7"
            className="w-full px-4 py-2.5 rounded-xl border border-[#e2e7ff] bg-[#faf8ff] text-[#131b2e] font-body-md focus:outline-none focus:ring-2 focus:ring-[#004ac6]/40 focus:border-[#004ac6] transition-all"
          />
          <span className="text-[11px] text-[#737686] font-medium">
            목표 일수를 설정해주세요 (기본 7일)
          </span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            className="flex-1 py-2.5 rounded-xl bg-[#eaedff] text-[#434655] font-label-md text-sm font-semibold hover:bg-[#e2e7ff] transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            취소
          </button>
          <button
            className="flex-[1.5] py-2.5 rounded-xl bg-[#004ac6] text-white font-label-md text-sm font-semibold shadow-md shadow-[#004ac6]/20 hover:bg-[#2563eb] transition-all cursor-pointer"
            onClick={handleSave}
            type="button"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
