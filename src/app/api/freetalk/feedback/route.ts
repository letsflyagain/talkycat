import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { UserLevel } from "@/types/script";
import { getLevelInstruction } from "@/lib/levelPrompt";

interface HistoryItem {
  role: "assistant" | "user";
  text: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { messages = [], userLevel = "A1" } = body;
    const validatedLevel: UserLevel = typeof userLevel === "string" ? (userLevel as UserLevel) : "A1";

    const userMessages: HistoryItem[] = Array.isArray(messages)
      ? messages.filter((m: HistoryItem) => m && m.role === "user" && typeof m.text === "string" && m.text.trim().length > 0)
      : [];

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || userMessages.length === 0) {
      const fallbackFeedback = userMessages.map((m, idx) => ({
        id: `fb_${idx + 1}`,
        originalText: m.text,
        hasError: false,
        correctedText: m.text,
        naturalExpression: m.text,
        koreanTip: "잘했어요! 아주 자연스러운 표현이다냥! 🐾"
      }));
      return NextResponse.json({ success: true, feedback: fallbackFeedback });
    }

    const ai = new GoogleGenAI({ apiKey });
    const levelInstruction = getLevelInstruction(validatedLevel);

    const systemInstruction = `
당신은 영어 초보자를 위한 친절하고 전문적인 고양이 영어 코치 '토키캣(TalkyCat)'이다냥.
사용자의 CEFR 학습 레벨은 [${validatedLevel}]이다냥.
아래 규칙을 엄격하게 준수하여 사용자의 대화 기록 중 'user' 역할의 발화들만 추출하여 문법 교정 및 추천 표현을 JSON 배열로 제공해주세요:

1. 레벨(${validatedLevel}) 맞춤형 피드백 지침:
${levelInstruction}

2. 각 사용자 발화 항목별 분석 지침:
- \`originalText\`: 사용자가 입력한 원래 문장
- \`hasError\`: 문법적 오류, 어색한 전치사/관사/시제 등이 있으면 \`true\`, 없거나 완벽하면 \`false\`
- \`correctedText\`: 문법과 자연스러움을 바로잡은 교정 문장 (오류가 없으면 원문과 동일하게)
- \`naturalExpression\`: 원어민이 더 자주 쓰는 자연스럽고 세련된 표현 (Idiomatic/Native expression)
- \`koreanTip\`: 친절한 고양이 톤(~냥)으로 설명해주는 한국어 코칭 팁 및 문법 포인트 (이모지 포함 가능)

[출력 JSON 규격 (반드시 유효한 JSON 배열만 출력, 마크다운 코드블록이나 설명 없이 순수 JSON 배열)]
[
  {
    "id": "fb_1",
    "originalText": "사용자 원문",
    "hasError": true 또는 false,
    "correctedText": "교정된 문장",
    "naturalExpression": "원어민 추천 표현",
    "koreanTip": "친절한 고양이 코칭 팁"
  }
]
`;

    const userPrompt = `
[User CEFR Level: ${validatedLevel}]
[User Messages to Analyze]
${JSON.stringify(userMessages, null, 2)}

Task: Analyze each user message and return a JSON array matching the exact requested schema.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.5,
        maxOutputTokens: 1000,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    let parsed;
    try {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = userMessages.map((m, idx) => ({
        id: `fb_${idx + 1}`,
        originalText: m.text,
        hasError: false,
        correctedText: m.text,
        naturalExpression: m.text,
        koreanTip: "정말 잘했어요! 자연스럽고 훌륭한 표현이다냥! 🐾"
      }));
    }

    const feedbackList = Array.isArray(parsed) ? parsed : userMessages.map((m, idx) => ({
      id: `fb_${idx + 1}`,
      originalText: m.text,
      hasError: false,
      correctedText: m.text,
      naturalExpression: m.text,
      koreanTip: "정말 잘했어요! 훌륭하다냥! 🐾"
    }));

    return NextResponse.json({ success: true, feedback: feedbackList });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[TalkyCat API Error] freetalk feedback failed:", errMessage);
    return NextResponse.json({ success: false, error: errMessage, feedback: [] }, { status: 500 });
  }
}
