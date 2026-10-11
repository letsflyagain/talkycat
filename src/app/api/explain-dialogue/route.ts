import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { scriptTitle = "", targetEnglish = "", targetKorean = "", questionType = "alternative", customQuestion = "" } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        summary: "API 키가 설정되지 않았다냥! 🐾",
        items: [
          { en: targetEnglish, ko: "환경 변수 GEMINI_API_KEY를 확인해달라냥." }
        ]
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
You are 'TalkyCat 🐾', a friendly, warm, and expert AI English coach for adult learners at CEFR A1~A2 level.
Your tone must be cute, encouraging, and cat-like (using endings like "~다냥!", "~해보라냥!", "~해달라냥! 🐾").
Provide structured coaching responses based on the user's question type.
Always respond in strict JSON format matching this exact structure:
{
  "summary": "string (A warm, friendly one-line summary guide from TalkyCat with cat tone)",
  "items": [
    {
      "en": "string (English expression, sentence, or key word/phrase related to the coaching)",
      "ko": "string (Explanation, nuance description, or alternative meaning in Korean with cat tone)"
    }
  ]
}
`;

    let specificInstruction = "";
    if (questionType === "alternative") {
      specificInstruction = `Provide 2~3 natural alternative English expressions for the sentence "${targetEnglish}" in the situation ("${scriptTitle}"), explaining the nuance or context for each item in Korean.`;
    } else if (questionType === "nuance") {
      specificInstruction = `Explain the subtle emotional feeling, native speaker nuance, and cultural background of the expression "${targetEnglish}" (meaning: "${targetKorean}"). Break down key chunks or phrases into items with 'en' and 'ko'.`;
    } else if (questionType === "pronunciation") {
      specificInstruction = `Provide practical speaking tips for "${targetEnglish}" covering liaison (연음), sentence stress (강세), and pronunciation guide. List key phrases or phonetic chunks in 'en' and explanation in 'ko'.`;
    } else if (questionType === "custom" && customQuestion) {
      specificInstruction = `Answer the user's custom question: "${customQuestion}" regarding the English sentence "${targetEnglish}" ("${targetKorean}") in the context of "${scriptTitle}". Provide clear examples in 'en' and explanations in 'ko'.`;
    } else {
      specificInstruction = `Explain the practical usage and meaning of the English sentence "${targetEnglish}" ("${targetKorean}") warmly and clearly in structured items.`;
    }

    const prompt = `
Context Script Title: "${scriptTitle}"
Target English Sentence: "${targetEnglish}"
Target Korean Translation: "${targetKorean}"
Question Type: "${questionType}"
${customQuestion ? `Custom Question: "${customQuestion}"` : ""}

Task: ${specificInstruction}

Return JSON with exact structure:
{
  "summary": "...",
  "items": [
    { "en": "...", "ko": "..." }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite", // CRITICAL requirement
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
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
        summary: "토키캣의 한 줄 코칭 가이드다냥! 🐾",
        items: [
          { en: targetEnglish, ko: responseText.trim() }
        ]
      };
    }

    return NextResponse.json({
      success: true,
      summary: parsed.summary || "토키캣의 코칭 답변이다냥! 🐾",
      items: Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : [
        { en: targetEnglish, ko: "자연스럽게 말해보라냥! 🐾" }
      ]
    });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[TalkyCat API Error] explain-dialogue failed:", errMessage);
    return NextResponse.json({
      success: true,
      summary: "토키캣이 졸고 있나 보다냥! 🐾",
      items: [
        { en: "Hello", ko: "다시 물어봐달라냥! 🐾" }
      ]
    });
  }
}
