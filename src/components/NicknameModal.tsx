"use client";

import React, { useState, useEffect } from "react";

interface NicknameModalProps {
  isOpen: boolean;
  initialNickname: string;
  initialGoal: number;
  onClose: () => void;
  onSave: (newNickname: string, newGoal: number) => void;
}

export default function NicknameModal({
  isOpen,
  initialNickname,
  initialGoal,
  onClose,
  onSave,
}: NicknameModalProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [goal, setGoal] = useState(initialGoal);

  useEffect(() => {
    setNickname(initialNickname);
    setGoal(initialGoal);
  }, [initialNickname, initialGoal, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = nickname.trim() || "사용자";
    const parsedGoal = Number(goal) > 0 ? Number(goal) : 7;
    onSave(trimmed, parsedGoal);
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
              닉네임과 연속 학습 목표일수를 정해주세요.
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
            type="text"
            maxLength={10}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="닉네임을 입력하세요"
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl border border-[#e2e7ff] bg-[#faf8ff] text-[#131b2e] font-body-md focus:outline-none focus:ring-2 focus:ring-[#004ac6]/40 focus:border-[#004ac6] transition-all"
          />
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
