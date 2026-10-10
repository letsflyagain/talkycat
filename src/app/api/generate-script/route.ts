import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { GeneratedScript } from "@/types/script";

// Mock fallback scripts in case API key is missing or call fails
const MOCK_SCRIPTS: Omit<GeneratedScript, "id" | "date" | "completedCount">[] = [
  {
    category: "생활영어",
    title: "편의점에서 생수와 간식 찾기",
    mission: "편의점 직원에게 생수와 삼각김밥 위치를 묻고 결제하기",
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
    catTip: "점원을 부를 땐 'Excuse me'로 상냥하게 시작해보라냥! 🐾",
    dialogue: [
      { id: 1, speaker: "user", speakerName: "나 (손님)", english: "Excuse me, where can I find the bottled water?", korean: "실례합니다, 생수는 어디에 있나요?" },
      { id: 2, speaker: "cat", speakerName: "토키캣 (점원)", english: "It's in aisle 3, right next to the refrigerator.", korean: "3번 통로 냉장고 바로 옆에 있어요." },
      { id: 3, speaker: "user", speakerName: "나 (손님)", english: "Thanks. Also, do you have tuna kimbap?", korean: "감사합니다. 그리고 참치 김밥도 있나요?" },
      { id: 4, speaker: "cat", speakerName: "토키캣 (점원)", english: "Yes, we do. They are on the top shelf.", korean: "네, 있습니다. 맨 위 칸에 있어요." },
      { id: 5, speaker: "user", speakerName: "나 (손님)", english: "Great, I'll take this one and two bottles of water.", korean: "좋아요, 이거랑 생수 두 병 살게요." },
      { id: 6, speaker: "cat", speakerName: "토키캣 (점원)", english: "Sure. That will be 5,500 won in total.", korean: "알겠습니다. 총 5,500원입니다." },
      { id: 7, speaker: "user", speakerName: "나 (손님)", english: "Can I pay by card?", korean: "카드 결제 되나요?" },
      { id: 8, speaker: "cat", speakerName: "토키캣 (점원)", english: "Of course. Please tap your card here. Have a nice day!", korean: "물론입니다. 여기에 카드 대주세요. 좋은 하루 보내세요!" }
    ]
  },
  {
    category: "여행/식당",
    title: "카페에서 아이스 아메리카노 주문하기",
    mission: "카페 직원에게 아이스 아메리카노와 시나몬롤 주문하고 테이크아웃 요청하기",
    corePatterns: [
      { pattern: "I'd like to order ~", meaning: "~를 주문하고 싶어요" },
      { pattern: "To go, please.", meaning: "포장해 주세요." },
      { pattern: "Can I get a receipt?", meaning: "영수증 받을 수 있나요?" }
    ],
    pronunciationTip: {
      word: "cinnamon",
      phonetic: "[ˈsɪnəmən]",
      tip: "강세는 첫 음절 '시'에 있어요! (시너먼)"
    },
    catTip: "음료 사이즈를 말할 때 'Medium size, please'를 붙이면 완벽하다냥! 🐾",
    dialogue: [
      { id: 1, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "Hello! Welcome to TalkyCoffee. What can I get for you?", korean: "안녕하세요! 토키캣 커피입니다. 무엇을 도와드릴까요?" },
      { id: 2, speaker: "user", speakerName: "나 (손님)", english: "Hi, I'd like to order an iced Americano, please.", korean: "안녕하세요, 아이스 아메리카노 한 잔 주문할게요." },
      { id: 3, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "Sure. Would you like regular or large size?", korean: "네, 레귤러와 라지 중 어떤 사이즈로 드릴까요?" },
      { id: 4, speaker: "user", speakerName: "나 (손님)", english: "Regular size, please. And do you have any pastries?", korean: "레귤러 사이즈로 주세요. 그리고 빵 종류도 있나요?" },
      { id: 5, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "We have fresh cinnamon rolls and croissants.", korean: "방금 구운 시나몬롤과 크루아상이 있습니다." },
      { id: 6, speaker: "user", speakerName: "나 (손님)", english: "I'll take one cinnamon roll too. Is it to go?", korean: "시나몬롤도 하나 주세요. 포장해 주실 거죠?" },
      { id: 7, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "Yes, everything will be packed to go. That's 8,000 won.", korean: "네, 전부 포장해 드릴게요. 8,000원입니다." },
      { id: 8, speaker: "user", speakerName: "나 (손님)", english: "Here is my card. Can I get a receipt?", korean: "여기 제 카드요. 영수증 주시겠어요?" },
      { id: 9, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "Here is your receipt and card. Enjoy your coffee!", korean: "영수증과 카드 여기 있습니다. 커피 맛있게 드세요!" }
    ]
  },
  {
    category: "비즈니스",
    title: "간단한 출근 인사와 일정 확인",
    mission: "동료에게 아침 인사를 건네고 오늘 회의 일정 확인하기",
    corePatterns: [
      { pattern: "How's it going?", meaning: "어떻게 지내니? / 별일 없지?" },
      { pattern: "Are we meeting at ~?", meaning: "~시에 미팅 있나요?" },
      { pattern: "Let me check my schedule.", meaning: "제 스케줄을 확인해 볼게요." }
    ],
    pronunciationTip: {
      word: "schedule",
      phonetic: "[ˈskedʒuːl]",
      tip: "미국 영어 발음은 '스케줄'에 가까워요! 🐾"
    },
    catTip: "출근길 동료에게 미소와 함께 'Good morning!'을 건네보라냥! 🐾",
    dialogue: [
      { id: 1, speaker: "user", speakerName: "나 (학습자)", english: "Good morning, Alex! How's it going?", korean: "좋은 아침이야, 알렉스! 별일 없지?" },
      { id: 2, speaker: "cat", speakerName: "토키캣 (동료)", english: "Morning! Everything is good. How was your weekend?", korean: "좋은 아침! 다 좋아. 주말은 잘 보냈어?" },
      { id: 3, speaker: "user", speakerName: "나 (학습자)", english: "It was relaxing, thanks. By the way, are we meeting at 2 PM?", korean: "편안하게 쉬었어, 고마워. 그런데 우리 오후 2시에 미팅 있나?" },
      { id: 4, speaker: "cat", speakerName: "토키캣 (동료)", english: "Let me check my schedule... Ah, yes, in conference room B.", korean: "내 스케줄 좀 확인해 볼게... 아 맞아, B 회의실이야." },
      { id: 5, speaker: "user", speakerName: "나 (학습자)", english: "Great. Should I bring the project report?", korean: "좋아. 프로젝트 보고서 들고 가면 될까?" },
      { id: 6, speaker: "cat", speakerName: "토키캣 (동료)", english: "Yes, please bring printed copies for everyone.", korean: "응, 다들 볼 수 있게 출력본 몇 부 가져다줘." },
      { id: 7, speaker: "user", speakerName: "나 (학습자)", english: "Got it. I'll print them right away. See you later!", korean: "알겠어. 당장 출력해 둘게. 이따 보자!" },
      { id: 8, speaker: "cat", speakerName: "토키캣 (동료)", english: "Thanks for your help. See you at 2!", korean: "도와줘서 고마워. 2시에 보자!" }
    ]
  },
  {
    category: "생활영어",
    title: "약국에서 감기약 증상 설명하고 구매하기",
    mission: "약사에게 목감기 증상을 설명하고 복용법 안내받기",
    corePatterns: [
      { pattern: "I have a sore ~", meaning: "~가 아파요" },
      { pattern: "How often should I take this?", meaning: "얼마나 자주 먹어야 하나요?" },
      { pattern: "Does it make me drowsy?", meaning: "졸린 약인가요?" }
    ],
    pronunciationTip: {
      word: "drowsy",
      phonetic: "[ˈdraʊzi]",
      tip: "'drau-zee'로 발음하며 '졸린'이라는 뜻이에요! 🐾"
    },
    catTip: "증상을 말할 땐 'I have a...' 패턴만 기억해도 충분하다냥! 🐾",
    dialogue: [
      { id: 1, speaker: "cat", speakerName: "토키캣 (약사)", english: "Hello! How can I help you today?", korean: "안녕하세요! 오늘 어떤 약이 필요하신가요?" },
      { id: 2, speaker: "user", speakerName: "나 (손님)", english: "Hi. I have a sore throat and a slight fever.", korean: "안녕하세요. 목이 아프고 미열이 좀 있어요." },
      { id: 3, speaker: "cat", speakerName: "토키캣 (약사)", english: "I see. This cold medicine works very fast.", korean: "그렇군요. 이 감기약이 효과가 아주 빠릅니다." },
      { id: 4, speaker: "user", speakerName: "나 (손님)", english: "How often should I take this?", korean: "얼마나 자주 복용해야 하나요?" },
      { id: 5, speaker: "cat", speakerName: "토키캣 (약사)", english: "Take two pills after meals, three times a day.", korean: "하루 세 번, 식후에 두 알씩 드세요." },
      { id: 6, speaker: "user", speakerName: "나 (손님)", english: "Does it make me drowsy?", korean: "이 약 먹으면 졸린가요?" },
      { id: 7, speaker: "cat", speakerName: "토키캣 (약사)", english: "A little bit. Drink plenty of warm water.", korean: "약간 졸릴 수 있어요. 따뜻한 물을 많이 드세요." },
      { id: 8, speaker: "user", speakerName: "나 (손님)", english: "Thank you for the advice!", korean: "조언 감사합니다!" }
    ]
  }
];

export async function POST(request: Request) {
  let excludeTopics: string[] = [];

  try {
    const body = await request.json().catch(() => ({}));
    if (body && Array.isArray(body.excludeTopics)) {
      excludeTopics = body.excludeTopics.slice(0, 7);
    }
  } catch {
    excludeTopics = [];
  }

  const getFallbackScript = (): GeneratedScript => {
    const availableMocks = MOCK_SCRIPTS.filter(
      (m) => !excludeTopics.some((ex) => m.title.includes(ex) || ex.includes(m.title))
    );
    const pool = availableMocks.length > 0 ? availableMocks : MOCK_SCRIPTS;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return {
      ...picked,
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
      completedCount: 0,
    };
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const errorMsg = "GEMINI_API_KEY environment variable is not set.";
      console.error("[Gemini API Error] " + errorMsg + " Falling back to mock script.");
      return NextResponse.json({ 
        success: true, 
        script: getFallbackScript(), 
        fallback: true, 
        error: errorMsg 
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const exclusionClause =
      excludeTopics.length > 0
        ? `
[CRITICAL NEGATIVE CONSTRAINT - MUST OBEY]:
The user has recently completed roleplays on the following topics:
${excludeTopics.map((t, idx) => `(${idx + 1}) "${t}"`).join("\n")}

You MUST STRICTLY AVOID all of the above topics, identical situational contexts, and same locations/roles.
Pick a completely fresh and unrepeated situation from everyday life or work.`
        : "";

    const systemInstruction = `
You are 'TalkyCat', an authentic, warm, and highly practical conversational English tutor for adult learners at CEFR A1~A2 level.
Your goal is to generate a realistic, non-cliché daily English conversation script in JSON format.

Select ONE fresh scenario from the 3 categories below:
1. "생활영어" (Daily life: bus stop directions, laundromat pickup, lost item inquiry, elevator chit-chat, bookstore, bakery, gym hours, neighborhood greeting)
2. "비즈니스" (Casual office & colleagues: asking for a 5-min delay, borrowing a pen, quick task completion report, lunch recommendation, meeting room location)
3. "여행/식당" (Travel & Dining: airport check-in, ordering extra napkins, requesting wifi password, hotel luggage keeping, asking for recommendation)
${exclusionClause}

Difficulty & Style Rules:
- CEFR A1~A2: 8 to 10 alternating lines between 'cat' (TalkyCat as counter clerk, coworker, neighbor, etc.) and 'user' (the learner).
- Encourage basic high-frequency action verbs (get, have, take, look, check, keep) and conversational flow (because, but, when).
- Avoid overly academic or textbook prose; embrace natural spoken nuance and clean colloquial speech.
- corePatterns: Exactly 3 essential practical patterns (pattern & Korean meaning).
- pronunciationTip: Focus on 1 real-world pronunciation hurdle (silent letters, linked sounds, or tricky stress).
- catTip: Must end with a warm cat-like persona tone ("~해보라냥! 🐾").
- Output format: STRICTLY JSON ONLY matching the schema. No markdown fences, no prefixes, no trailing explanations.
`;

    const prompt = `Generate a brand new, engaging A1~A2 English conversation script following the guidelines.
${
  excludeTopics.length > 0
    ? `Remember: DO NOT choose any theme similar to: [${excludeTopics.join(", ")}].`
    : ""
}

Return JSON with this exact structure:
{
  "category": "생활영어" | "비즈니스" | "여행/식당",
  "title": "string (Concise Korean title)",
  "mission": "string (Clear Korean roleplay goal)",
  "corePatterns": [
    { "pattern": "string", "meaning": "string" },
    { "pattern": "string", "meaning": "string" },
    { "pattern": "string", "meaning": "string" }
  ],
  "pronunciationTip": {
    "word": "string",
    "phonetic": "string",
    "tip": "string"
  },
  "catTip": "string with cat ending ~냥! 🐾",
  "dialogue": [
    {
      "id": 1,
      "speaker": "cat" | "user",
      "speakerName": "string",
      "english": "string",
      "korean": "string"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.85,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    let parsedData;
    try {
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedData = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("Failed to parse Gemini JSON response:", responseText, parseErr);
      throw new Error("Invalid JSON from Gemini API");
    }

    const script: GeneratedScript = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
      category: parsedData.category || "생활영어",
      title: parsedData.title || "새로운 일상 대화",
      mission: parsedData.mission || "상대방과 자연스럽게 대화 나누기",
      corePatterns: Array.isArray(parsedData.corePatterns) && parsedData.corePatterns.length === 3
        ? parsedData.corePatterns
        : [
            { pattern: "Where can I find ~?", meaning: "~는 어디 있나요?" },
            { pattern: "Could you help me with ~?", meaning: "~를 좀 도와주시겠어요?" },
            { pattern: "That sounds good.", meaning: "좋은 생각이에요." }
          ],
      pronunciationTip: parsedData.pronunciationTip || {
        word: "comfortable",
        phonetic: "[ˈkʌmftəbl]",
        tip: "4음절이 아닌 3음절 '컴프터블'처럼 굴려보라냥! 🐾"
      },
      catTip: parsedData.catTip || "자신감 있게 말하는 것이 가장 중요하다냥! 🐾",
      dialogue: Array.isArray(parsedData.dialogue) && parsedData.dialogue.length >= 6
        ? parsedData.dialogue
        : [
            { id: 1, speaker: "cat", speakerName: "토키캣", english: "Hello! Nice to meet you.", korean: "안녕하세요! 만나서 반가워요." },
            { id: 2, speaker: "user", speakerName: "나", english: "Hi! Nice to meet you too.", korean: "안녕하세요! 저도 반갑습니다." }
          ],
      completedCount: 0,
    };

    return NextResponse.json({ success: true, script });
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[Gemini API Error] Failed to generate script from Gemini API. Falling back to mock script.");
    console.error("Error details:", errorMsg);
    if (errorStack) {
      console.error("Stack trace:", errorStack);
    }
    return NextResponse.json({ 
      success: true, 
      script: getFallbackScript(), 
      fallback: true, 
      error: errorMsg 
    });
  }
}
