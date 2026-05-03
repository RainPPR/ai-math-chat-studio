export async function fetchDs2apiModels() {
  try {
    const response = await fetch('/api/ds2api/models');
    if (!response.ok) throw new Error("Failed to fetch DS2API models");
    const data = await response.json();
    return data.data.map((m: any) => m.id);
  } catch (error) {
    console.error("DS2API Models fetch error", error);
    return [
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "deepseek-v4-flash-search",
      "deepseek-v4-pro-search",
      "deepseek-v4-vision"
    ];
  }
}

export async function generateDs2apiChatResponse(
  model: string,
  systemPrompt: string,
  history: { role: 'user' | 'model', content: string }[],
  newMessage: string,
  temperature: number,
  topP: number,
  maxTokens: number,
  extraBody: any,
  onUpdate: (text: string) => void,
  options?: { signal?: AbortSignal }
) {
  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  const activeHistory = history.length > 40 ? history.slice(-40) : history;
  
  for (const msg of activeHistory) {
    messages.push({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.content
    });
  }

  messages.push({
    role: 'user',
    content: newMessage
  });

  const response = await fetch('/api/ds2api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options?.signal,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      extra_body: extraBody
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate DS2API response");
  }

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let isThinking = false;
  let fullText = "";
  let lastUpdateTime = 0;
  
  const throttledUpdate = (text: string) => {
    const now = Date.now();
    if (now - lastUpdateTime > 50) {
      onUpdate(text);
      lastUpdateTime = now;
    }
  };

  while (true) {
    if (options?.signal?.aborted) {
      reader.cancel();
      break;
    }
    const { done, value } = await reader.read();
    if (done) break;

    const chunkStr = decoder.decode(value, { stream: true });
    const lines = chunkStr.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.reasoning) {
            if (!isThinking) {
              isThinking = true;
              fullText += "<details open>\n<summary>Thinking Process</summary>\n\n```text\n";
            }
            fullText += data.reasoning;
          }
          if (data.content) {
            if (isThinking) {
              isThinking = false;
              fullText += "\n```\n\n</details>\n\n";
            }
            fullText += data.content;
          }
          throttledUpdate(fullText);
        } catch (e) {
          console.error("Parse error stream chunk", e, line);
        }
      }
    }
  }

  if (isThinking) {
    fullText += "\n```\n\n</details>\n\n";
    isThinking = false;
  }
  
  fullText = fullText.replace(/<details open>/g, '<details>');
  onUpdate(fullText);
  return fullText;
}
