import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: 'hello',
      config: {
        thinkingConfig: { thinkingLevel: 'LOW' as any }
      }
    });
    console.log(response.text);
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
