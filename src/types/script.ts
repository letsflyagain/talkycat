export interface DialogueLine {
  id: number;
  speaker: 'cat' | 'user';       // 'cat' = 토키캣 (점원/동료/상대방), 'user' = 나 (손님/학습자)
  speakerName: string;            // 예: "토키캣 (점원)", "나 (손님)"
  english: string;                // 영어 발화 문장 (A1~A2 구어체)
  korean: string;                 // 한국어 자연스러운 해석
}

export interface CorePattern {
  pattern: string;                // 예: "Where can I find ~?"
  meaning: string;                // 예: "~는 어디 있나요?"
}

export interface PronunciationTip {
  word: string;                   // 예: "aisle"
  phonetic: string;               // 예: "[aɪl]"
  tip: string;                    // 예: "'s' 묵음 주의! (아일)"
}

export interface GeneratedScript {
  id: string;                     // Date.now().toString()
  date: string;                   // "YYYY.MM.DD"
  category: "생활영어" | "비즈니스" | "여행/식당";
  title: string;                  // 예: "편의점에서 물건 위치 묻기"
  mission: string;                // 예: "편의점 직원에게 생수 위치를 묻고 카드 결제까지 완료하기"
  corePatterns: CorePattern[];    // 정확히 3개
  pronunciationTips?: PronunciationTip[]; // 발음 팁 배열 (혹은 단일 객체나 배열 모두 호환되도록 처리)
  pronunciationTip?: PronunciationTip;   // 호환성용 단일 발음 팁
  catTip: string;                 // 토키캣 뉘앙스 팁 (예: 점원을 부를 땐 'Excuse me'로 부드럽게 시작해보라냥! 🐾)
  dialogue: DialogueLine[];       // 8~10개의 핑퐁 턴 (cat과 user가 번갈아 대화)
  completedCount: number;         // 기본값 0
}
