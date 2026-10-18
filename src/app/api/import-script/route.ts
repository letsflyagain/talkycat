import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { UserLevel } from "@/types/script";
import { getLevelInstruction } from "@/lib/levelPrompt";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { rawText = "", userLevel: lvl = "A1" } = body;
    const userLevel: UserLevel = typeof lvl === "string" ? (lvl as UserLevel) : "A1";

    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: "No raw text provided for import."
      }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback mock if no API key
      const fallbackId = Date.now().toString();
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
      return NextResponse.json({
        success: true,
        script: {
          id: fallbackId,
          date: today,
          level: userLevel,
          category: "생활영어",
          title: "가져온 대본 (임포트)",
          mission: "가져온 외부 텍스트를 기초 영어 회화로 연습하기",
          corePatterns: [
            { pattern: "Can you tell me ~?", meaning: "~를 말씀해 주시겠어요?" },
            { pattern: "I understand.", meaning: "알겠습니다." }
          ],
          pronunciationTip: {
            word: "understand",
            phonetic: "[ˌʌndərˈstænd]",
            tip: "강세는 뒤쪽 '스탠드'에 둡니다!"
          },
          catTip: "가져온 대본을 가벼운 마음으로 소리 내어 읽어보라냥! 🐾",
          dialogue: [
            { id: 1, speaker: "user", speakerName: "A", english: "Hello! Let's talk about this text.", korean: "안녕하세요! 이 텍스트에 대해 이야기해봐요." },
            { id: 2, speaker: "cat", speakerName: "B", english: "Sure, I am ready to practice.", korean: "물론이죠, 연습할 준비가 되었어요." }
          ],
          completedCount: 0
        }
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const levelInstruction = getLevelInstruction(userLevel);

    const systemInstruction = `
You are an expert AI English tutor and script editor ('TalkyCat').
Your task is to parse raw external text (such as YouTube transcripts, TV show quotes, textbook passages, or notes) provided by the user, and transform it into a structured, beginner-friendly roleplay script (CEFR ${userLevel} level) formatted strictly as JSON.

[CRITICAL RULES]
1. Zero-Storage: Do not store or log personal sensitive data. Process transiently.
2. Difficulty Adjustment (${userLevel} Level Fitting):
   - Keep the original context and meaning, but adapt sentence structure, vocabulary, and phrasing to match CEFR ${userLevel} level: ${levelInstruction}
3. Overview & Learning Points:
   - Extract or generate 2-3 essential 'corePatterns' (pattern + meaning).
   - Generate a useful 'pronunciationTip' (word, phonetic, tip).
   - Generate a friendly 'catTip' (nuance/learning tip with a cat paw 🐾 vibe).
4. Dialogue Normalization:
   - Break down the conversation into alternating turns between two speakers labeled as "A" and "B".
   - Even indices (0, 2, 4...) have speaker: "user", speakerName: "A".
   - Odd indices (1, 3, 5...) have speaker: "cat", speakerName: "B".
   - Provide natural Korean translations ('korean') for every dialogue line.
5. Category:
   - Choose one of: "생활영어", "비즈니스", "여행/식당", "영화/드라마 명장면" based on the content.
6. Output Format:
   - Return ONLY valid JSON matching the exact schema below, with no markdown wrappers if possible (or cleaned).

[OUTPUT JSON SCHEMA]
{
  "id": "timestamp_string",
  "date": "YYYY.MM.DD",
  "category": "생활영어 | 비즈니스 | 여행/식당 | 영화/드라마 명장면",
  "title": "상황에 어울리는 간결하고 직관적인 제목 (한국어)",
  "mission": "학습자가 완수해야 할 미션 설명 (한국어)",
  "corePatterns": [
    { "pattern": "Core expression pattern 1", "meaning": "한국어 의미" },
    { "pattern": "Core expression pattern 2", "meaning": "한국어 의미" }
  ],
  "pronunciationTip": {
    "word": "difficult word",
    "phonetic": "[phonetic]",
    "tip": "발음 팁 설명"
  },
  "catTip": "학습 뉘앙스 팁 (이모지 포함 가능)",
  "dialogue": [
    {
      "id": 1,
      "speaker": "user",
      "speakerName": "A",
      "english": "Pure English dialogue line A adapted to ${userLevel}",
      "korean": "자연스러운 한국어 해석 A"
    },
    {
      "id": 2,
      "speaker": "cat",
      "speakerName": "B",
      "english": "Pure English dialogue line B adapted to ${userLevel}",
      "korean": "자연스러운 한국어 해석 B"
    }
  ],
  "completedCount": 0
}
`;

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
    const prompt = `
[Raw External Text Input]
${rawText}

Task: Transform the above text into TalkyCat roleplay script JSON according to the system instructions. Ensure id is "${Date.now()}" and date is "${today}".
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 1500,
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
      if (!parsed.level) {
        parsed.level = userLevel;
      }
    } catch {
      throw new Error("Failed to parse JSON from Gemini response");
    }

    return NextResponse.json({
      success: true,
      script: parsed
    });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[TalkyCat API Error] import-script failed:", errMessage);
    return NextResponse.json({
      success: false,
      error: errMessage
    }, { status: 500 });
  }
}
