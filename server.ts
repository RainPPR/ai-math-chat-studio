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

      const payload: any = {
        model,
        messages,
        stream: true,
      };

      if (temperature !== undefined && temperature !== null) payload.temperature = temperature;
      if (top_p !== undefined && top_p !== null) payload.top_p = top_p;
      if (max_tokens !== undefined && max_tokens !== null) payload.max_tokens = max_tokens;

      const response = await client.chat.completions.create({
        ...payload,
        ...(extra_body || {}),
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

  // API Route for Cloudflare Workers AI
  app.post("/api/cloudflare/chat", async (req, res) => {
    try {
      const { model, messages, temperature, top_p, max_tokens, extra_body } = req.body;
      
      const apiKey = process.env.CLOUDFLARE_API_KEY;
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      
      if (!apiKey || !accountId) {
        return res.status(500).json({ error: "CLOUDFLARE_API_KEY or CLOUDFLARE_ACCOUNT_ID is not set." });
      }
      
      const client = new OpenAI({
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
        apiKey,
      });

      const payload: any = {
        model,
        messages,
        stream: true,
      };

      if (temperature !== undefined && temperature !== null) payload.temperature = temperature;

      const response = await client.chat.completions.create(payload as any) as any;

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
      console.error("Cloudflare API Error:", error.response?.data || error.status || error);
      res.status(500).json({ error: error.message || "Failed to generate text." });
    }
  });

  app.get("/api/cloudflare/models", async (req, res) => {
    try {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiKey = process.env.CLOUDFLARE_API_KEY;
      if (!accountId || !apiKey) {
        return res.json([
          "@cf/meta/llama-3.1-8b-instruct",
          "@cf/meta/llama-3.1-70b-instruct",
          "@cf/meta/llama-3-8b-instruct",
          "@cf/mistral/mistral-7b-instruct-v0.2",
          "@cf/qwen/qwen1.5-14b-chat-awq",
          "@cf/google/gemma-7b-it"
        ]);
      }
      
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      const data = await response.json();
      if (data.success) {
        res.json(data.result.filter((m: any) => m.task.name === "Text Generation").map((m: any) => m.name));
      } else {
        throw new Error(data.errors?.[0]?.message || "Failed to fetch models");
      }
    } catch (error: any) {
      console.error("Cloudflare Models Error:", error);
      res.json([
        "@cf/meta/llama-3.1-8b-instruct",
        "@cf/meta/llama-3.1-70b-instruct",
        "@cf/meta/llama-3-8b-instruct",
        "@cf/mistral/mistral-7b-instruct-v0.2",
        "@cf/qwen/qwen1.5-14b-chat-awq",
        "@cf/google/gemma-7b-it"
      ]);
    }
  });

  // API Route for AIHubMix
  app.post("/api/aihubmix/chat", async (req, res) => {
    try {
      const { model, messages, temperature, top_p, max_tokens, extra_body } = req.body;
      
      const apiKey = process.env.AIHUBMIX_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "AIHUBMIX_API_KEY is not set." });
      }

      const client = new OpenAI({
        baseURL: "https://aihubmix.com/v1",
        apiKey,
      });

      const payload: any = {
        model,
        messages,
        stream: true,
      };

      if (temperature !== undefined && temperature !== null) payload.temperature = temperature;
      if (top_p !== undefined && top_p !== null) payload.top_p = top_p;
      if (max_tokens !== undefined && max_tokens !== null) payload.max_tokens = max_tokens;

      const response = await client.chat.completions.create({
        ...payload,
        ...(extra_body || {}),
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
      console.error("AIHubMix API Error:", error.response?.data || error.status || error);
      res.status(500).json({ error: error.message || "Failed to generate text." });
    }
  });

  app.get("/api/aihubmix/models", async (req, res) => {
    try {
      const response = await fetch("https://aihubmix.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${process.env.AIHUBMIX_API_KEY || ''}`
        }
      });
      if (!response.ok) {
        // Fallback static list based on docs
        return res.json([
          "gpt-4o-mini",
          "gpt-4o-search-preview",
          "gpt-4o-mini-search-preview",
          "claude-sonnet-4-6",
          "glm-5",
          "gemini-3.1-pro-preview"
        ]);
      }
      const data = await response.json();
      res.json(data.data.map((m: any) => m.id));
    } catch (error: any) {
      console.error("AIHubMix Models Error:", error);
      res.json([
        "gpt-4o-mini",
        "claude-sonnet-4-6",
        "glm-5",
        "gemini-3.1-pro-preview"
      ]);
    }
  });

  // API Route for Poe
  app.post("/api/poe/chat", async (req, res) => {
    try {
      const { model, messages, temperature, top_p, max_tokens, extra_body, tools } = req.body;
      
      const apiKey = process.env.POE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "POE_API_KEY is not set." });
      }

      const client = new OpenAI({
        baseURL: "https://api.poe.com/v1",
        apiKey,
      });

      const payload: any = {
        model,
        messages,
        stream: true,
      };

      if (temperature !== undefined && temperature !== null) payload.temperature = temperature;
      if (top_p !== undefined && top_p !== null) payload.top_p = top_p;
      if (max_tokens !== undefined && max_tokens !== null) payload.max_tokens = max_tokens;
      if (tools && tools.length > 0) payload.tools = tools;

      const response = await client.chat.completions.create({
        ...payload,
        ...(extra_body || {}),
      } as any) as any;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta as any;
        const reasoning = delta?.reasoning || delta?.reasoning_content;
        const content = delta?.content;
        const tool_calls = delta?.tool_calls;
        
        let chunkData: any = {};
        if (reasoning) chunkData.reasoning = reasoning;
        if (content) chunkData.content = content;
        if (tool_calls) chunkData.tool_calls = tool_calls;

        if (Object.keys(chunkData).length > 0) {
          res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();

    } catch (error: any) {
      console.error("Poe API Error:", error.response?.data || error.status || error);
      res.status(500).json({ error: error.message || "Failed to generate text." });
    }
  });

  app.get("/api/poe/models", async (req, res) => {
    try {
      const response = await fetch("https://api.poe.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${process.env.POE_API_KEY || ''}`
        }
      });
      if (!response.ok) {
        return res.json([
          "Claude-Sonnet-4.6",
          "GPT-5.4",
          "Claude-Opus-4.7",
          "Gemini-3.1-Pro",
          "o3-mini",
          "Claude-3.5-Haiku"
        ]);
      }
      const data = await response.json();
      res.json(data.data.map((m: any) => m.id));
    } catch (error: any) {
      console.error("Poe Models Error:", error);
      res.json([
        "Claude-Sonnet-4.6",
        "GPT-5.4",
        "Claude-Opus-4.7",
        "Gemini-3.1-Pro",
        "o3-mini",
        "Claude-3.5-Haiku"
      ]);
    }
  });

  // API Route for Opengateway
  app.post("/api/opengateway/chat", async (req, res) => {
    try {
      const { model, messages, temperature, top_p, max_tokens, extra_body } = req.body;
      
      const apiKey = process.env.OPENGATEWAY_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OPENGATEWAY_API_KEY or OPENAI_API_KEY is required to use Gitlawb Opengateway." });
      }

      const client = new OpenAI({
        baseURL: "https://opengateway.gitlawb.com/v1",
        apiKey,
      });

      const payload: any = {
        model,
        messages,
        stream: true,
      };

      if (temperature !== undefined && temperature !== null) payload.temperature = temperature;
      if (top_p !== undefined && top_p !== null) payload.top_p = top_p;
      if (max_tokens !== undefined && max_tokens !== null) payload.max_tokens = max_tokens;

      const response = await client.chat.completions.create({
        ...payload,
        ...(extra_body || {}),
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
      console.error("Opengateway API Error:", error.response?.data || error.status || error);
      res.status(500).json({ error: error.message || "Failed to generate text from Opengateway." });
    }
  });

  app.get("/api/opengateway/models", async (req, res) => {
    try {
      const apiKey = process.env.OPENGATEWAY_API_KEY || process.env.OPENAI_API_KEY;
      const headers: any = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      const response = await fetch("https://opengateway.gitlawb.com/v1/models", {
        headers
      });
      if (!response.ok) {
        return res.json([
          "mimo-v2.5-pro",
          "mimo-v2-pro",
          "mimo-v2.5",
          "mimo-v2-omni",
          "mimo-v2-flash",
          "google/gemini-3.1-flash-lite-preview"
        ]);
      }
      const data = await response.json();
      res.json(data.data.map((m: any) => m.id));
    } catch (error: any) {
      console.error("Opengateway Models Error:", error);
      res.json([
        "mimo-v2.5-pro",
        "mimo-v2-pro",
        "mimo-v2.5",
        "mimo-v2-omni",
        "mimo-v2-flash",
        "google/gemini-3.1-flash-lite-preview"
      ]);
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
