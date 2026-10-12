import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

interface HistoryItem {
  role: "assistant" | "user";
  text: string;
}

export async function POST(request: Request) {
  let parsedAnchorTopic: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const { history = [], userMessage = "", anchorTopic = null, isReset = false } = body;
    parsedAnchorTopic = anchorTopic;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        messageEn: anchorTopic ? `Let's talk about ${anchorTopic} again! What are your thoughts?` : "Hi there! What topic would you like to talk about today?",
        messageKo: anchorTopic ? `${anchorTopic}에 대해 다시 이야기해 보자! 네 생각은 어때?` : "안녕! 오늘 어떤 주제로 이야기해볼까?",
        suggestedReplies: [
          "I want to talk about my weekend plans.",
          "Let's talk about my favorite food!"
        ],
        silentCorrection: null,
        extractedTopic: anchorTopic || "General Chat"
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
당신은 영어 초보자를 위한 친절하고 인내심 있는 고양이 영어 튜터 '토키캣(TalkyCat)'이다냥.
아래 규칙을 반드시 엄격하게 지켜주세요:
1. 짧고 쉬운 문장으로만 말해주세요 (CEFR A1~A2 기초 수준 어휘).
2. 한 번에 딱 하나의 간단한 질문만 하고 사용자의 답변을 기다려주세요.
3. 사용자가 문법이나 표현 실수를 하더라도 대화 중 직접 지적하거나 교정하지 마세요. 대화는 자연스럽게 이어가되, 교정 사항은 오직 silentCorrection 필드에만 담아주세요.
4. 자연스러운 티키타카를 위해 영문 답변 길이는 2~3문장 이내로 짧게 유지해주세요.
5. 대화의 첫 시작(history가 비어있거나 userMessage가 없는 경우 또는 isReset인 경우):
   - If anchorTopic is not set, use: "Hi there! What topic would you like to talk about today?"
   - If anchorTopic IS set (e.g. conversation reset), greet warmly and ask a fresh opening question strictly about "${anchorTopic}".

[CRITICAL: NO EMOJIS IN messageEn]
- The \`messageEn\` field must contain ONLY pure, natural spoken English text.
- NEVER include any emojis, emoticons, symbols, or asterisks (e.g., NO 🐾, NO 🐱, NO *giggles*) in \`messageEn\` because it will be fed directly into a text-to-speech engine.
- Korean translation (\`messageKo\`) and other UI text may contain friendly emojis, but \`messageEn\` must be 100% pure English alphabet and punctuation (. , ? !).

${
  anchorTopic
    ? `[CRITICAL TOPIC ANCHOR POLICY]
- The fixed main topic of this entire session is: "${anchorTopic}".
- The user's input comes from mobile speech recognition, which frequently mishears words.
- Even if the user's utterance contains weird, nonsensical, or out-of-context words, NEVER switch to a different topic.
- Always interpret the utterance within the context of "${anchorTopic}" and keep your next response and single question focused strictly on "${anchorTopic}".`
    : `[TOPIC EXTRACTION]
- Since this is the user's response to your opening question, identify and extract the core topic keyword or phrase from their reply (e.g. "Coffee & Cafe", "Travel & Vacation", "Movies & Drama") and return it in the 'extractedTopic' field.`
}

[출력 JSON 규격]
{
  "messageEn": "순수 영문 알파벳과 문장부호로만 이루어진 답변 (이모지 절대 금지)",
  "messageKo": "초보자를 위한 친절한 한국어 번역 (이모지 가능)",
  "suggestedReplies": ["사용자가 말하기 쉬운 힌트 답변 1", "힌트 답변 2"],
  "silentCorrection": "사용자 발화에 명백한 실수가 있었을 때만 채우는 부드러운 교정 팁 (없으면 null)",
  "extractedTopic": "주제 키워드 (첫 턴에만 추출하여 반환, 이후엔 기존 anchorTopic 유지)"
}
`;

    // Sliding window: keep only the most recent 4 turns (2 pairs)
    const recentHistory: HistoryItem[] = isReset ? [] : (Array.isArray(history) ? history.slice(-4) : []);

    let conversationContext = "";
    for (const item of recentHistory) {
      conversationContext += `${item.role === "assistant" ? "TalkyCat" : "User"}: ${item.text}\n`;
    }

    const prompt = `
${anchorTopic ? `[Current Session Anchor Topic: ${anchorTopic}]` : ""}
${isReset ? "[Action: Reset conversation and start fresh with a new question about the anchor topic]" : ""}
${conversationContext ? `[Recent Conversation History]\n${conversationContext}\n` : ""}
[Current User Message]
${userMessage ? userMessage : "(Initial start of conversation)"}

Task: Respond as TalkyCat adhering strictly to the system instruction and outputting valid JSON matching the exact schema.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite", // CRITICAL requirement
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 150, // CRITICAL requirement for fast TTFT
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
        messageEn: anchorTopic ? `Let's talk about ${anchorTopic} again! What are your thoughts?` : "That sounds interesting! Tell me more about it.",
        messageKo: anchorTopic ? `${anchorTopic}에 대해 다시 이야기해 보자! 네 생각은 어때?` : "정말 흥미롭다! 그에 대해 더 말해줘.",
        suggestedReplies: [
          "It's really fun and interesting.",
          "I usually talk about this."
        ],
        silentCorrection: null,
        extractedTopic: anchorTopic || "General Chat"
      };
    }

    return NextResponse.json({
      success: true,
      messageEn: parsed.messageEn || (anchorTopic ? `Let's talk about ${anchorTopic} again! What are your thoughts?` : "Hi there! What topic would you like to talk about today?"),
      messageKo: parsed.messageKo || (anchorTopic ? `${anchorTopic}에 대해 다시 이야기해 보자!` : "안녕! 오늘 어떤 주제로 이야기해볼까?"),
      suggestedReplies: Array.isArray(parsed.suggestedReplies) && parsed.suggestedReplies.length > 0 ? parsed.suggestedReplies : [
        "I want to talk more about this.",
        "That's so interesting!"
      ],
      silentCorrection: parsed.silentCorrection || null,
      extractedTopic: parsed.extractedTopic || anchorTopic || "General Chat"
    });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[TalkyCat API Error] free-talk failed:", errMessage);
    return NextResponse.json({
      success: true,
      messageEn: parsedAnchorTopic ? `Let's talk about ${parsedAnchorTopic} again! What are your thoughts?` : "Oh, my paws got tangled! Let's talk again. What are you up to?",
      messageKo: parsedAnchorTopic ? `${parsedAnchorTopic}에 대해 다시 이야기해 보자!` : "이런, 발이 엉켰네! 다시 이야기해 보자. 뭐 하고 지냈어?",
      suggestedReplies: [
        "I was resting at home.",
        "I went outside for a walk."
      ],
      silentCorrection: null,
      extractedTopic: parsedAnchorTopic || "General Chat"
    });
  }
}
