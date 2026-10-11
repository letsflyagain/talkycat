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
      { id: 2, speaker: "cat", speakerName: "토키캣 (점원)", english: "It is located in aisle three right over there.", korean: "저기 바로 3번 통로에 위치해 있어요." },
      { id: 3, speaker: "user", speakerName: "나 (손님)", english: "Thank you. Do you also have tuna kimbap here?", korean: "감사합니다. 혹시 참치 김밥도 여기에 있나요?" },
      { id: 4, speaker: "cat", speakerName: "토키캣 (점원)", english: "Yes, they are on the top shelf of the fridge.", korean: "네, 냉장고 맨 위 칸에 진열되어 있습니다." },
      { id: 5, speaker: "user", speakerName: "나 (손님)", english: "Great, I will take one kimbap and two waters.", korean: "좋아요, 김밥 하나랑 물 두 병 살게요." },
      { id: 6, speaker: "cat", speakerName: "토키캣 (점원)", english: "Sure thing. That will be 5,500 won in total.", korean: "알겠습니다. 총 5,500원입니다." },
      { id: 7, speaker: "user", speakerName: "나 (손님)", english: "Can I pay using my credit card here?", korean: "여기서 제 신용카드로 결제할 수 있나요?" },
      { id: 8, speaker: "cat", speakerName: "토키캣 (점원)", english: "Of course. Please tap your card on the terminal.", korean: "물론입니다. 단말기에 카드를 터치해 주세요." }
    ]
  },
  {
    category: "여행/식당",
    title: "카페에서 아이스 아메리카노 주문하기",
    mission: "카페 직원에게 아이스 아메리카노와 시나몬롤 주문하고 테이크아웃 요청하기",
    corePatterns: [
      { pattern: "I would like to order ~", meaning: "~를 주문하고 싶어요" },
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
      { id: 1, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "Hello! Welcome to TalkyCoffee. How can I help you?", korean: "안녕하세요! 토키캣 커피입니다. 무엇을 도와드릴까요?" },
      { id: 2, speaker: "user", speakerName: "나 (손님)", english: "Hi, I would like to order an iced Americano.", korean: "안녕하세요, 아이스 아메리카노 한 잔 주문할게요." },
      { id: 3, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "Sure. Would you prefer regular or large size?", korean: "네, 레귤러와 라지 중 어떤 사이즈로 드릴까요?" },
      { id: 4, speaker: "user", speakerName: "나 (손님)", english: "Regular size is fine. Do you have any fresh bread?", korean: "레귤러 사이즈면 좋아요. 혹시 갓 구운 빵도 있나요?" },
      { id: 5, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "We have delicious cinnamon rolls and croissants today.", korean: "오늘 맛있는 시나몬롤과 크루아상이 준비되어 있어요." },
      { id: 6, speaker: "user", speakerName: "나 (손님)", english: "I will take one cinnamon roll as well.", korean: "시나몬롤도 하나 같이 주세요." },
      { id: 7, speaker: "cat", speakerName: "토키캣 (바리스타)", english: "Alright, everything will be packed to go for you.", korean: "알겠습니다. 전부 포장해서 담아드릴게요." },
      { id: 8, speaker: "user", speakerName: "나 (손님)", english: "Here is my card, and can I get a receipt?", korean: "여기 제 카드요, 그리고 영수증도 주시겠어요?" }
    ]
  },
  {
    category: "비즈니스",
    title: "간단한 출근 인사와 일정 확인",
    mission: "동료에게 아침 인사를 건네고 오늘 회의 일정 확인하기",
    corePatterns: [
      { pattern: "How is it going?", meaning: "어떻게 지내니? / 별일 없지?" },
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
      { id: 1, speaker: "user", speakerName: "나 (학습자)", english: "Good morning, Alex! How is your morning going?", korean: "좋은 아침이야, 알렉스! 오늘 아침 어때?" },
      { id: 2, speaker: "cat", speakerName: "토키캣 (동료)", english: "Morning! Everything is good. How was your weekend?", korean: "좋은 아침! 다 좋아. 주말은 잘 보냈어?" },
      { id: 3, speaker: "user", speakerName: "나 (학습자)", english: "It was quite relaxing. By the way, are we meeting at two?", korean: "아주 편안하게 쉬었어. 그런데 우리 2시에 미팅 있나?" },
      { id: 4, speaker: "cat", speakerName: "토키캣 (동료)", english: "Let me check my calendar for today.", korean: "오늘 내 캘린더를 좀 확인해 볼게." },
      { id: 5, speaker: "user", speakerName: "나 (학습자)", english: "Sure, take your time checking your schedule.", korean: "그래, 천천히 스케줄 확인해 봐." },
      { id: 6, speaker: "cat", speakerName: "토키캣 (동료)", english: "Ah yes, we have a team meeting in room B.", korean: "아 맞다, B 회의실에서 팀 미팅이 있네." },
      { id: 7, speaker: "user", speakerName: "나 (학습자)", english: "Great, I should bring the printed report there.", korean: "좋아, 출력한 보고서를 거기로 들고 가면 되겠네." },
      { id: 8, speaker: "cat", speakerName: "토키캣 (동료)", english: "Thanks for your help. See you at the meeting!", korean: "도와줘서 고마워. 미팅 때 보자!" }
    ]
  },
  {
    category: "영화/드라마 명장면",
    title: "영화 타이타닉 느낌의 상황: 배 위에서 바람 느끼기",
    mission: "배 앞머리에서 바람을 맞으며 멋진 대사 나누고 감상 공유하기",
    corePatterns: [
      { pattern: "I am flying, right?", meaning: "나 지금 나는 것 같지 않니?" },
      { pattern: "Hold me tight!", meaning: "꽉 잡아줘!" },
      { pattern: "Never let go.", meaning: "절대 놓지 마." }
    ],
    pronunciationTip: {
      word: "breeze",
      phonetic: "[briːz]",
      tip: "시원한 바람을 뜻하며 입술을 살짝 떨며 발음해보세요! 🐾"
    },
    catTip: "원작의 명대사 뉘앙스를 일상 영어로 귀엽게 바꾼 대화다냥! 🐾",
    dialogue: [
      { id: 1, speaker: "cat", speakerName: "토키캣 (잭)", english: "Step up here and close your eyes right now.", korean: "여기에 올라와서 당장 눈을 감아봐." },
      { id: 2, speaker: "user", speakerName: "나 (로즈)", english: "Wow, I feel like I am flying over the ocean!", korean: "와, 바다 위를 날고 있는 것 같은 기분이야!" },
      { id: 3, speaker: "cat", speakerName: "토키캣 (잭)", english: "Are you feeling okay? Please hold me tight.", korean: "기분이 어때 괜찮아? 제발 나를 꽉 잡아줘." },
      { id: 4, speaker: "user", speakerName: "나 (로즈)", english: "Yes, I feel completely safe standing here with you.", korean: "응, 너와 함께 여기 서 있으니 완전히 안전해." },
      { id: 5, speaker: "cat", speakerName: "토키캣 (잭)", english: "You must remember this special moment forever.", korean: "이 특별한 순간을 영원히 기억해야 해." },
      { id: 6, speaker: "user", speakerName: "나 (로즈)", english: "I promise I will never let go of your hands.", korean: "네 손을 절대 놓지 않겠다고 약속할게." }
    ]
  }
];

export async function POST(request: Request) {
  let excludeTopics: string[] = [];
  let customTopic = "";

  try {
    const body = await request.json().catch(() => ({}));
    if (body) {
      if (Array.isArray(body.excludeTopics)) {
        excludeTopics = body.excludeTopics.slice(0, 7);
      }
      if (typeof body.customTopic === "string") {
        customTopic = body.customTopic.trim();
      }
    }
  } catch {
    excludeTopics = [];
    customTopic = "";
  }

  const getFallbackScript = (): GeneratedScript => {
    const pool = MOCK_SCRIPTS;
    const availableMocks = pool.filter(
      (m) => !excludeTopics.some((ex) => m.title.includes(ex) || ex.includes(m.title))
    );
    const finalPool = availableMocks.length > 0 ? availableMocks : pool;
    const picked = finalPool[Math.floor(Math.random() * finalPool.length)];

    let inferredCategory: "생활영어" | "비즈니스" | "여행/식당" | "영화/드라마 명장면" = "생활영어";
    if (customTopic) {
      const lower = customTopic.toLowerCase();
      if (lower.includes("여행") || lower.includes("공항") || lower.includes("호텔") || lower.includes("길") || lower.includes("식당") || lower.includes("카페") || lower.includes("주문")) {
        inferredCategory = "여행/식당";
      } else if (lower.includes("회사") || lower.includes("출근") || lower.includes("회의") || lower.includes("업무") || lower.includes("동료") || lower.includes("비즈니스")) {
        inferredCategory = "비즈니스";
      } else if (lower.includes("영화") || lower.includes("드라마") || lower.includes("명장면") || lower.includes("패러디") || lower.includes("타이타닉") || lower.includes("주인공")) {
        inferredCategory = "영화/드라마 명장면";
      } else {
        inferredCategory = "생활영어";
      }
    }

    let finalTitle = picked.title;
    let finalMission = picked.mission;
    if (customTopic) {
      if (inferredCategory === "영화/드라마 명장면") {
        finalTitle = `영화 ${customTopic} 느낌의 상황: 명장면 패러디 대화`;
        finalMission = `영화 ${customTopic}의 분위기를 살려 말하기 연습하기`;
      } else {
        finalTitle = `맞춤 주제: ${customTopic}`;
        finalMission = `${customTopic} 상황에서 유용한 영어 표현 익히기`;
      }
    }

    return {
      ...picked,
      title: finalTitle,
      mission: finalMission,
      category: inferredCategory,
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

You MUST STRICTLY AVOID all of the above topics, identical situational contexts, and same locations/roles.`
        : "";

    const customTopicClause = customTopic
      ? `
[CRITICAL INSTRUCTION - USER SPECIFIC TOPIC - HIGHEST PRIORITY]:
The user explicitly requested the following conversation situation:
"${customTopic}"

YOU MUST GENERATE THE DIALOGUE STRICTLY BASED ON THIS SITUATION.
Do NOT generate unrelated generic conversations like cafe ordering or simple morning greetings unless explicitly requested.
- If the topic is "여행에서 길묻기", the dialogue MUST be about asking and giving directions while traveling (e.g., asking how to get to the subway station or landmark, walking vs taking the bus).
- If the topic mentions a movie or scene, adapt that scene into natural, easy-to-learn English while avoiding direct copyright infringement.
- Intelligently classify and assign the appropriate category from ("생활영어", "비즈니스", "여행/식당", "영화/드라마 명장면") based on this topic.
- Reflect this specific situation, context, and keywords 100% into the generated English conversation script title, mission, and dialogue.
`
      : `
[DEFAULT TOPIC INSTRUCTION]:
Since no custom topic was provided, generate a popular, engaging everyday English conversation script and intelligently choose the matching category.
`;

    const systemInstruction = `
You are 'TalkyCat', an authentic, warm, and highly practical conversational English tutor for adult learners at CEFR A2 level (practical daily conversation).
Your goal is to generate a realistic, non-cliché daily English conversation script in JSON format.

Available categories:
1. "생활영어" (Daily life: bus stop directions, laundromat pickup, lost item inquiry, elevator chit-chat, bookstore, bakery, gym hours, neighborhood greeting)
2. "비즈니스" (Casual office & colleagues: asking for a 5-min delay, borrowing a pen, quick task completion report, lunch recommendation, meeting room location)
3. "여행/식당" (Travel & Dining: airport check-in, ordering extra napkins, requesting wifi password, hotel luggage keeping, asking for recommendation, asking for directions)
4. "영화/드라마 명장면" (Parody & creative adaptation of famous movie/drama scenes for easy speaking practice)

${customTopicClause}
${exclusionClause}

Difficulty & Style Rules (CEFR A2 Level Strict Standards):
- Turn Count: The dialogue array MUST contain strictly 8 to 10 alternating lines between 'cat' and 'user' (the learner). Do not generate fewer than 8 lines or more than 10 lines.
- Sentence Length & Structure: Each English sentence should be roughly 6 to 10 words long, offering a natural rhythm for speaking aloud. Avoid overly academic prose or overly brief one-word sentences like "Yes." or "Thanks." without context. Use complete, natural conversational sentences.
- corePatterns: Exactly 3 essential practical patterns (pattern & Korean meaning).
- pronunciationTip: Focus on 1 real-world pronunciation hurdle.
- catTip: Must end with a warm cat-like persona tone ("~해보라냥! 🐾").
- Output format: STRICTLY JSON ONLY matching the schema. No markdown fences, no prefixes, no trailing explanations.
`;

    const prompt = `Generate an engaging A2 level English conversation script following the guidelines.
${customTopic ? `Target User Custom Topic / Situation: "${customTopic}" (MUST BE 100% PRIORITIZED)` : "Generate a fresh, engaging daily conversation."}

Return JSON with this exact structure:
{
  "category": "생활영어" | "비즈니스" | "여행/식당" | "영화/드라마 명장면",
  "title": "string (Concise Korean title reflecting the custom topic)",
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
      "english": "string (6~10 words long, natural A2 spoken English)",
      "korean": "string"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite", // CRITICAL requirement
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.8,
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

    let inferredCategory: "생활영어" | "비즈니스" | "여행/식당" | "영화/드라마 명장면" = parsedData.category || "생활영어";
    if (!["생활영어", "비즈니스", "여행/식당", "영화/드라마 명장면"].includes(inferredCategory)) {
      inferredCategory = "생활영어";
    }

    const script: GeneratedScript = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
      category: inferredCategory,
      title: parsedData.title || (customTopic ? `맞춤 주제: ${customTopic}` : "새로운 일상 대화"),
      mission: parsedData.mission || (customTopic ? `${customTopic} 상황에서 영어 대화 나누기` : "상대방과 자연스럽게 대화 나누기"),
      corePatterns: Array.isArray(parsedData.corePatterns) && parsedData.corePatterns.length === 3
        ? parsedData.corePatterns
        : [
            { pattern: "Where can I find ~?", meaning: "~는 어디 있나요?" },
            { pattern: "Could you help me with ~?", meaning: "~를 좀 도와주시겠어요?" },
            { pattern: "That sounds good.", meaning: "좋은 생각이에요." }
          ],
      pronunciationTip: parsedData.pronunciationTip || {
        word: "comfortable",
        phonetic: "[ˈkʌmfərtəbəl]",
        tip: "'컴퍼터블'처럼 부드럽게 발음해보세요! 🐾"
      },
      catTip: parsedData.catTip || "자연스러운 억양으로 즐겁게 대화해 보라냥! 🐾",
      dialogue: Array.isArray(parsedData.dialogue) && parsedData.dialogue.length > 0
        ? parsedData.dialogue
        : [
            { id: 1, speaker: "user", speakerName: "나 (학습자)", english: "Hello, how are you doing today?", korean: "안녕하세요, 오늘 어떻게 지내시나요?" },
            { id: 2, speaker: "cat", speakerName: "토키캣", english: "I am doing great, thanks for asking.", korean: "잘 지내고 있어요, 물어봐 주셔서 고마워요." }
          ],
      completedCount: 0,
    };

    return NextResponse.json({ success: true, script });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[TalkyCat API Error] generate-script failed. Falling back to mock script. Exact Error:", errMessage);
    return NextResponse.json({
      success: true,
      script: getFallbackScript(),
      fallback: true,
      error: errMessage
    });
  }
}
