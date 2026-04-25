import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-3.1-pro-preview',
    contents: 'hello',
  });
  
  console.log("Keys of responseStream:", Object.keys(responseStream));
  
  for await (const chunk of responseStream) {
    // just consume
  }
  
  console.log("After consume, keys:", Object.keys(responseStream));
}
run();
