import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Nvidia
  app.post("/api/nvidia/chat", async (req, res) => {
    try {
      const { model, messages, temperature, top_p, max_tokens, extra_body } = req.body;
      
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "NVIDIA_API_KEY is not set globally." });
      }

      const client = new OpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey,
      });

      const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
        top_p,
        max_tokens,
        ...(extra_body || {}),
        stream: true,
      } as any) as any;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta as any;
        const reasoning = delta?.reasoning || delta?.reasoning_content;
        const content = delta?.content;
        
        let chunkData: any = {};
        if (reasoning) {
          chunkData.reasoning = reasoning;
        }
        if (content) {
          chunkData.content = content;
        }

        if (Object.keys(chunkData).length > 0) {
          res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();

    } catch (error: any) {
      console.error("Nvidia API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate text." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
