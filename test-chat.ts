import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const chat = ai.chats.create({ model: 'gemini-3.1-pro-preview' });
  console.log(typeof chat.sendMessageStream);
}
run();
