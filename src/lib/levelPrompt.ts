export type CEFRLevel = 'A1' | 'A1-A2' | 'A2' | 'A2-B1' | 'B1' | 'B2';

export function getLevelInstruction(level: CEFRLevel = 'A1'): string {
  const instructions: Record<CEFRLevel, string> = {
    'A1': `
[Target Level: CEFR A1 (입문)]
- 반드시 1~2개의 아주 짧고 직관적인 단문(Simple Sentence) 위주로 구성할 것.
- 중등 기초 수준을 넘지 않는 극도로 쉬운 일상 기초 어휘만 사용.
- 복잡한 접속사, 분사구문, 관계대명사 절대 금지.
- 예/아니오 또는 짧은 선택지로 대답할 수 있는 명확하고 단순한 표현 사용.`,

    'A1-A2': `
[Target Level: CEFR A1~A2 (초급 도약)]
- 2~3문장의 짧은 구어체 대화.
- 기초 단문 위주에 'and', 'but', 'because' 등 가장 기초적인 접속사 1개 정도로 이어진 문장 허용.
- 일상적인 감정이나 상태(happy, tired, busy 등)를 표현하는 쉬운 어휘 사용.`,

    'A2': `
[Target Level: CEFR A2 (초급)]
- 2~3문장 내외의 자연스러운 일상 회화체.
- 식당, 카페, 쇼핑, 길찾기 등 친숙한 일상 상황에서 즉시 쓸 수 있는 핵심 패턴(I'd like to, Can I get, How about 등) 위주.
- 직관적인 과거시제와 미래시제(will, going to)의 자연스러운 활용.`,

    'A2-B1': `
[Target Level: CEFR A2~B1 (중급 진입)]
- 3~4문장의 연결성 있는 구어체 대화.
- 사용자가 이유나 짧은 의견을 말할 수 있도록 열린 질문(Open Question: Why, How, What do you think) 적극 활용.
- 다양한 일상 구동사(Phrasal Verbs) 및 상황 묘사 표현 포함.`,

    'B1': `
[Target Level: CEFR B1 (중급)]
- 여행, 취미, 일상 사건, 계획 등을 문맥을 살려 유기적으로 이어가는 유창한 회화.
- 생각과 느낌을 자세히 설명할 수 있도록 풍부한 연결어와 원어민식 자연스러운 구어체 이디엄 포함.`,

    'B2': `
[Target Level: CEFR B2 (중상급)]
- 추상적인 주제나 가벼운 토론까지 가능한 수준의 유창하고 빠른 호흡의 회화.
- 다양한 뉘앙스, 관용 표현(Idiom), 고급 구어체 표현 적극 반영.`
  };

  return `\n### STRICT CEFR LEVEL REQUIREMENT:\n${instructions[level] || instructions['A1']}\n반드시 위 타깃 레벨의 문장 구조, 어휘 난이도, 발화 길이를 엄격히 준수하세요.\n`;
}
