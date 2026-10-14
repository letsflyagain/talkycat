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
    const isDefaultTopic = !anchorTopic || anchorTopic === "Casual Chat" || anchorTopic === "Free Talk" || anchorTopic === "General Chat";

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        messageEn: !isDefaultTopic ? `Let's talk about ${anchorTopic} again! What are your thoughts?` : "Hi there! What topic would you like to talk about today?",
        messageKo: !isDefaultTopic ? `${anchorTopic}에 대해 다시 이야기해 보자! 네 생각은 어때?` : "안녕! 오늘 어떤 주제로 이야기해볼까?",
        suggestedReplies: [
          "I want to talk about my weekend plans.",
          "Let's talk about my favorite food!"
        ],
        silentCorrection: null,
        extractedTopic: !isDefaultTopic ? anchorTopic : "General Chat"
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

[CRITICAL: NO EMOJIS IN messageEn]
- The \`messageEn\` field must contain ONLY pure, natural spoken English text.
- NEVER include any emojis, emoticons, symbols, or asterisks (e.g., NO 🐾, NO 🐱, NO *giggles*) in \`messageEn\` because it will be fed directly into a text-to-speech engine.
- Korean translation (\`messageKo\`) and other UI text may contain friendly emojis, but \`messageEn\` must be 100% pure English alphabet and punctuation (. , ? !).

${
  isReset
    ? `[CRITICAL RESET POLICY]
- The user has completely reset the conversation for the topic: "${anchorTopic || "General Chat"}".
- Ignore all previous conversation history completely and treat context as empty.
- Greet warmly and ask a fresh, engaging, opening question strictly about "${anchorTopic || "General Chat"}".`
    : !isDefaultTopic
    ? `[CRITICAL TOPIC ANCHOR POLICY]
- The fixed main topic of this entire session is: "${anchorTopic}".
- The user's input comes from mobile speech recognition, which frequently mishears words.
- Even if the user's utterance contains weird, nonsensical, or out-of-context words, NEVER switch to a different topic.
- Always interpret the utterance within the context of "${anchorTopic}" and keep your next response and single question focused strictly on "${anchorTopic}".`
    : `[TOPIC EXTRACTION RULE]
- Since this is the initial phase or user's response to the opening question, you MUST identify and extract the core topic keyword or phrase from their reply as a clear noun phrase within 2-3 words (e.g., "Coffee & Cafe", "Movies", "Weekend Relaxation", "Travel").
- NEVER return generic default values like "Casual Chat" or "Free Talk" when user provides a specific response. Always extract a precise topic keyword into 'extractedTopic'.`
}

[출력 JSON 규격]
{
  "messageEn": "순수 영문 알파벳과 문장부호로만 이루어진 답변 (이모지 절대 금지)",
  "messageKo": "초보자를 위한 친절한 한국어 번역 (이모지 가능)",
  "suggestedReplies": ["사용자가 말하기 쉬운 힌트 답변 1", "힌트 답변 2"],
  "silentCorrection": "사용자 발화에 명백한 실수가 있었을 때만 채우는 부드러운 교정 팁 (없으면 null)",
  "extractedTopic": "주제 키워드 (2~3단어 이내의 명확한 명사형 키워드, 예: Coffee & Cafe, Movies, Travel)"
}
`;

    // Sliding window: keep only the most recent 4 turns (2 pairs), completely ignored if isReset
    const recentHistory: HistoryItem[] = isReset ? [] : (Array.isArray(history) ? history.slice(-4) : []);

    let conversationContext = "";
    if (!isReset) {
      for (const item of recentHistory) {
        conversationContext += `${item.role === "assistant" ? "TalkyCat" : "User"}: ${item.text}\n`;
      }
    }

    const prompt = `
${!isDefaultTopic ? `[Current Session Anchor Topic: ${anchorTopic}]` : ""}
${isReset ? `[Action: Reset conversation completely. Start fresh with a new question about "${anchorTopic || "General Chat"}".]` : ""}
${conversationContext && !isReset ? `[Recent Conversation History]\n${conversationContext}\n` : ""}
[Current User Message]
${userMessage ? userMessage : "(Initial start of conversation or reset)"}

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
