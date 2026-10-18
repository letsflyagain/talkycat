import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { UserLevel } from "@/types/script";
import { getLevelInstruction } from "@/lib/levelPrompt";

interface HistoryItem {
  role: "assistant" | "user";
  text: string;
}

export async function POST(request: Request) {
  let parsedAnchorTopic: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const { history = [], userMessage = "", anchorTopic = null, isReset = false, userLevel = "A1" } = body;
    parsedAnchorTopic = anchorTopic;
    const validatedLevel: UserLevel = typeof userLevel === "string" ? (userLevel as UserLevel) : "A1";

    const apiKey = process.env.GEMINI_API_KEY;
    const isDefaultTopic = !anchorTopic || anchorTopic === "Casual Chat" || anchorTopic === "Free Talk" || anchorTopic === "General Chat";

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        messageEn: !isDefaultTopic ? `Let's talk about ${anchorTopic} again! What are your thoughts?` : "That sounds interesting! Tell me more about it.",
        messageKo: !isDefaultTopic ? `${anchorTopic}에 대해 다시 이야기해 보자! 네 생각은 어때?` : "정말 흥미롭다! 그에 대해 더 말해줘.",
        suggestedReplies: [
          "It's really fun and interesting.",
          "I usually talk about this."
        ],
        silentCorrection: null,
        extractedTopic: !isDefaultTopic ? anchorTopic : "General Chat"
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const levelInstruction = getLevelInstruction(validatedLevel);

    const topicInstruction = !isDefaultTopic
      ? `[CRITICAL TOPIC ANCHOR POLICY - STRICT]:
- The fixed main topic of this entire session is: "${anchorTopic}".
- You MUST keep the conversation strictly centered around "${anchorTopic}". Ask relevant follow-up questions, preferences, or details about "${anchorTopic}".
- NEVER drift away from "${anchorTopic}" or switch topics.`
      : `[TOPIC EXTRACTION RULE]:
- Since this is the user's first response, you MUST identify and extract the core topic keyword or phrase from their reply as a clear noun phrase within 2-3 words (e.g., "Coffee", "Travel", "Movies", "Weekend").
- Extract this precise topic keyword into 'extractedTopic'.`;

    const systemInstruction = `
당신은 영어 초보자를 위한 친절하고 인내심 있는 고양이 영어 튜터 '토키캣(TalkyCat)'이다냥.
현재 사용자의 CEFR 학습 레벨은 [${validatedLevel}]이다냥.
아래 규칙을 반드시 엄격하게 지켜주세요:
1. 사용자 레벨(${validatedLevel}) 맞춤형 응답 지침:
${levelInstruction}
2. 한 번에 딱 하나의 간단한 질문만 하고 사용자의 답변을 기다려주세요.
3. 사용자가 문법이나 표현 실수를 하더라도 대화 중 직접 지적하거나 교정하지 마세요. 교정 사항은 오직 silentCorrection 필드에만 담아주세요.
4. 토키캣 특유의 친근한 고양이 페르소나(~냥)를 유지해주세요.

${topicInstruction}

[CRITICAL: NO EMOJIS IN messageEn]
- The \`messageEn\` field must contain ONLY pure, natural spoken English text.
- NEVER include any emojis, emoticons, symbols, or asterisks (e.g., NO 🐾, NO 🐱, NO *giggles*) in \`messageEn\` because it will be fed directly into a text-to-speech engine.
- Korean translation (\`messageKo\`) and other UI text may contain friendly emojis, but \`messageEn\` must be 100% pure English alphabet and punctuation (. , ? !).

[출력 JSON 규격]
{
  "messageEn": "순수 영문 알파벳과 문장부호로만 이루어진 답변 (이모지 절대 금지)",
  "messageKo": "초보자를 위한 친절한 한국어 번역 (이모지 가능)",
  "suggestedReplies": ["사용자가 말하기 쉬운 힌트 답변 1", "힌트 답변 2"],
  "silentCorrection": "사용자 발화에 명백한 실수가 있었을 때만 채우는 부드러운 교정 팁 (없으면 null)",
  "extractedTopic": "주제 키워드 (2~3단어 이내의 명확한 명사형 키워드, 예: Coffee, Travel, Movies)"
}
`;

    // Sliding window: keep only the most recent 4 turns (2 pairs)
    const recentHistory: HistoryItem[] = Array.isArray(history) ? history.slice(-4) : [];

    let conversationContext = "";
    for (const item of recentHistory) {
      conversationContext += `${item.role === "assistant" ? "TalkyCat" : "User"}: ${item.text}\n`;
    }

    const prompt = `
${!isDefaultTopic ? `[Current Session Anchor Topic: ${anchorTopic}]` : ""}
${conversationContext ? `[Recent Conversation History]\n${conversationContext}\n` : ""}
[Current User Message]
${userMessage ? userMessage : "(Initial response)"}
[User CEFR Level: ${validatedLevel}]

Task: Respond as TalkyCat adhering strictly to the system instruction and outputting valid JSON matching the exact schema.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 150,
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
      parsed = {
        messageEn: !isDefaultTopic ? `Let's talk about ${anchorTopic} again! What are your thoughts?` : "That sounds interesting! Tell me more about it.",
        messageKo: !isDefaultTopic ? `${anchorTopic}에 대해 다시 이야기해 보자! 네 생각은 어때?` : "정말 흥미롭다! 그에 대해 더 말해줘.",
        suggestedReplies: [
          "It's really fun and interesting.",
          "I usually talk about this."
        ],
        silentCorrection: null,
        extractedTopic: !isDefaultTopic ? anchorTopic : "General Chat"
      };
    }

    return NextResponse.json({
      success: true,
      messageEn: parsed.messageEn || (!isDefaultTopic ? `Let's talk about ${anchorTopic} again! What are your thoughts?` : "Hi there! What topic would you like to talk about today?"),
      messageKo: parsed.messageKo || (!isDefaultTopic ? `${anchorTopic}에 대해 다시 이야기해 보자!` : "안녕! 오늘 어떤 주제로 이야기해볼까?"),
      suggestedReplies: Array.isArray(parsed.suggestedReplies) && parsed.suggestedReplies.length > 0 ? parsed.suggestedReplies : [
        "I want to talk more about this.",
        "That's so interesting!"
      ],
      silentCorrection: parsed.silentCorrection || null,
      extractedTopic: parsed.extractedTopic || (!isDefaultTopic ? anchorTopic : "General Chat")
    });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[TalkyCat API Error] free-talk failed:", errMessage);
    const isDefault = !parsedAnchorTopic || parsedAnchorTopic === "Casual Chat" || parsedAnchorTopic === "Free Talk" || parsedAnchorTopic === "General Chat";
    return NextResponse.json({
      success: true,
      messageEn: !isDefault ? `Let's talk about ${parsedAnchorTopic} again! What are your thoughts?` : "Oh, my paws got tangled! Let's talk again. What are you up to?",
      messageKo: !isDefault ? `${parsedAnchorTopic}에 대해 다시 이야기해 보자!` : "이런, 발이 엉켰네! 다시 이야기해 보자. 뭐 하고 지냈어?",
      suggestedReplies: [
        "I was resting at home.",
        "I went outside for a walk."
      ],
      silentCorrection: null,
      extractedTopic: !isDefault ? parsedAnchorTopic : "General Chat"
    });
  }
}
