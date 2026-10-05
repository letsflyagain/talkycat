"use client";

import React, { useState, useEffect } from "react";

interface GenerateProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function GenerateProgressModal({
  isOpen,
  onClose,
  onComplete,
}: GenerateProgressModalProps) {
  const [progress, setProgress] = useState(15);
  const [statusBadge, setStatusBadge] = useState("생성 준비 중");
  const [subtext, setSubtext] = useState("AI가 맞춤형 대화를 생성하고 있습니다");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!isOpen) {
      setProgress(15);
      setStatusBadge("생성 준비 중");
      setSubtext("AI가 맞춤형 대화를 생성하고 있습니다");
      setStep(1);
      return;
    }

    const timer1 = setTimeout(() => {
      setProgress(45);
      setStatusBadge("패턴 분석 중");
      setStep(2);
    }, 800);

    const timer2 = setTimeout(() => {
      setProgress(80);
      setStatusBadge("발음 팁 구성 중");
      setStep(3);
    }, 1600);

    const timer3 = setTimeout(() => {
      setProgress(100);
      setStatusBadge("완료!");
      setSubtext("대본 준비가 완료되었습니다냥! 🚀");
    }, 2500);

    const timer4 = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center border border-blue-50 relative overflow-hidden flex flex-col items-center animate-in fade-in zoom-in-95">
        {/* Close Button */}
        <button
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full transition-colors cursor-pointer"
          onClick={onClose}
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Animated TalkyCat Avatar */}
        <div className="w-20 h-20 rounded-full bg-blue-50 ring-4 ring-blue-100 flex items-center justify-center relative mt-2 shadow-inner text-4xl animate-bounce">
          <span>🐱🎧</span>
          <div className="absolute -bottom-1 -right-1 bg-[#004ac6] text-white rounded-full p-1 shadow-sm flex items-center justify-center">
            <span className="material-symbols-outlined text-[13px] animate-spin">
              autorenew
            </span>
          </div>
        </div>

        {/* Main Title & Subtitle */}
        <h3 className="font-bold text-slate-800 text-base mt-4 tracking-tight">
          새로운 맞춤 스크립트를 만들고 있어요냥! 🐾
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">{subtext}</p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-5 relative shadow-inner">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="w-full flex justify-between items-center mt-1.5 px-0.5">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              progress === 100
                ? "text-emerald-600 bg-emerald-50"
                : "text-blue-600 bg-blue-50"
            }`}
          >
            {statusBadge}
          </span>
          <span className="text-xs font-bold text-blue-600">
            {progress}%
          </span>
        </div>

        {/* 3-Step Sequential Progress List */}
        <div className="w-full flex flex-col gap-2 mt-4 text-left bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
          {/* Step 1 */}
          <div
            className={`flex items-center gap-2 text-xs transition-all ${
              step > 1
                ? "font-medium text-slate-500"
                : "font-semibold text-blue-600"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                step > 1
                  ? "text-emerald-500 font-bold"
                  : "text-blue-600 animate-spin"
              }`}
            >
              {step > 1 ? "check_circle" : "progress_activity"}
            </span>
            <span className="flex-1 truncate">1. 일상 회화 상황 구성 중...</span>
          </div>

          {/* Step 2 */}
          <div
            className={`flex items-center gap-2 text-xs transition-all ${
              step > 2
                ? "font-medium text-slate-500"
                : step === 2
                ? "font-semibold text-blue-600"
                : "font-medium text-slate-400"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                step > 2
                  ? "text-emerald-500 font-bold"
                  : step === 2
                  ? "text-blue-600 animate-spin"
                  : "text-slate-300"
              }`}
            >
              {step > 2 ? "check_circle" : step === 2 ? "progress_activity" : "radio_button_unchecked"}
            </span>
            <span className="flex-1 truncate">2. A1 수준 필수 패턴 추출 중...</span>
          </div>

          {/* Step 3 */}
          <div
            className={`flex items-center gap-2 text-xs transition-all ${
              progress === 100
                ? "font-medium text-slate-500"
                : step === 3
                ? "font-semibold text-blue-600"
                : "font-medium text-slate-400"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                progress === 100
                  ? "text-emerald-500 font-bold"
                  : step === 3
                  ? "text-blue-600 animate-spin"
                  : "text-slate-300"
              }`}
            >
              {progress === 100 ? "check_circle" : step === 3 ? "progress_activity" : "radio_button_unchecked"}
            </span>
            <span className="flex-1 truncate">3. 토키캣의 발음 팁 준비 중...</span>
          </div>
        </div>

        {/* Cancel Button */}
        <button
          className="mt-4 text-xs text-slate-400 hover:text-slate-600 font-medium py-1 px-3 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          onClick={onClose}
          type="button"
        >
          취소하기
        </button>
      </div>
    </div>
  );
}
