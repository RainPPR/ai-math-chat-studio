> [!NOTE]
> This page covers the `generateContent` API. For new projects, we recommend the new **Interactions API** (Beta), which offers server-side history, built-in support for agentic workflows, and future new Gemini capabilities. Use the **API switcher toggle** at the top of the page to switch to the Interactions API quickstart.

This quickstart shows you how to install our
[libraries](https://ai.google.dev/gemini-api/docs/libraries) and make your first request, stream
responses, build multi-turn conversations, and use tools using the standard
`generateContent` method.

## Before you begin

To use the Gemini API, you need to have an API key to authenticate your requests, enforce security limits, and track usage to your account.

Create one on AI Studio for free to get started:

[Create a Gemini API Key](https://aistudio.google.com/app/apikey)

## Install the Google GenAI SDK

### Python

Using [Python 3.9+](https://www.python.org/downloads/), install the
[`google-genai` package](https://pypi.org/project/google-genai/)
using the following
[pip command](https://packaging.python.org/en/latest/tutorials/installing-packages/):

    pip install -q -U google-genai

### JavaScript

Using [Node.js v18+](https://nodejs.org/en/download/package-manager),
install the
[Google Gen AI SDK for TypeScript and JavaScript](https://www.npmjs.com/package/@google/genai)
using the following
[npm command](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):

    npm install @google/genai

## Generate text

Use the `models.generate_content` method to
[generate a text response](https://ai.google.dev/gemini-api/docs/text-generation).

### Python

    from google import genai

    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Explain how AI works in a few words"
    )

    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Explain how AI works in a few words",
      });

      console.log(response.text);
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "Explain how AI works in a few words"
              }
            ]
          }
        ]
      }'

## Stream responses

By default, the model returns a response only after the entire generation
process is complete. For a faster, more interactive experience, you can
[stream the response](https://ai.google.dev/gemini-api/docs/text-generation#stream) chunks as they
are generated.

### Python

    response = client.models.generate_content_stream(
        model="gemini-3.5-flash",
        contents="Explain how AI works in detail"
    )

    for chunk in response:
        print(chunk.text, end="", flush=True)

### JavaScript

    async function main() {
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: "Explain how AI works in detail",
      });

      for await (const chunk of responseStream) {
        process.stdout.write(chunk.text);
      }
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      --no-buffer \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "Explain how AI works in detail"
              }
            ]
          }
        ]
      }'

## Multi-turn conversations

For multi-turn conversations, the SDKs provide a stateful `chats` helper to
build a [multi-turn chat experience](https://ai.google.dev/gemini-api/docs/text-generation#chat)
that automatically manages conversation history.

### Python

    chat = client.chats.create(model="gemini-3.5-flash")

    response1 = chat.send_message("I have 2 dogs in my house.")
    print("Response 1:", response1.text)

    response2 = chat.send_message("How many paws are in my house?")
    print("Response 2:", response2.text)

### JavaScript

    async function main() {
      const chat = ai.chats.create({ model: "gemini-3.5-flash" });

      let response = await chat.sendMessage({ message: "I have 2 dogs in my house." });
      console.log("Response 1:", response.text);

      response = await chat.sendMessage({ message: "How many paws are in my house?" });
      console.log("Response 2:", response.text);
    }

    main();

### REST

    # REST is stateless. You must pass the full conversation history in the request.
    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "role": "user",
            "parts": [{"text": "I have 2 dogs in my house."}]
          },
          {
            "role": "model",
            "parts": [{"text": "That is nice! Two dogs mean you have plenty of company."}]
          },
          {
            "role": "user",
            "parts": [{"text": "How many paws are in my house?"}]
          }
        ]
      }'

## Use tools

Extend the model's capabilities by
[grounding responses with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
to access real-time web content. The model automatically decides when to
search, executes queries, and synthesizes a response.

### Python

    from google import genai
    from google.genai import types

    config = types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    )

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Who won the euro 2024?",
        config=config
    )

    print(response.text)

    metadata = response.candidates[0].grounding_metadata
    if metadata.web_search_queries:
        print("\nSearch queries executed:")
        for query in metadata.web_search_queries:
            print(f" - {query}")

    if metadata.grounding_chunks:
        print("\nSources:")
        for chunk in metadata.grounding_chunks:
            print(f" - [{chunk.web.title}]({chunk.web.uri})")

### JavaScript

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Who won the euro 2024?",
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      console.log(response.text);

      const metadata = response.candidates[0]?.groundingMetadata;
      if (metadata?.webSearchQueries) {
        console.log("\nSearch queries executed:");
        for (const query of metadata.webSearchQueries) {
          console.log(` - ${query}`);
        }
      }
      if (metadata?.groundingChunks) {
        console.log("\nSources:");
        for (const chunk of metadata.groundingChunks) {
          console.log(` - [${chunk.web.title}](${chunk.web.uri})`);
        }
      }
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {"text": "Who won the euro 2024?"}
            ]
          }
        ],
        "tools": [
          {
            "google_search": {}
          }
        ]
      }'

The Gemini API also supports other built-in tools:

- **[Code execution](https://ai.google.dev/gemini-api/docs/code-execution)**: Lets the model write and run Python code to solve complex math problems.
- **[URL context](https://ai.google.dev/gemini-api/docs/url-context)**: Lets you ground responses in specific web page URLs you provide.
- **[File search](https://ai.google.dev/gemini-api/docs/file-search)**: Lets you upload files and ground responses in their content using semantic search.
- **[Google Maps](https://ai.google.dev/gemini-api/docs/maps-grounding)**: Lets you ground responses in location data and search for places, directions, and maps.
- **[Computer use](https://ai.google.dev/gemini-api/docs/computer-use)**: Lets the model interact with a virtual computer screen, keyboard, and mouse to perform tasks.

## Call custom functions

Use **[function calling](https://ai.google.dev/gemini-api/docs/function-calling)** to connect
models to your custom tools and APIs. The model determines when to call your
function and returns a `functionCall` in the response for your application
to execute.

This example declares a mock temperature function and checks if the model
wants to call it.

### Python

    from google import genai
    from google.genai import types

    weather_function = {
        "name": "get_current_temperature",
        "description": "Gets the current temperature for a given location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city name, e.g. San Francisco",
                },
            },
            "required": ["location"],
        },
    }

    tools = types.Tool(function_declarations=[weather_function])
    config = types.GenerateContentConfig(tools=[tools])

    contents = ["What's the temperature in London?"]

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=contents,
        config=config,
    )

    part = response.candidates[0].content.parts[0]
    if part.function_call:
        fc = part.function_call
        print(f"Model requested function: {fc.name} with args {fc.args}")

        mock_result = {"temperature": "15C", "condition": "Cloudy"}

        contents.append(response.candidates[0].content)

        fn_response_part = types.Part.from_function_response(
            name=fc.name,
            response=mock_result,
            id=fc.id
        )
        contents.append(types.Content(role="user", parts=[fn_response_part]))

        final_response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=contents,
            config=config,
        )
        print("Final Response:", final_response.text)

### JavaScript

    import { GoogleGenAI, Type } from '@google/genai';

    async function main() {
      const weatherFunction = {
        name: 'get_current_temperature',
        description: 'Gets the current temperature for a given location.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            location: {
              type: Type.STRING,
              description: 'The city name, e.g. San Francisco',
            },
          },
          required: ['location'],
        },
      };

      const contents = [{
        role: 'user',
        parts: [{ text: "What's the temperature in London?" }]
      }];

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: contents,
        config: {
          tools: [{ functionDeclarations: [weatherFunction] }],
        },
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        const fc = response.functionCalls[0];
        console.log(`Model requested function: ${fc.name}`);

        const mockResult = { temperature: "15C", condition: "Cloudy" };

        contents.push(response.candidates[0].content);

        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: fc.name,
              response: mockResult,
              id: fc.id
            }
          }]
        });

        const finalResponse = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: contents,
          config: {
            tools: [{ functionDeclarations: [weatherFunction] }],
          },
        });
        console.log("Final Response:", finalResponse.text);
      }
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "role": "user",
            "parts": [{"text": "What'\''s the temperature in London?"}]
          }
        ],
        "tools": [
          {
            "functionDeclarations": [
              {
                "name": "get_current_temperature",
                "description": "Gets the current temperature for a given location.",
                "parameters": {
                  "type": "object",
                  "properties": {
                    "location": {
                      "type": "string",
                      "description": "The city name, e.g. San Francisco"
                    }
                  },
                  "required": ["location"]
                }
              }
            ]
          }
        ]
      }'

## What's next

Now that you've got started with the Gemini API, explore the following
guides to build more advanced applications:

- [Text generation](https://ai.google.dev/gemini-api/docs/text-generation)
- [Image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Thinking](https://ai.google.dev/gemini-api/docs/thinking)
- [Function calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- [Long context](https://ai.google.dev/gemini-api/docs/long-context)
- [Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)

<br />

When building with the Gemini API, we recommend using the **Google GenAI SDK** .
These are the official, production-ready libraries that we develop and maintain
for the most popular languages. They are in [General Availability](https://ai.google.dev/gemini-api/docs/libraries#new-libraries) and used in all our official
documentation and examples.

> [!NOTE]
> **Note:** If you're using one of our legacy libraries, we strongly recommend you [migrate](https://ai.google.dev/gemini-api/docs/migrate) to the Google GenAI SDK. Review the [legacy libraries](https://ai.google.dev/gemini-api/docs/libraries#previous-sdks) section for more information. If you're using an AI coding assistant, install the [Gemini API development skill](https://ai.google.dev/gemini-api/docs/coding-agents) to give your agent access to the latest documentation and best practices.

If you're new to the Gemini API, follow our [quickstart guide](https://ai.google.dev/gemini-api/docs/quickstart) to get started.

## Language support and installation

The Google GenAI SDK is available for the Python, JavaScript/TypeScript, Go and
Java languages. You can install each language's library using package managers,
or visit their GitHub repos for further engagement:

### Python

- Library: [`google-genai`](https://pypi.org/project/google-genai)

- GitHub Repository: [googleapis/python-genai](https://github.com/googleapis/python-genai)

- Installation: `pip install google-genai`

### JavaScript

- Library: [`@google/genai`](https://www.npmjs.com/package/@google/genai)

- GitHub Repository: [googleapis/js-genai](https://github.com/googleapis/js-genai)

- Installation: `npm install @google/genai`

### Go

- Library: [`google.golang.org/genai`](https://pkg.go.dev/google.golang.org/genai)

- GitHub Repository: [googleapis/go-genai](https://github.com/googleapis/go-genai)

- Installation: `go get google.golang.org/genai`

### Java

- Library: `google-genai`

- GitHub Repository: [googleapis/java-genai](https://github.com/googleapis/java-genai)

- Installation: If you're using Maven, add the following to your dependencies:

    <dependencies>
      <dependency>
        <groupId>com.google.genai</groupId>
        <artifactId>google-genai</artifactId>
        <version>1.0.0</version>
      </dependency>
    </dependencies>

### C #

- Library: `Google.GenAI`

- GitHub Repository: [googleapis/dotnet-genai](https://googleapis.github.io/dotnet-genai/)

- Installation: `dotnet add package Google.GenAI`

## General availability

As of May 2025, the Google GenAI SDK has reached General Availability (GA) across
all supported platforms and are the recommended libraries to access the Gemini API.
They are stable, fully supported for production use, and are actively maintained.
They provide access to the latest features, and offer the best performance working
with Gemini.

If you're using one of our legacy libraries,
we strongly recommend you migrate so that you can access the latest features and
get the best performance working with Gemini. Review the [legacy libraries](https://ai.google.dev/gemini-api/docs/libraries#previous-sdks) section for more information.

## Legacy libraries and migration

If you are using one of our legacy libraries, we recommend that you
[migrate to the new libraries](https://ai.google.dev/gemini-api/docs/migrate).

The legacy libraries don't provide access to recent features (such as
[Live API](https://ai.google.dev/gemini-api/docs/live) and [Veo](https://ai.google.dev/gemini-api/docs/video)) and are
deprecated as of November 30th, 2025.

Each legacy library's support status varies, detailed in the following table:

| Language | Legacy library | Support status | Recommended library |
|---|---|---|---|
| **Python** | `https://github.com/google-gemini/deprecated-generative-ai-python` | Not actively maintained | `https://github.com/googleapis/python-genai` |
| **JavaScript/TypeScript** | `https://github.com/google-gemini/generative-ai-js` | Not actively maintained | `https://github.com/googleapis/js-genai` |
| **Go** | `https://github.com/google/generative-ai-go` | Not actively maintained | `https://github.com/googleapis/go-genai` |
| **Dart and Flutter** | `https://pub.dev/packages/google_generative_ai/install` | Not actively maintained | Use [Genkit Dart](https://genkit.dev/docs/dart/get-started/) or [Firebase AI Logic](https://pub.dev/packages/firebase_ai) |
| **Swift** | `https://github.com/google/generative-ai-swift` | Not actively maintained | Use [Firebase AI Logic](https://firebase.google.com/products/firebase-ai-logic) |
| **Android** | `https://github.com/google-gemini/generative-ai-android` | Not actively maintained | Use [Firebase AI Logic](https://firebase.google.com/products/firebase-ai-logic) |

**Note for Java developers:** There was no legacy Google-provided Java SDK for
the Gemini API, so no migration from a previous Google library is required. You
can start directly with the new library in the
[Language support and installation](https://ai.google.dev/gemini-api/docs/libraries#install) section.

# Text generation

The Gemini API can generate text output from text, images, video, and audio
inputs.

Here's a basic example:

### Python

    from google import genai

    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="How does AI work?"
    )
    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "How does AI work?",
      });
      console.log(response.text);
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "os"
      "google.golang.org/genai"
    )

    func main() {

      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      result, _ := client.Models.GenerateContent(
          ctx,
          "gemini-3.5-flash",
          genai.Text("Explain how AI works in a few words"),
          nil,
      )

      fmt.Println(result.Text())
    }

### Java

    import com.google.genai.Client;
    import com.google.genai.types.GenerateContentResponse;

    public class GenerateContentWithTextInput {
      public static void main(String[] args) {

        Client client = new Client();

        GenerateContentResponse response =
            client.models.generateContent("gemini-3.5-flash", "How does AI work?", null);

        System.out.println(response.text());
      }
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "How does AI work?"
              }
            ]
          }
        ]
      }'

### Apps Script

    // See https://developers.google.com/apps-script/guides/properties
    // for instructions on how to set the API key.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    function main() {
      const payload = {
        contents: [
          {
            parts: [
              { text: 'How AI does work?' },
            ],
          },
        ],
      };

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
      const options = {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
      };

      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response);
      const content = data['candidates'][0]['content']['parts'][0]['text'];
      console.log(content);
    }

## Thinking with Gemini

Gemini models often have ["thinking"](https://ai.google.dev/gemini-api/docs/thinking) enabled by default
which allows the model to reason before responding to a request.

Each model supports different thinking configurations which gives you control
over cost, latency, and intelligence. For more details, see the
[thinking guide](https://ai.google.dev/gemini-api/docs/thinking#set-budget).

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="How does AI work?",
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="low")
        ),
    )
    print(response.text)

### JavaScript

    import { GoogleGenAI, ThinkingLevel } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "How does AI work?",
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        }
      });
      console.log(response.text);
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "os"
      "google.golang.org/genai"
    )

    func main() {

      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      thinkingLevelVal := "low"

      result, _ := client.Models.GenerateContent(
          ctx,
          "gemini-3.5-flash",
          genai.Text("How does AI work?"),
          &genai.GenerateContentConfig{
            ThinkingConfig: &genai.ThinkingConfig{
                ThinkingLevel: &thinkingLevelVal,
            },
          }
      )

      fmt.Println(result.Text())
    }

### Java

    import com.google.genai.Client;
    import com.google.genai.types.GenerateContentConfig;
    import com.google.genai.types.GenerateContentResponse;
    import com.google.genai.types.ThinkingConfig;
    import com.google.genai.types.ThinkingLevel;

    public class GenerateContentWithThinkingConfig {
      public static void main(String[] args) {

        Client client = new Client();

        GenerateContentConfig config =
            GenerateContentConfig.builder()
                .thinkingConfig(ThinkingConfig.builder().thinkingLevel(new ThinkingLevel("low")))
                .build();

        GenerateContentResponse response =
            client.models.generateContent("gemini-3.5-flash", "How does AI work?", config);

        System.out.println(response.text());
      }
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "How does AI work?"
              }
            ]
          }
        ],
        "generationConfig": {
          "thinkingConfig": {
            "thinkingLevel": "low"
          }
        }
      }'

### Apps Script

    // See https://developers.google.com/apps-script/guides/properties
    // for instructions on how to set the API key.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    function main() {
      const payload = {
        contents: [
          {
            parts: [
              { text: 'How AI does work?' },
            ],
          },
        ],
        generationConfig: {
          thinkingConfig: {
            thinkingLevel: 'low'
          }
        }
      };

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
      const options = {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
      };

      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response);
      const content = data['candidates'][0]['content']['parts'][0]['text'];
      console.log(content);
    }

## System instructions and other configurations

You can guide the behavior of Gemini models with system instructions. To do so,
pass a [`GenerateContentConfig`](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig)
object.

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        config=types.GenerateContentConfig(
            system_instruction="You are a cat. Your name is Neko."),
        contents="Hello there"
    )

    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Hello there",
        config: {
          systemInstruction: "You are a cat. Your name is Neko.",
        },
      });
      console.log(response.text);
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "os"
      "google.golang.org/genai"
    )

    func main() {

      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      config := &genai.GenerateContentConfig{
          SystemInstruction: genai.NewContentFromText("You are a cat. Your name is Neko.", genai.RoleUser),
      }

      result, _ := client.Models.GenerateContent(
          ctx,
          "gemini-3.5-flash",
          genai.Text("Hello there"),
          config,
      )

      fmt.Println(result.Text())
    }

### Java

    import com.google.genai.Client;
    import com.google.genai.types.Content;
    import com.google.genai.types.GenerateContentConfig;
    import com.google.genai.types.GenerateContentResponse;
    import com.google.genai.types.Part;

    public class GenerateContentWithSystemInstruction {
      public static void main(String[] args) {

        Client client = new Client();

        GenerateContentConfig config =
            GenerateContentConfig.builder()
                .systemInstruction(
                    Content.fromParts(Part.fromText("You are a cat. Your name is Neko.")))
                .build();

        GenerateContentResponse response =
            client.models.generateContent("gemini-3.5-flash", "Hello there", config);

        System.out.println(response.text());
      }
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -d '{
        "system_instruction": {
          "parts": [
            {
              "text": "You are a cat. Your name is Neko."
            }
          ]
        },
        "contents": [
          {
            "parts": [
              {
                "text": "Hello there"
              }
            ]
          }
        ]
      }'

### Apps Script

    // See https://developers.google.com/apps-script/guides/properties
    // for instructions on how to set the API key.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    function main() {
      const systemInstruction = {
        parts: [{
          text: 'You are a cat. Your name is Neko.'
        }]
      };

      const payload = {
        systemInstruction,
        contents: [
          {
            parts: [
              { text: 'Hello there' },
            ],
          },
        ],
      };

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
      const options = {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
      };

      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response);
      const content = data['candidates'][0]['content']['parts'][0]['text'];
      console.log(content);
    }

The [`GenerateContentConfig`](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig)
object also lets you override default generation parameters, such as
[temperature](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig).

> [!NOTE]
> When using Gemini 3 models, we strongly recommend keeping the `temperature` at its default value of 1.0. Changing the temperature (setting it below 1.0) may lead to unexpected behavior, such as looping or degraded performance, particularly in complex mathematical or reasoning tasks.

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=["Explain how AI works"],
        config=types.GenerateContentConfig(
            temperature=0.1
        )
    )
    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Explain how AI works",
        config: {
          temperature: 0.1,
        },
      });
      console.log(response.text);
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "os"
      "google.golang.org/genai"
    )

    func main() {

      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      temp := float32(0.9)
      topP := float32(0.5)
      topK := float32(20.0)

      config := &genai.GenerateContentConfig{
        Temperature:       &temp,
        TopP:              &topP,
        TopK:              &topK,
        ResponseMIMEType:  "application/json",
      }

      result, _ := client.Models.GenerateContent(
        ctx,
        "gemini-3.5-flash",
        genai.Text("What is the average size of a swallow?"),
        config,
      )

      fmt.Println(result.Text())
    }

### Java

    import com.google.genai.Client;
    import com.google.genai.types.GenerateContentConfig;
    import com.google.genai.types.GenerateContentResponse;

    public class GenerateContentWithConfig {
      public static void main(String[] args) {

        Client client = new Client();

        GenerateContentConfig config = GenerateContentConfig.builder().temperature(0.1f).build();

        GenerateContentResponse response =
            client.models.generateContent("gemini-3.5-flash", "Explain how AI works", config);

        System.out.println(response.text());
      }
    }

### REST

    curl https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "Explain how AI works"
              }
            ]
          }
        ],
        "generationConfig": {
          "stopSequences": [
            "Title"
          ],
          "temperature": 1.0,
          "topP": 0.8,
          "topK": 10
        }
      }'

### Apps Script

    // See https://developers.google.com/apps-script/guides/properties
    // for instructions on how to set the API key.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    function main() {
      const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        responseFormat: { text: { mimeType: "text/plain" } },
      };

      const payload = {
        generationConfig,
        contents: [
          {
            parts: [
              { text: 'Explain how AI works in a few words' },
            ],
          },
        ],
      };

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
      const options = {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
      };

      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response);
      const content = data['candidates'][0]['content']['parts'][0]['text'];
      console.log(content);
    }

Refer to the [`GenerateContentConfig`](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig)
in our API reference for a complete list of configurable parameters and their
descriptions.

## Multimodal inputs

The Gemini API supports multimodal inputs, allowing you to combine text with
media files. The following example demonstrates providing an image:

### Python

    from PIL import Image
    from google import genai

    client = genai.Client()

    image = Image.open("/path/to/organ.png")
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=[image, "Tell me about this instrument"]
    )
    print(response.text)

### JavaScript

    import {
      GoogleGenAI,
      createUserContent,
      createPartFromUri,
    } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const image = await ai.files.upload({
        file: "/path/to/organ.png",
      });
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          createUserContent([
            "Tell me about this instrument",
            createPartFromUri(image.uri, image.mimeType),
          ]),
        ],
      });
      console.log(response.text);
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "os"
      "google.golang.org/genai"
    )

    func main() {

      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      imagePath := "/path/to/organ.jpg"
      imgData, _ := os.ReadFile(imagePath)

      parts := []*genai.Part{
          genai.NewPartFromText("Tell me about this instrument"),
          &genai.Part{
              InlineData: &genai.Blob{
                  MIMEType: "image/jpeg",
                  Data:     imgData,
              },
          },
      }

      contents := []*genai.Content{
          genai.NewContentFromParts(parts, genai.RoleUser),
      }

      result, _ := client.Models.GenerateContent(
          ctx,
          "gemini-3.5-flash",
          contents,
          nil,
      )

      fmt.Println(result.Text())
    }

### Java

    import com.google.genai.Client;
    import com.google.genai.Content;
    import com.google.genai.types.GenerateContentResponse;
    import com.google.genai.types.Part;

    public class GenerateContentWithMultiModalInputs {
      public static void main(String[] args) {

        Client client = new Client();

        Content content =
          Content.fromParts(
              Part.fromText("Tell me about this instrument"),
              Part.fromUri("/path/to/organ.jpg", "image/jpeg"));

        GenerateContentResponse response =
            client.models.generateContent("gemini-3.5-flash", content, null);

        System.out.println(response.text());
      }
    }

### REST

    # Use a temporary file to hold the base64 encoded image data
    TEMP_B64=$(mktemp)
    trap 'rm -f "$TEMP_B64"' EXIT
    base64 $B64FLAGS $IMG_PATH > "$TEMP_B64"

    # Use a temporary file to hold the JSON payload
    TEMP_JSON=$(mktemp)
    trap 'rm -f "$TEMP_JSON"' EXIT

    cat > "$TEMP_JSON" << EOF
    {
      "contents": [
        {
          "parts": [
            {
              "text": "Tell me about this instrument"
            },
            {
              "inline_data": {
                "mime_type": "image/jpeg",
                "data": "$(cat "$TEMP_B64")"
              }
            }
          ]
        }
      ]
    }
    EOF

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d "@$TEMP_JSON"

### Apps Script

    // See https://developers.google.com/apps-script/guides/properties
    // for instructions on how to set the API key.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    function main() {
      const imageUrl = 'http://image/url';
      const image = getImageData(imageUrl);
      const payload = {
        contents: [
          {
            parts: [
              { image },
              { text: 'Tell me about this instrument' },
            ],
          },
        ],
      };

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
      const options = {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
      };

      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response);
      const content = data['candidates'][0]['content']['parts'][0]['text'];
      console.log(content);
    }

    function getImageData(url) {
      const blob = UrlFetchApp.fetch(url).getBlob();

      return {
        mimeType: blob.getContentType(),
        data: Utilities.base64Encode(blob.getBytes())
      };
    }

For alternative methods of providing images and more advanced image processing,
see our [image understanding guide](https://ai.google.dev/gemini-api/docs/image-understanding).
The API also supports [document](https://ai.google.dev/gemini-api/docs/document-processing), [video](https://ai.google.dev/gemini-api/docs/video-understanding), and [audio](https://ai.google.dev/gemini-api/docs/audio)
inputs and understanding.

## Streaming responses

By default, the model returns a response only after the entire generation
process is complete.

For more fluid interactions, use streaming to receive [`GenerateContentResponse`](https://ai.google.dev/api/generate-content#v1beta.GenerateContentResponse) instances incrementally
as they're generated.

### Python

    from google import genai

    client = genai.Client()

    response = client.models.generate_content_stream(
        model="gemini-3.5-flash",
        contents=["Explain how AI works"]
    )
    for chunk in response:
        print(chunk.text, end="")

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: "Explain how AI works",
      });

      for await (const chunk of response) {
        console.log(chunk.text);
      }
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "os"
      "google.golang.org/genai"
    )

    func main() {

      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      stream := client.Models.GenerateContentStream(
          ctx,
          "gemini-3.5-flash",
          genai.Text("Write a story about a magic backpack."),
          nil,
      )

      for chunk, _ := range stream {
          part := chunk.Candidates[0].Content.Parts[0]
          fmt.Print(part.Text)
      }
    }

### Java

    import com.google.genai.Client;
    import com.google.genai.ResponseStream;
    import com.google.genai.types.GenerateContentResponse;

    public class GenerateContentStream {
      public static void main(String[] args) {

        Client client = new Client();

        ResponseStream<GenerateContentResponse> responseStream =
          client.models.generateContentStream(
              "gemini-3.5-flash", "Write a story about a magic backpack.", null);

        for (GenerateContentResponse res : responseStream) {
          System.out.print(res.text());
        }

        // To save resources and avoid connection leaks, it is recommended to close the response
        // stream after consumption (or using try block to get the response stream).
        responseStream.close();
      }
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      --no-buffer \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "Explain how AI works"
              }
            ]
          }
        ]
      }'

### Apps Script

    // See https://developers.google.com/apps-script/guides/properties
    // for instructions on how to set the API key.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    function main() {
      const payload = {
        contents: [
          {
            parts: [
              { text: 'Explain how AI works' },
            ],
          },
        ],
      };

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent';
      const options = {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
      };

      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response);
      const content = data['candidates'][0]['content']['parts'][0]['text'];
      console.log(content);
    }

## Multi-turn conversations (chat)

Our SDKs provide functionality to collect multiple rounds of prompts and
responses into a chat, giving you an easy way to keep track of the conversation
history.

> [!NOTE]
> **Note:** Chat functionality is only implemented as part of the SDKs. Behind the scenes, it still uses the [`generateContent`](https://ai.google.dev/api/generate-content#method:-models.generatecontent) API. For multi-turn conversations, the full conversation history is sent to the model with each follow-up turn.

### Python

    from google import genai

    client = genai.Client()
    chat = client.chats.create(model="gemini-3.5-flash")

    response = chat.send_message("I have 2 dogs in my house.")
    print(response.text)

    response = chat.send_message("How many paws are in my house?")
    print(response.text)

    for message in chat.get_history():
        print(f'role - {message.role}',end=": ")
        print(message.parts[0].text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        history: [
          {
            role: "user",
            parts: [{ text: "Hello" }],
          },
          {
            role: "model",
            parts: [{ text: "Great to meet you. What would you like to know?" }],
          },
        ],
      });

      const response1 = await chat.sendMessage({
        message: "I have 2 dogs in my house.",
      });
      console.log("Chat response 1:", response1.text);

      const response2 = await chat.sendMessage({
        message: "How many paws are in my house?",
      });
      console.log("Chat response 2:", response2.text);
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "os"
      "google.golang.org/genai"
    )

    func main() {

      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      history := []*genai.Content{
          genai.NewContentFromText("Hi nice to meet you! I have 2 dogs in my house.", genai.RoleUser),
          genai.NewContentFromText("Great to meet you. What would you like to know?", genai.RoleModel),
      }

      chat, _ := client.Chats.Create(ctx, "gemini-3.5-flash", nil, history)
      res, _ := chat.SendMessage(ctx, genai.Part{Text: "How many paws are in my house?"})

      if len(res.Candidates) > 0 {
          fmt.Println(res.Candidates[0].Content.Parts[0].Text)
      }
    }

### Java

    import com.google.genai.Chat;
    import com.google.genai.Client;
    import com.google.genai.types.Content;
    import com.google.genai.types.GenerateContentResponse;

    public class MultiTurnConversation {
      public static void main(String[] args) {

        Client client = new Client();
        Chat chatSession = client.chats.create("gemini-3.5-flash");

        GenerateContentResponse response =
            chatSession.sendMessage("I have 2 dogs in my house.");
        System.out.println("First response: " + response.text());

        response = chatSession.sendMessage("How many paws are in my house?");
        System.out.println("Second response: " + response.text());

        // Get the history of the chat session.
        // Passing 'true' to getHistory() returns the curated history, which excludes
        // empty or invalid parts.
        // Passing 'false' here would return the comprehensive history, including
        // empty or invalid parts.
        ImmutableList<Content> history = chatSession.getHistory(true);
        System.out.println("History: " + history);
      }
    }

### REST

    curl https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "role": "user",
            "parts": [
              {
                "text": "Hello"
              }
            ]
          },
          {
            "role": "model",
            "parts": [
              {
                "text": "Great to meet you. What would you like to know?"
              }
            ]
          },
          {
            "role": "user",
            "parts": [
              {
                "text": "I have two dogs in my house. How many paws are in my house?"
              }
            ]
          }
        ]
      }'

### Apps Script

    // See https://developers.google.com/apps-script/guides/properties
    // for instructions on how to set the API key.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    function main() {
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Hello' },
            ],
          },
          {
            role: 'model',
            parts: [
              { text: 'Great to meet you. What would you like to know?' },
            ],
          },
          {
            role: 'user',
            parts: [
              { text: 'I have two dogs in my house. How many paws are in my house?' },
            ],
          },
        ],
      };

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
      const options = {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
      };

      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response);
      const content = data['candidates'][0]['content']['parts'][0]['text'];
      console.log(content);
    }

Streaming can also be used for multi-turn conversations.

### Python

    from google import genai

    client = genai.Client()
    chat = client.chats.create(model="gemini-3.5-flash")

    response = chat.send_message_stream("I have 2 dogs in my house.")
    for chunk in response:
        print(chunk.text, end="")

    response = chat.send_message_stream("How many paws are in my house?")
    for chunk in response:
        print(chunk.text, end="")

    for message in chat.get_history():
        print(f'role - {message.role}', end=": ")
        print(message.parts[0].text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        history: [
          {
            role: "user",
            parts: [{ text: "Hello" }],
          },
          {
            role: "model",
            parts: [{ text: "Great to meet you. What would you like to know?" }],
          },
        ],
      });

      const stream1 = await chat.sendMessageStream({
        message: "I have 2 dogs in my house.",
      });
      for await (const chunk of stream1) {
        console.log(chunk.text);
        console.log("_".repeat(80));
      }

      const stream2 = await chat.sendMessageStream({
        message: "How many paws are in my house?",
      });
      for await (const chunk of stream2) {
        console.log(chunk.text);
        console.log("_".repeat(80));
      }
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "os"
      "google.golang.org/genai"
    )

    func main() {

      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      history := []*genai.Content{
          genai.NewContentFromText("Hi nice to meet you! I have 2 dogs in my house.", genai.RoleUser),
          genai.NewContentFromText("Great to meet you. What would you like to know?", genai.RoleModel),
      }

      chat, _ := client.Chats.Create(ctx, "gemini-3.5-flash", nil, history)
      stream := chat.SendMessageStream(ctx, genai.Part{Text: "How many paws are in my house?"})

      for chunk, _ := range stream {
          part := chunk.Candidates[0].Content.Parts[0]
          fmt.Print(part.Text)
      }
    }

### Java

    import com.google.genai.Chat;
    import com.google.genai.Client;
    import com.google.genai.ResponseStream;
    import com.google.genai.types.GenerateContentResponse;

    public class MultiTurnConversationWithStreaming {
      public static void main(String[] args) {

        Client client = new Client();
        Chat chatSession = client.chats.create("gemini-3.5-flash");

        ResponseStream<GenerateContentResponse> responseStream =
            chatSession.sendMessageStream("I have 2 dogs in my house.", null);

        for (GenerateContentResponse response : responseStream) {
          System.out.print(response.text());
        }

        responseStream = chatSession.sendMessageStream("How many paws are in my house?", null);

        for (GenerateContentResponse response : responseStream) {
          System.out.print(response.text());
        }

        // Get the history of the chat session. History is added after the stream
        // is consumed and includes the aggregated response from the stream.
        System.out.println("History: " + chatSession.getHistory(false));
      }
    }

### REST

    curl https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "role": "user",
            "parts": [
              {
                "text": "Hello"
              }
            ]
          },
          {
            "role": "model",
            "parts": [
              {
                "text": "Great to meet you. What would you like to know?"
              }
            ]
          },
          {
            "role": "user",
            "parts": [
              {
                "text": "I have two dogs in my house. How many paws are in my house?"
              }
            ]
          }
        ]
      }'

### Apps Script

    // See https://developers.google.com/apps-script/guides/properties
    // for instructions on how to set the API key.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    function main() {
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Hello' },
            ],
          },
          {
            role: 'model',
            parts: [
              { text: 'Great to meet you. What would you like to know?' },
            ],
          },
          {
            role: 'user',
            parts: [
              { text: 'I have two dogs in my house. How many paws are in my house?' },
            ],
          },
        ],
      };

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent';
      const options = {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
      };

      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response);
      const content = data['candidates'][0]['content']['parts'][0]['text'];
      console.log(content);
    }

## Prompting tips

Consult our [prompt engineering guide](https://ai.google.dev/gemini/docs/prompting-strategies) for
suggestions on getting the most out of Gemini.

## What's next

- Try [Gemini in Google AI Studio](https://aistudio.google.com).
- Experiment with [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) for JSON-like responses.
- Explore Gemini's [image](https://ai.google.dev/gemini-api/docs/image-understanding), [video](https://ai.google.dev/gemini-api/docs/video-understanding), [audio](https://ai.google.dev/gemini-api/docs/audio) and [document](https://ai.google.dev/gemini-api/docs/document-processing) understanding capabilities.
- Learn about multimodal [file prompting strategies](https://ai.google.dev/gemini-api/docs/files#prompt-guide).

# Gemini thinking

The [Gemini 3 and 2.5 series models](https://ai.google.dev/gemini-api/docs/models) use an internal
"thinking process" that significantly improves their reasoning and multi-step
planning abilities, making them highly effective for complex tasks such as
coding, advanced mathematics, and data analysis.

This guide shows you how to work with Gemini's thinking capabilities using the
Gemini API.

## Generating content with thinking

Initiating a request with a thinking model is similar to any other content
generation request. The key difference lies in specifying one of the
[models with thinking support](https://ai.google.dev/gemini-api/docs/thinking#supported-models) in the `model` field, as
demonstrated in the following [text generation](https://ai.google.dev/gemini-api/docs/text-generation#text-input) example:

### Python

    from google import genai

    client = genai.Client()
    prompt = "Explain the concept of Occam's Razor and provide a simple, everyday example."
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
    )

    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const prompt = "Explain the concept of Occam's Razor and provide a simple, everyday example.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      console.log(response.text);
    }

    main();

### Go

    package main

    import (
      "context"
      "fmt"
      "log"
      "os"
      "google.golang.org/genai"
    )

    func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      prompt := "Explain the concept of Occam's Razor and provide a simple, everyday example."
      model := "gemini-3.5-flash"

      resp, _ := client.Models.GenerateContent(ctx, model, genai.Text(prompt), nil)

      fmt.Println(resp.Text())
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
     -H "x-goog-api-key: $GEMINI_API_KEY" \
     -H 'Content-Type: application/json' \
     -X POST \
     -d '{
       "contents": [
         {
           "parts": [
             {
               "text": "Explain the concept of Occam'\''s Razor and provide a simple, everyday example."
             }
           ]
         }
       ]
     }'
     ```

## Thought summaries

Thought summaries are summarized versions of the model's raw thoughts and offer
insights into the model's internal reasoning process. Note that
thinking levels and budgets apply to the model's raw thoughts and not to thought
summaries.

You can enable thought summaries by setting `includeThoughts` to `true` in your
request configuration. You can then access the summary by iterating through the
`response` parameter's `parts`, and checking the `thought` boolean.

Here's an example demonstrating how to enable and retrieve thought summaries
without streaming, which returns a single, final thought summary with the
response:

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()
    prompt = "What is the sum of the first 50 prime numbers?"
    response = client.models.generate_content(
      model="gemini-3.5-flash",
      contents=prompt,
      config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
          include_thoughts=True
        )
      )
    )

    for part in response.candidates[0].content.parts:
      if not part.text:
        continue
      if part.thought:
        print("Thought summary:")
        print(part.text)
        print()
      else:
        print("Answer:")
        print(part.text)
        print()

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "What is the sum of the first 50 prime numbers?",
        config: {
          thinkingConfig: {
            includeThoughts: true,
          },
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (!part.text) {
          continue;
        }
        else if (part.thought) {
          console.log("Thoughts summary:");
          console.log(part.text);
        }
        else {
          console.log("Answer:");
          console.log(part.text);
        }
      }
    }

    main();

### Go

    package main

    import (
      "context"
      "fmt"
      "google.golang.org/genai"
      "os"
    )

    func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      contents := genai.Text("What is the sum of the first 50 prime numbers?")
      model := "gemini-3.5-flash"
      resp, _ := client.Models.GenerateContent(ctx, model, contents, &genai.GenerateContentConfig{
        ThinkingConfig: &genai.ThinkingConfig{
          IncludeThoughts: true,
        },
      })

      for _, part := range resp.Candidates[0].Content.Parts {
        if part.Text != "" {
          if part.Thought {
            fmt.Println("Thoughts Summary:")
            fmt.Println(part.Text)
          } else {
            fmt.Println("Answer:")
            fmt.Println(part.Text)
          }
        }
      }
    }

And here is an example using thinking with streaming, which returns rolling,
incremental summaries during generation:

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    prompt = """
    Alice, Bob, and Carol each live in a different house on the same street: red, green, and blue.
    The person who lives in the red house owns a cat.
    Bob does not live in the green house.
    Carol owns a dog.
    The green house is to the left of the red house.
    Alice does not own a cat.
    Who lives in each house, and what pet do they own?
    """

    thoughts = ""
    answer = ""

    for chunk in client.models.generate_content_stream(
        model="gemini-3.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
          thinking_config=types.ThinkingConfig(
            include_thoughts=True
          )
        )
    ):
      for part in chunk.candidates[0].content.parts:
        if not part.text:
          continue
        elif part.thought:
          if not thoughts:
            print("Thoughts summary:")
          print(part.text)
          thoughts += part.text
        else:
          if not answer:
            print("Answer:")
          print(part.text)
          answer += part.text

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    const prompt = `Alice, Bob, and Carol each live in a different house on the same
    street: red, green, and blue. The person who lives in the red house owns a cat.
    Bob does not live in the green house. Carol owns a dog. The green house is to
    the left of the red house. Alice does not own a cat. Who lives in each house,
    and what pet do they own?`;

    let thoughts = "";
    let answer = "";

    async function main() {
      const response = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          thinkingConfig: {
            includeThoughts: true,
          },
        },
      });

      for await (const chunk of response) {
        for (const part of chunk.candidates[0].content.parts) {
          if (!part.text) {
            continue;
          } else if (part.thought) {
            if (!thoughts) {
              console.log("Thoughts summary:");
            }
            console.log(part.text);
            thoughts = thoughts + part.text;
          } else {
            if (!answer) {
              console.log("Answer:");
            }
            console.log(part.text);
            answer = answer + part.text;
          }
        }
      }
    }

    await main();

### Go

    package main

    import (
      "context"
      "fmt"
      "log"
      "os"
      "google.golang.org/genai"
    )

    const prompt = `
    Alice, Bob, and Carol each live in a different house on the same street: red, green, and blue.
    The person who lives in the red house owns a cat.
    Bob does not live in the green house.
    Carol owns a dog.
    The green house is to the left of the red house.
    Alice does not own a cat.
    Who lives in each house, and what pet do they own?
    `

    func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      contents := genai.Text(prompt)
      model := "gemini-3.5-flash"

      resp := client.Models.GenerateContentStream(ctx, model, contents, &genai.GenerateContentConfig{
        ThinkingConfig: &genai.ThinkingConfig{
          IncludeThoughts: true,
        },
      })

      for chunk := range resp {
        for _, part := range chunk.Candidates[0].Content.Parts {
          if len(part.Text) == 0 {
            continue
          }

          if part.Thought {
            fmt.Printf("Thought: %s\n", part.Text)
          } else {
            fmt.Printf("Answer: %s\n", part.Text)
          }
        }
      }
    }

## Controlling thinking

Gemini models engage in dynamic thinking by default, automatically adjusting the
amount of reasoning effort based on the complexity of the user's request.
However, if you have specific latency constraints or require the model to engage
in deeper reasoning than usual, you can optionally use parameters to control
thinking behavior.

### Thinking levels (Gemini 3)

The `thinkingLevel` parameter, recommended for Gemini 3 models and onwards,
lets you control reasoning behavior.

The following table details the `thinkingLevel` settings for each model type:

| Thinking Level | Gemini 3.1 Pro | Gemini 3.1 Flash-Lite | Gemini 3 Flash | Gemini 3.5 Flash | Description |
|---|---|---|---|---|---|
| **`minimal`** | Not supported | Supported (Default) | Supported | Supported | Matches the "no thinking" setting for most queries. The model may think very minimally for complex coding tasks. Minimizes latency for chat or high throughput applications. Note, `minimal` does not guarantee that thinking is off. |
| **`low`** | Supported | Supported | Supported | Supported | Minimizes latency and cost. Best for simple instruction following, chat, or high-throughput applications. |
| **`medium`** | Supported | Supported | Supported | Supported (Default) | Balanced thinking for most tasks. |
| **`high`** | Supported (Default, Dynamic) | Supported (Dynamic) | Supported (Default, Dynamic) | Supported (Dynamic) | Maximizes reasoning depth. The model may take significantly longer to reach a first (non thinking) output token, but the output will be more carefully reasoned. |

The following example shows how to set the thinking level.

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Provide a list of 3 famous physicists and their key contributions",
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="low")
        ),
    )

    print(response.text)

### JavaScript

    import { GoogleGenAI, ThinkingLevel } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Provide a list of 3 famous physicists and their key contributions",
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      console.log(response.text);
    }

    main();

### Go

    package main

    import (
      "context"
      "fmt"
      "google.golang.org/genai"
      "os"
    )

    func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      thinkingLevelVal := "low"

      contents := genai.Text("Provide a list of 3 famous physicists and their key contributions")
      model := "gemini-3.5-flash"
      resp, _ := client.Models.GenerateContent(ctx, model, contents, &genai.GenerateContentConfig{
        ThinkingConfig: &genai.ThinkingConfig{
          ThinkingLevel: &thinkingLevelVal,
        },
      })

    fmt.Println(resp.Text())
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [
        {
          "parts": [
            {
              "text": "Provide a list of 3 famous physicists and their key contributions"
            }
          ]
        }
      ],
      "generationConfig": {
        "thinkingConfig": {
              "thinkingLevel": "low"
        }
      }
    }'

You cannot disable thinking for Gemini 3.1 Pro. Gemini 3 Flash and Flash-Lite
also do not support full thinking-off, but the `minimal`
setting means the model likely will not think (though it still potentially can).
If you don't specify a thinking level, Gemini will use the Gemini 3 models'
default thinking level (e.g., `"high"` for Gemini 3.1 Pro, and `"medium"` for Gemini 3.5 Flash).

Gemini 2.5 series models don't support `thinkingLevel`; use `thinkingBudget`
instead.

### Thinking budgets

The `thinkingBudget` parameter, introduced with the Gemini 2.5 series, guides
the model on the specific number of thinking tokens to use for reasoning.

> [!NOTE]
> **Note:** Use the `thinkingLevel` parameter with Gemini 3 models. While `thinkingBudget` is accepted for backwards compatibility, using it with Gemini 3 Pro may result in unexpected performance.

The following are `thinkingBudget` configuration details for each model type.
You can disable thinking by setting `thinkingBudget` to 0.
Setting the `thinkingBudget` to -1 turns
on **dynamic thinking**, meaning the model will adjust the budget based on the
complexity of the request.

| Model | Default setting (Thinking budget is not set) | Range | Disable thinking | Turn on dynamic thinking |
|---|---|---|---|---|
| **2.5 Pro** | Dynamic thinking | `128` to `32768` | N/A: Cannot disable thinking | `thinkingBudget = -1` (Default) |
| **2.5 Flash** | Dynamic thinking | `0` to `24576` | `thinkingBudget = 0` | `thinkingBudget = -1` (Default) |
| **2.5 Flash Preview** | Dynamic thinking | `0` to `24576` | `thinkingBudget = 0` | `thinkingBudget = -1` (Default) |
| **2.5 Flash Lite** | Model does not think | `512` to `24576` | `thinkingBudget = 0` | `thinkingBudget = -1` |
| **2.5 Flash Lite Preview** | Model does not think | `512` to `24576` | `thinkingBudget = 0` | `thinkingBudget = -1` |
| **Robotics-ER 1.6 Preview** | Dynamic thinking | `0` to `24576` | `thinkingBudget = 0` | `thinkingBudget = -1` (Default) |
| **2.5 Flash Live Native Audio Preview (09-2025)** | Dynamic thinking | `0` to `24576` | `thinkingBudget = 0` | `thinkingBudget = -1` (Default) |

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Provide a list of 3 famous physicists and their key contributions",
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=1024)
            # Turn off thinking:
            # thinking_config=types.ThinkingConfig(thinking_budget=0)
            # Turn on dynamic thinking:
            # thinking_config=types.ThinkingConfig(thinking_budget=-1)
        ),
    )

    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Provide a list of 3 famous physicists and their key contributions",
        config: {
          thinkingConfig: {
            thinkingBudget: 1024,
            // Turn off thinking:
            // thinkingBudget: 0
            // Turn on dynamic thinking:
            // thinkingBudget: -1
          },
        },
      });

      console.log(response.text);
    }

    main();

### Go

    package main

    import (
      "context"
      "fmt"
      "google.golang.org/genai"
      "os"
    )

    func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }

      thinkingBudgetVal := int32(1024)

      contents := genai.Text("Provide a list of 3 famous physicists and their key contributions")
      model := "gemini-2.5-flash"
      resp, _ := client.Models.GenerateContent(ctx, model, contents, &genai.GenerateContentConfig{
        ThinkingConfig: &genai.ThinkingConfig{
          ThinkingBudget: &thinkingBudgetVal,
          // Turn off thinking:
          // ThinkingBudget: int32(0),
          // Turn on dynamic thinking:
          // ThinkingBudget: int32(-1),
        },
      })

    fmt.Println(resp.Text())
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [
        {
          "parts": [
            {
              "text": "Provide a list of 3 famous physicists and their key contributions"
            }
          ]
        }
      ],
      "generationConfig": {
        "thinkingConfig": {
              "thinkingBudget": 1024
        }
      }
    }'

Depending on the prompt, the model might overflow or underflow the token budget.

## Thought signatures

> [!IMPORTANT]
> **Important:** The [Google GenAI SDK](https://ai.google.dev/gemini-api/docs/libraries) automatically handles the return of thought signatures for you. You only need to [manage thought signatures manually](https://ai.google.dev/gemini-api/docs/function-calling#thought-signatures) if you're modifying conversation history or using the REST API.

The Gemini API is stateless, so the model treats every API request independently
and doesn't have access to thought context from previous turns in multi-turn
interactions.

In order to enable maintaining thought context across multi-turn interactions,
Gemini returns thought signatures, which are encrypted representations of the
model's internal thought process.

- **Gemini 2.5 models** return thought signatures when thinking is enabled and the request includes [function calling](https://ai.google.dev/gemini-api/docs/function-calling#thinking), specifically [function declarations](https://ai.google.dev/gemini-api/docs/function-calling#step-2).
- **Gemini 3 models** may return thought signatures for all types of [parts](https://ai.google.dev/api/caching#Part). We recommend you always pass all signatures back as received, but it's *required* for function calling signatures. Read the [Thought Signatures](https://ai.google.dev/gemini-api/docs/thought-signatures) page to learn more.

Other usage limitations to consider with function calling include:

- Signatures are returned from the model within other parts in the response, for example function calling or text parts. [Return the entire response](https://ai.google.dev/gemini-api/docs/function-calling#step-4) with all parts back to the model in subsequent turns.
- Don't concatenate parts with signatures together.
- Don't merge one part with a signature with another part without a signature.

## Pricing

> [!NOTE]
> **Note:** **Summaries** are available in the [free and paid tiers](https://ai.google.dev/gemini-api/docs/pricing) of the API. **Thought signatures** will increase the input tokens you are charged when sent back as part of the request.

When thinking is turned on, response pricing is the sum of output
tokens and thinking tokens. You can get the total number of generated thinking
tokens from the `thoughtsTokenCount` field.

### Python

    # ...
    print("Thoughts tokens:", response.usage_metadata.thoughts_token_count)
    print("Output tokens:", response.usage_metadata.candidates_token_count)

### JavaScript

    // ...
    console.log(`Thoughts tokens: ${response.usageMetadata.thoughtsTokenCount}`);
    console.log(`Output tokens: ${response.usageMetadata.candidatesTokenCount}`);

### Go

    // ...
    fmt.Println("Thoughts tokens:", response.UsageMetadata.ThoughtsTokenCount)
    fmt.Println("Output tokens:", response.UsageMetadata.CandidatesTokenCount)

Thinking models generate full thoughts to improve the quality of the final
response, and then output [summaries](https://ai.google.dev/gemini-api/docs/thinking#summaries) to provide insight into the
thought process. So, pricing is based on the full thought tokens the
model needs to generate to create a summary, despite only the summary being
output from the API.

You can learn more about tokens in the [Token counting](https://ai.google.dev/gemini-api/docs/tokens)
guide.

## Best practices

This section includes some guidance for using thinking models efficiently.
As always, following our [prompting guidance and best practices](https://ai.google.dev/gemini-api/docs/prompting-strategies) will get you the best results.

### Debugging and steering

- **Review reasoning**: When you're not getting your expected response from the
  thinking models, it can help to carefully analyze Gemini's thought summaries.
  You can see how it broke down the task and arrived at its conclusion, and use
  that information to correct towards the right results.

- **Provide Guidance in Reasoning** : If you're hoping for a particularly lengthy
  output, you may want to provide guidance in your prompt to constrain the
  [amount of thinking](https://ai.google.dev/gemini-api/docs/thinking#set-budget) the model uses. This lets you reserve more
  of the token output for your response.

### Task complexity

- **Easy Tasks (Thinking could be OFF):** For straightforward requests where complex reasoning isn't required, such as fact retrieval or classification, thinking is not required. Examples include:
  - "Where was DeepMind founded?"
  - "Is this email asking for a meeting or just providing information?"
- **Medium Tasks (Default/Some Thinking):** Many common requests benefit from a degree of step-by-step processing or deeper understanding. Gemini can flexibly use thinking capability for tasks like:
  - Analogize photosynthesis and growing up.
  - Compare and contrast electric cars and hybrid cars.
- **Hard Tasks (Maximum Thinking Capability):** For truly complex challenges, such as solving complex math problems or coding tasks, we recommend setting a high thinking budget. These types of tasks require the model to engage its full reasoning and planning capabilities, often involving many internal steps before providing an answer. Examples include:
  - Solve problem 1 in AIME 2025: Find the sum of all integer bases b \> 9 for which 17~b~ is a divisor of 97~b~.
  - Write Python code for a web application that visualizes real-time stock market data, including user authentication. Make it as efficient as possible.

## Supported models, tools, and capabilities

Thinking features are supported on all 3 and 2.5 series models.
You can find all model capabilities on the
[model overview](https://ai.google.dev/gemini-api/docs/models) page.

Thinking models work with all of Gemini's tools and capabilities. This allows
the models to interact with external systems, execute code, or access real-time
information, incorporating the results into their reasoning and final response.

You can try examples of using tools with thinking models in the
\[Thinking cookbook\]\[Colab\].

## What's next?

- Thinking coverage is available in our [OpenAI Compatibility](https://ai.google.dev/gemini-api/docs/openai#thinking) guide.

\[Colab\]: <https://colab.sandbox.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_thinking.ipynb>

> [!IMPORTANT]
> **Important:** **Thought signatures are handled automatically** when you use the official [Google Gen AI SDKs](https://ai.google.dev/gemini-api/docs/libraries) and append the full model response object directly to history. **You
> only need to work with thought signatures directly when using the REST API** , or if you are *manually extracting and returning parts history in multi-turn
> conversations*.

Thought signatures are encrypted representations of the model's internal thought
process and are used to preserve reasoning context across multi-step
interactions.
When using thinking models (such as the Gemini 3 and 2.5 series), the API may
return a `thoughtSignature` field within the [content parts](https://ai.google.dev/api/caching#Part)
of the response (e.g., `text` or `functionCall` parts).

As a general rule, if you receive a thought signature in a model response,
you should pass it back exactly as received when sending the conversation
history in the next turn.
**When using Gemini 3 models, you must pass back thought signatures during
function calling, otherwise you will get a validation error** (4xx status code).
This includes when using the `minimal`
[thinking level](https://ai.google.dev/gemini-api/docs/thinking#thinking-levels) setting for Gemini 3
Flash.

## How it works

The graphic below visualizes the meaning of "turn" and "step" as they pertain to
[function calling](https://ai.google.dev/gemini-api/docs/function-calling) in the Gemini API. A "turn"
is a single, complete exchange in a conversation between a user and a model. A
"step" is a finer-grained action or operation performed by the model, often as
part of a larger process to complete a turn.

![Function calling turns and steps diagram](https://ai.google.dev/static/gemini-api/docs/images/fc-turns.png)

*This document focuses on handling function calling for Gemini 3 models. Refer
to the [model behavior](https://ai.google.dev/gemini-api/docs/thought-signatures#model-behavior) section for discrepancies with 2.5.*

Gemini 3 returns thought signatures for all model responses (responses from
the API) with a function call. Thought signatures show up in the following
cases:

- When there are [parallel function](https://ai.google.dev/gemini-api/docs/function-calling#parallel_function_calling) calls, the first function call part returned by the model response will have a thought signature.
- When there are sequential function calls (multi-step), each function call will have a signature and you must pass all signatures back.
- Model responses without a function call will return a thought signature inside the last part returned by the model.

The following table provides a visualization for multi-step function calls,
combining the definitions of turns and steps with the concept of signatures
introduced above:

|---|---|---|---|---|
| **Turn** | **Step** | **User Request** | **Model Response** | **FunctionResponse** |
| 1 | 1 | `request1 = user_prompt` | `FC1 + signature` | `FR1` |
| 1 | 2 | `request2 = request1 + (FC1 + signature) + FR1` | `FC2 + signature` | `FR2` |
| 1 | 3 | `request3 = request2 + (FC2 + signature) + FR2` | `text_output <br />` `(no FCs)` | None |

## Signatures in function calling parts

When Gemini generates a `functionCall`, it relies on the `thought_signature`
to process the tool's output correctly in the next turn.

- **Behavior** :
  - **Single Function Call** : The `functionCall` part will contain a `thought_signature`.
  - **Parallel Function Calls** : If the model generates parallel function calls in a response, the `thought_signature` is attached **only to the first** `functionCall` part. Subsequent `functionCall` parts in the same response will **not** contain a signature.
- **Requirement** : You **must** return this signature in the exact part where it was received when sending the conversation history back.
- **Validation** : Strict validation is enforced for all function calls within the current turn . (Only current turn is required; we don't validate on previous turns)
  - The API goes back in the history (newest to oldest) to find the most recent **User** message that contains standard content (e.g., `text`) ( which would be the start of the current turn). This will not **be** a `functionResponse`.
  - **All** model `functionCall` turns occurring after that specific use message are considered part of the turn.
  - The **first** `functionCall` part in **each step** of the current turn **must** include its `thought_signature`.
  - If you omit a `thought_signature` for the first `functionCall` part in any step of the current turn, the request will fail with a 400 error.
- **If proper signatures are not returned, here is how you will error out**
  - Gemini 3 models: Failure to include signatures will result in a 400 error. The verbiage will be of the form:
    - Function call `<Function Call>` in the `<index of contents array>` content block is missing a `thought_signature`. For example, *Function
      call `FC1` in the `1.` content block is missing a `thought_signature`.*

### Sequential function calling example

This section shows an example of multiple function calls where the user asks a
complex question requiring multiple tasks.

Let's walk through a multiple-turn function calling example where the user asks
a complex question requiring multiple tasks: `"Check flight status for AA100 and
book a taxi if delayed"`.

|---|---|---|---|---|
| **Turn** | **Step** | **User Request** | **Model Response** | **FunctionResponse** |
| 1 | 1 | `request1="Check flight status for AA100 and book a taxi 2 hours before if delayed."` | `FC1 ("check_flight") + signature` | `FR1` |
| 1 | 2 | `request2 = request1 + FC1 ("check_flight") + signature + FR1` | `FC2("book_taxi") + signature` | `FR2` |
| 1 | 3 | `request3 = request2 + FC2 ("book_taxi") + signature + FR2` | `text_output <br />` `(no FCs)` | `None` |

The following code illustrates the sequence in the above table.

**Turn 1, Step 1 (User request)**

    {
      "contents": [
        {
          "role": "user",
          "parts": [
            {
              "text": "Check flight status for AA100 and book a taxi 2 hours before if delayed."
            }
          ]
        }
      ],
      "tools": [
        {
          "functionDeclarations": [
            {
              "name": "check_flight",
              "description": "Gets the current status of a flight",
              "parameters": {
                "type": "object",
                "properties": {
                  "flight": {
                    "type": "string",
                    "description": "The flight number to check"
                  }
                },
                "required": [
                  "flight"
                ]
              }
            },
            {
              "name": "book_taxi",
              "description": "Book a taxi",
              "parameters": {
                "type": "object",
                "properties": {
                  "time": {
                    "type": "string",
                    "description": "time to book the taxi"
                  }
                },
                "required": [
                  "time"
                ]
              }
            }
          ]
        }
      ]
    }

**Turn 1, Step 1 (Model response)**

    {
    "content": {
            "role": "model",
            "parts": [
              {
                "functionCall": {
                  "name": "check_flight",
                  "args": {
                    "flight": "AA100"
                  }
                },
                "thoughtSignature": "<Signature A>"
              }
            ]
      }
    }

**Turn 1, Step 2 (User response - Sending tool outputs)** Since this user turn
only contains a `functionResponse` (no fresh text), we are still in Turn 1. We
must preserve `<Signature_A>`.

    {
          "role": "user",
          "parts": [
            {
              "text": "Check flight status for AA100 and book a taxi 2 hours before if delayed."
            }
          ]
        },
        {
            "role": "model",
            "parts": [
              {
                "functionCall": {
                  "name": "check_flight",
                  "args": {
                    "flight": "AA100"
                  }
                },
                "thoughtSignature": "<Signature A>" //Required and Validated
              }
            ]
          },
          {
            "role": "user",
            "parts": [
              {
                "functionResponse": {
                  "name": "check_flight",
                  "response": {
                    "status": "delayed",
                    "departure_time": "12 PM"
                    }
                  }
                }
            ]
    }

**Turn 1, Step 2 (Model)** The model now decides to book a taxi based on the
previous tool output.

    {
          "content": {
            "role": "model",
            "parts": [
              {
                "functionCall": {
                  "name": "book_taxi",
                  "args": {
                    "time": "10 AM"
                  }
                },
                "thoughtSignature": "<Signature B>"
              }
            ]
          }
    }

**Turn 1, Step 3 (User - Sending tool output)** To send the taxi booking
confirmation, we must include signatures for **ALL** function calls in this loop
(`<Signature A>` + `<Signature B>`).

    {
          "role": "user",
          "parts": [
            {
              "text": "Check flight status for AA100 and book a taxi 2 hours before if delayed."
            }
          ]
        },
        {
            "role": "model",
            "parts": [
              {
                "functionCall": {
                  "name": "check_flight",
                  "args": {
                    "flight": "AA100"
                  }
                },
                "thoughtSignature": "<Signature A>" //Required and Validated
              }
            ]
          },
          {
            "role": "user",
            "parts": [
              {
                "functionResponse": {
                  "name": "check_flight",
                  "response": {
                    "status": "delayed",
                    "departure_time": "12 PM"
                  }
                  }
                }
            ]
          },
          {
            "role": "model",
            "parts": [
              {
                "functionCall": {
                  "name": "book_taxi",
                  "args": {
                    "time": "10 AM"
                  }
                },
                "thoughtSignature": "<Signature B>" //Required and Validated
              }
            ]
          },
          {
            "role": "user",
            "parts": [
              {
                "functionResponse": {
                  "name": "book_taxi",
                  "response": {
                    "booking_status": "success"
                  }
                  }
                }
            ]
        }
    }

### Parallel function calling example

Let's walk through a parallel function calling example where the users asks
`"Check weather in Paris and London"` to see where the model does validation.

| **Turn** | **Step** | **User Request** | **Model Response** | **FunctionResponse** |
|---|---|---|---|---|
| 1 | 1 | `request1="Check the weather in Paris and London"` | FC1 ("Paris") + signature FC2 ("London") | FR1 |
| 1 | 2 | `request 2 = request1 + FC1 ("Paris") + signature + FC2 ("London")` | text_output (no FCs) | None |

The following code illustrates the sequence in the above table.

**Turn 1, Step 1 (User request)**

    {
      "contents": [
        {
          "role": "user",
          "parts": [
            {
              "text": "Check the weather in Paris and London."
            }
          ]
        }
      ],
      "tools": [
        {
          "functionDeclarations": [
            {
              "name": "get_current_temperature",
              "description": "Gets the current temperature for a given location.",
              "parameters": {
                "type": "object",
                "properties": {
                  "location": {
                    "type": "string",
                    "description": "The city name, e.g. San Francisco"
                  }
                },
                "required": [
                  "location"
                ]
              }
            }
          ]
        }
      ]
    }

**Turn 1, Step 1 (Model response)**

    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "get_current_temperature",
              "args": {
                "location": "Paris"
              }
            },
            "thoughtSignature": "<Signature_A>"// INCLUDED on First FC
          },
          {
            "functionCall": {
              "name": "get_current_temperature",
              "args": {
                "location": "London"
              }// NO signature on subsequent parallel FCs
            }
          }
        ]
      }
    }

**Turn 1, Step 2 (User response - Sending tool outputs)** We must preserve
`<Signature_A>` on the first part exactly as received.

    [
      {
        "role": "user",
        "parts": [
          {
            "text": "Check the weather in Paris and London."
          }
        ]
      },
      {
        "role": "model",
        "parts": [
          {
            "functionCall": {
              "name": "get_current_temperature",
              "args": {
                "city": "Paris"
              }
            },
            "thought_signature": "<Signature_A>" // MUST BE INCLUDED
          },
          {
            "functionCall": {
              "name": "get_current_temperature",
              "args": {
                "city": "London"
              }
            }
          } // NO SIGNATURE FIELD
        ]
      },
      {
        "role": "user",
        "parts": [
          {
            "functionResponse": {
              "name": "get_current_temperature",
              "response": {
                "temp": "15C"
              }
            }
          },
          {
            "functionResponse": {
              "name": "get_current_temperature",
              "response": {
                "temp": "12C"
              }
            }
          }
        ]
      }
    ]

## Signatures in non `functionCall` parts

Gemini may also return `thought_signatures` in the final part of the response
in non-function-call parts.

- **Behavior** : The final content part (`text, inlineData...`) returned by the model may contain a `thought_signature`.
- **Recommendation** : Returning these signatures is **recommended** to ensure the model maintains high-quality reasoning, especially for complex instruction following or simulated agentic workflows.
- **Validation** : The API does **not** strictly enforce validation. You won't receive a blocking error if you omit them, though performance may degrade.

### Text/In-context reasoning (No validation)

**Turn 1, Step 1 (Model response)**

    {
      "role": "model",
      "parts": [
        {
          "text": "I need to calculate the risk. Let me think step-by-step...",
          "thought_signature": "<Signature_C>" // OPTIONAL (Recommended)
        }
      ]
    }

**Turn 2, Step 1 (User)**

    [
      { "role": "user", "parts": [{ "text": "What is the risk?" }] },
      {
        "role": "model", 
        "parts": [
          {
            "text": "I need to calculate the risk. Let me think step-by-step...",
            // If you omit <Signature_C> here, no error will occur.
          }
        ]
      },
      { "role": "user", "parts": [{ "text": "Summarize it." }] }
    ]

## Thought preservation and token usage

**Beginning with Gemini 3.5 Flash**, the model uses the reasoning context
from all previous turns when thought signatures are present in the
conversation history.

To enable thought preservation, **pass the full, unmodified conversation history** (including the `thought_signature` fields returned in previous model turns) in the `contents` array of your request.

### Managing token consumption

Preserving intermediate thoughts across multiple turns increases the input
token count in subsequent turns, as the model must parse the thought
signatures from previous turns.

If your application performs simple queries or you want to minimize costs in
long conversations, you can clear previous thought signatures from the
conversation history.

> [!NOTE]
> **Note:** **Do not clear thought signatures within the current turn.** Omitting thought signatures for function calling parts within the active, incomplete turn will result in a `400` validation error (see [Signatures in function calling parts](https://ai.google.dev/gemini-api/docs/thought-signatures#function-calling)).

## Signatures for OpenAI compatibility

The following examples shows how to handle thought signatures for a chat
completion API using [OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai).

### Sequential function calling example

This is an example of multiple function calling where the user asks a complex
question requiring multiple tasks.

Let's walk through a multiple-turn function calling example where the user asks
`Check flight status for AA100 and book a taxi if delayed` and you can see what
happens when the user asks a complex question requiring multiple tasks.

|---|---|---|---|---|
| **Turn** | **Step** | **User Request** | **Model Response** | **FunctionResponse** |
| 1 | 1 | `request1 = "Check flight status for AA100 and book a taxi 2 hours before if delayed."` | `FC1 ("check_flight") + signature` | `FR1` |
| 1 | 2 | `request2 = request1 + FC1 ("check_flight") + signature + FR1` | `FC2("book_taxi") + signature` | `FR2` |
| 1 | 3 | `request3 = request2 + FC2 ("book_taxi") + signature + FR2` | `text_output <br />` `(no FCs)` | `None` |

The following code walks through the given sequence.

**Turn 1, Step 1 (User Request)**

    {
      "model": "google/gemini-3.1-pro-preview",
      "messages": [
        {
          "role": "user",
          "content": "Check flight status for AA100 and book a taxi 2 hours before if delayed."
        }
      ],
      "tools": [
        {
          "type": "function",
          "function": {
            "name": "check_flight",
            "description": "Gets the current status of a flight",
            "parameters": {
              "type": "object",
              "properties": {
                "flight": {
                  "type": "string",
                  "description": "The flight number to check."
                }
              },
              "required": [
                "flight"
              ]
            }
          }
        },
        {
          "type": "function",
          "function": {
            "name": "book_taxi",
            "description": "Book a taxi",
            "parameters": {
              "type": "object",
              "properties": {
                "time": {
                  "type": "string",
                  "description": "time to book the taxi"
                }
              },
              "required": [
                "time"
              ]
            }
          }
        }
      ]
    }

**Turn 1, Step 1 (Model Response)**

    {
          "role": "model",
            "tool_calls": [
              {
                "extra_content": {
                  "google": {
                    "thought_signature": "<Signature A>"
                  }
                },
                "function": {
                  "arguments": "{\"flight\":\"AA100\"}",
                  "name": "check_flight"
                },
                "id": "function-call-1",
                "type": "function"
              }
            ]
        }

**Turn 1, Step 2 (User Response - Sending Tool Outputs)**

Since this user turn only contains a `functionResponse` (no fresh text), we are
still in Turn 1 and must preserve `<Signature_A>`.

    "messages": [
        {
          "role": "user",
          "content": "Check flight status for AA100 and book a taxi 2 hours before if delayed."
        },
        {
          "role": "model",
            "tool_calls": [
              {
                "extra_content": {
                  "google": {
                    "thought_signature": "<Signature A>" //Required and Validated
                  }
                },
                "function": {
                  "arguments": "{\"flight\":\"AA100\"}",
                  "name": "check_flight"
                },
                "id": "function-call-1",
                "type": "function"
              }
            ]
        },
        {
          "role": "tool",
          "name": "check_flight",
          "tool_call_id": "function-call-1",
          "content": "{\"status\":\"delayed\",\"departure_time\":\"12 PM\"}"                 
        }
      ]

**Turn 1, Step 2 (Model)**

The model now decides to book a taxi based on the previous tool output.

    {
    "role": "model",
    "tool_calls": [
    {
    "extra_content": {
    "google": {
    "thought_signature": "<Signature B>"
    }
                },
                "function": {
                  "arguments": "{\"time\":\"10 AM\"}",
                  "name": "book_taxi"
                },
                "id": "function-call-2",
                "type": "function"
              }
           ]
    }

**Turn 1, Step 3 (User - Sending Tool Output)**

To send the taxi booking confirmation, we must include signatures for ALL
function calls in this loop (`<Signature A>` + `<Signature B>`).

    "messages": [
        {
          "role": "user",
          "content": "Check flight status for AA100 and book a taxi 2 hours before if delayed."
        },
        {
          "role": "model",
            "tool_calls": [
              {
                "extra_content": {
                  "google": {
                    "thought_signature": "<Signature A>" //Required and Validated
                  }
                },
                "function": {
                  "arguments": "{\"flight\":\"AA100\"}",
                  "name": "check_flight"
                },
                "id": "function-call-1d6a1a61-6f4f-4029-80ce-61586bd86da5",
                "type": "function"
              }
            ]
        },
        {
          "role": "tool",
          "name": "check_flight",
          "tool_call_id": "function-call-1d6a1a61-6f4f-4029-80ce-61586bd86da5",
          "content": "{\"status\":\"delayed\",\"departure_time\":\"12 PM\"}"                 
        },
        {
          "role": "model",
            "tool_calls": [
              {
                "extra_content": {
                  "google": {
                    "thought_signature": "<Signature B>" //Required and Validated
                  }
                },
                "function": {
                  "arguments": "{\"time\":\"10 AM\"}",
                  "name": "book_taxi"
                },
                "id": "function-call-65b325ba-9b40-4003-9535-8c7137b35634",
                "type": "function"
              }
            ]
        },
        {
          "role": "tool",
          "name": "book_taxi",
          "tool_call_id": "function-call-65b325ba-9b40-4003-9535-8c7137b35634",
          "content": "{\"booking_status\":\"success\"}"
        }
      ]

### Parallel function calling example

Let's walk through a parallel function calling example where the users asks
`"Check weather in Paris and London"` and you can see where the model does
validation.

|---|---|---|---|---|
| **Turn** | **Step** | **User Request** | **Model Response** | **FunctionResponse** |
| 1 | 1 | `request1="Check the weather in Paris and London"` | `FC1 ("Paris") + signature <br />` `FC2 ("London")` | `FR1` |
| 1 | 2 | `request 2 = request1 + FC1 ("Paris") + signature + FC2 ("London")` | `text_output <br />` `(no FCs)` | `None` |

Here's the code to walk through the given sequence.

**Turn 1, Step 1 (User Request)**

    {
      "contents": [
        {
          "role": "user",
          "parts": [
            {
              "text": "Check the weather in Paris and London."
            }
          ]
        }
      ],
      "tools": [
        {
          "functionDeclarations": [
            {
              "name": "get_current_temperature",
              "description": "Gets the current temperature for a given location.",
              "parameters": {
                "type": "object",
                "properties": {
                  "location": {
                    "type": "string",
                    "description": "The city name, e.g. San Francisco"
                  }
                },
                "required": [
                  "location"
                ]
              }
            }
          ]
        }
      ]
    }

**Turn 1, Step 1 (Model Response)**

    {
    "role": "assistant",
            "tool_calls": [
              {
                "extra_content": {
                  "google": {
                    "thought_signature": "<Signature A>" //Signature returned
                  }
                },
                "function": {
                  "arguments": "{\"location\":\"Paris\"}",
                  "name": "get_current_temperature"
                },
                "id": "function-call-f3b9ecb3-d55f-4076-98c8-b13e9d1c0e01",
                "type": "function"
              },
              {
                "function": {
                  "arguments": "{\"location\":\"London\"}",
                  "name": "get_current_temperature"
                },
                "id": "function-call-335673ad-913e-42d1-bbf5-387c8ab80f44",
                "type": "function" // No signature on Parallel FC
              }
            ]
    }

**Turn 1, Step 2 (User Response - Sending Tool Outputs)**

You must preserve `<Signature_A>` on the first part exactly as received.

    "messages": [
        {
          "role": "user",
          "content": "Check the weather in Paris and London."
        },
        {
          "role": "assistant",
            "tool_calls": [
              {
                "extra_content": {
                  "google": {
                    "thought_signature": "<Signature A>" //Required
                  }
                },
                "function": {
                  "arguments": "{\"location\":\"Paris\"}",
                  "name": "get_current_temperature"
                },
                "id": "function-call-f3b9ecb3-d55f-4076-98c8-b13e9d1c0e01",
                "type": "function"
              },
              {
                "function": { //No Signature
                  "arguments": "{\"location\":\"London\"}",
                  "name": "get_current_temperature"
                },
                "id": "function-call-335673ad-913e-42d1-bbf5-387c8ab80f44",
                "type": "function"
              }
            ]
        },
        {
          "role":"tool",
          "name": "get_current_temperature",
          "tool_call_id": "function-call-f3b9ecb3-d55f-4076-98c8-b13e9d1c0e01",
          "content": "{\"temp\":\"15C\"}"
        },    
        {
          "role":"tool",
          "name": "get_current_temperature",
          "tool_call_id": "function-call-335673ad-913e-42d1-bbf5-387c8ab80f44",
          "content": "{\"temp\":\"12C\"}"
        }
      ]

## FAQs

1. **How do I transfer history from a different model to Gemini 3 with a
   function call part in the current turn and step? I need to provide function call
   parts that were not generated by the API and therefore don't have an associated
   thought signature?**

   While injecting custom function call blocks into the request is strongly
   discouraged, in cases where it can't be avoided, e.g. providing information
   to the model on function calls and responses that were executed
   deterministically by the client, or transferring a trace from a different
   model that does not include thought signatures, you can set the following
   dummy signatures of either `"context_engineering_is_the_way_to_go"` or
   `"skip_thought_signature_validator"` in the thought signature field to skip
   validation.
2. **I am sending back interleaved parallel function calls and responses and the
   API is returning a 400. Why?**

   When the API returns parallel function calls "FC1 + signature, FC2", the
   user response expected is "FC1+ signature, FC2, FR1, FR2". If you have them
   interleaved as "FC1 + signature, FR1, FC2, FR2" the API will return a 400
   error.
3. **When streaming and the model is not returning a function call I can't find
   the thought signature**

   During a model response not containing a FC with a streaming request, the
   model may return the thought signature in a part with an empty text content
   part. It is advisable to parse the entire request until the `finish_reason`
   is returned by the model.

## Thought signatures for different models

[Gemini 3 models](https://ai.google.dev/gemini-api/docs/models#gemini-3) and Gemini 2.5 models
behave differently with thought signatures:

- **Thought preservation** :
  - **Beginning with Gemini 3.5 Flash**, the model uses reasoning context from all previous turns when thought signatures are present in the conversation history.
  - Earlier models do not use reasoning context from previous turns in the same manner.
- **If there are function calls in a response** :
  - Gemini 3 will always have the signature on the first function call part. It is **mandatory** to return that part.
  - Gemini 2.5 will have the signature in the first part (regardless of type). It is **optional** to return that part.
- **If there are no function calls in a response** :
  - Gemini 3 will have the signature on the last part if the model generates a thought.
  - Gemini 2.5 won't have a signature in any part.

Refer to the [Thinking](https://ai.google.dev/gemini-api/docs/thinking#signatures) page for more
comparison details.
For Gemini 3 Image models see the thinking process section of the
[Image generation](https://ai.google.dev/gemini-api/docs/image-generation#thinking-process) guide.

# Function calling with the Gemini API

Function calling lets you connect models to external tools and APIs.
Instead of generating text responses, the model determines when to call specific
functions and provides the necessary parameters to execute real-world actions.
This allows the model to act as a bridge between natural language and real-world
actions and data. Function calling has 3 primary use cases:

- **Augment Knowledge:** Access information from external sources like databases, APIs, and knowledge bases.
- **Extend Capabilities:** Use external tools to perform computations and extend the limitations of the model, such as using a calculator or creating charts.
- **Take Actions:** Interact with external systems using APIs, such as scheduling appointments, creating invoices, sending emails, or controlling smart home devices.

> [!NOTE]
> **Important:** Gemini 3 model APIs now generate a unique `id` for every function call. If you are manually constructing the conversation history or using the REST API, when returning the result of your executed function to the model we recommend passing the matching `id` in your `functionResponse`. If you are using the standard Python or Node.js SDKs, this is handled automatically.

<button value="weather">Get Weather</button> <button value="meeting" default="">Schedule Meeting</button> <button value="chart">Create Chart</button>

### Python

    from google import genai
    from google.genai import types

    # Define the function declaration for the model
    schedule_meeting_function = {
        "name": "schedule_meeting",
        "description": "Schedules a meeting with specified attendees at a given time and date.",
        "parameters": {
            "type": "object",
            "properties": {
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of people attending the meeting.",
                },
                "date": {
                    "type": "string",
                    "description": "Date of the meeting (e.g., '2024-07-29')",
                },
                "time": {
                    "type": "string",
                    "description": "Time of the meeting (e.g., '15:00')",
                },
                "topic": {
                    "type": "string",
                    "description": "The subject or topic of the meeting.",
                },
            },
            "required": ["attendees", "date", "time", "topic"],
        },
    }

    # Configure the client and tools
    client = genai.Client()
    tools = types.Tool(function_declarations=[schedule_meeting_function])
    config = types.GenerateContentConfig(tools=[tools])

    # Send request with function declarations
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Schedule a meeting with Bob and Alice for 03/14/2025 at 10:00 AM about the Q3 planning.",
        config=config,
    )

    # Check for a function call
    if response.candidates[0].content.parts[0].function_call:
        function_call = response.candidates[0].content.parts[0].function_call
        print(f"Function to call: {function_call.name}")
        print(f"ID: {function_call.id}")
        print(f"Arguments: {function_call.args}")
        #  In a real app, you would call your function here:
        #  result = schedule_meeting(**function_call.args)
    else:
        print("No function call found in the response.")
        print(response.text)

### JavaScript

    import { GoogleGenAI, Type } from '@google/genai';

    // Configure the client
    const ai = new GoogleGenAI({});

    // Define the function declaration for the model
    const scheduleMeetingFunctionDeclaration = {
      name: 'schedule_meeting',
      description: 'Schedules a meeting with specified attendees at a given time and date.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          attendees: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of people attending the meeting.',
          },
          date: {
            type: Type.STRING,
            description: 'Date of the meeting (e.g., "2024-07-29")',
          },
          time: {
            type: Type.STRING,
            description: 'Time of the meeting (e.g., "15:00")',
          },
          topic: {
            type: Type.STRING,
            description: 'The subject or topic of the meeting.',
          },
        },
        required: ['attendees', 'date', 'time', 'topic'],
      },
    };

    // Send request with function declarations
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Schedule a meeting with Bob and Alice for 03/27/2025 at 10:00 AM about the Q3 planning.',
      config: {
        tools: [{
          functionDeclarations: [scheduleMeetingFunctionDeclaration]
        }],
      },
    });

    // Check for function calls in the response
    if (response.functionCalls && response.functionCalls.length > 0) {
      const functionCall = response.functionCalls[0]; // Assuming one function call
      console.log(`Function to call: ${functionCall.name}`);
      console.log(`ID: ${functionCall.id}`);
      console.log(`Arguments: ${JSON.stringify(functionCall.args)}`);
      // In a real app, you would call your actual function here:
      // const result = await scheduleMeeting(functionCall.args);
    } else {
      console.log("No function call found in the response.");
      console.log(response.text);
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "role": "user",
            "parts": [
              {
                "text": "Schedule a meeting with Bob and Alice for 03/27/2025 at 10:00 AM about the Q3 planning."
              }
            ]
          }
        ],
        "tools": [
          {
            "functionDeclarations": [
              {
                "name": "schedule_meeting",
                "description": "Schedules a meeting with specified attendees at a given time and date.",
                "parameters": {
                  "type": "object",
                  "properties": {
                    "attendees": {
                      "type": "array",
                      "items": {"type": "string"},
                      "description": "List of people attending the meeting."
                    },
                    "date": {
                      "type": "string",
                      "description": "Date of the meeting (e.g., '2024-07-29')"
                    },
                    "time": {
                      "type": "string",
                      "description": "Time of the meeting (e.g., '15:00')"
                    },
                    "topic": {
                      "type": "string",
                      "description": "The subject or topic of the meeting."
                    }
                  },
                  "required": ["attendees", "date", "time", "topic"]
                }
              }
            ]
          }
        ]
      }'

## How function calling works

![function calling
overview](https://ai.google.dev/static/gemini-api/docs/images/function-calling-overview.png)

Function calling involves a structured interaction between your application, the
model, and external functions. Here's a breakdown of the process:

1. **Define function declaration:** Define the function declaration in your application code. Function Declarations describe the function's name, parameters, and purpose to the model.
2. **Call API with function declarations:** Send user prompt along with the function declaration(s) to the model. It analyzes the request and determines if a function call would be helpful. If so, it responds with a structured JSON object containing the function name, arguments, and a unique `id` (this `id` is now always returned by the API for Gemini 3 models^\*^).
3. **Execute function code (your responsibility):** The Model *doesn't* execute the function itself. It's your application's responsibility to process the response and check for a function call. If
   - **Yes** : Extract the name, args, and `id` of the function and execute the corresponding function in your application.
   - **No:** The model has provided a direct text response to the prompt (this flow is less emphasized in the example but is a possible outcome).
4. **Create user friendly response:** If a function was executed, capture the result and send it back to the model, ensuring you include the matching `id`, in a subsequent turn of the conversation. It will use the result to generate a final, user-friendly response that incorporates the information from the function call.

This process can be repeated over multiple turns, allowing for complex
interactions and workflows. The model also supports calling multiple functions
in a single turn ([parallel function calling](https://ai.google.dev/gemini-api/docs/function-calling#parallel_function_calling)), in
sequence ([compositional function calling](https://ai.google.dev/gemini-api/docs/function-calling#compositional_function_calling)),
and with built-in Gemini tools ([multi-tool use](https://ai.google.dev/gemini-api/docs/function-calling#native-tools)).

^\*^ **Always map function IDs:** Gemini 3 now always returns a unique
`id` with every `functionCall`. Include this exact `id` in your
`functionResponse` so the model can accurately map your result back to the
original request.

### Step 1: Define a function declaration

Define a function and its declaration within your application code that allows
users to set light values and make an API request. This function could call
external services or APIs.

### Python

    # Define a function that the model can call to control smart lights
    set_light_values_declaration = {
        "name": "set_light_values",
        "description": "Sets the brightness and color temperature of a light.",
        "parameters": {
            "type": "object",
            "properties": {
                "brightness": {
                    "type": "integer",
                    "description": "Light level from 0 to 100. Zero is off and 100 is full brightness",
                },
                "color_temp": {
                    "type": "string",
                    "enum": ["daylight", "cool", "warm"],
                    "description": "Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.",
                },
            },
            "required": ["brightness", "color_temp"],
        },
    }

    # This is the actual function that would be called based on the model's suggestion
    def set_light_values(brightness: int, color_temp: str) -> dict[str, int | str]:
        """Set the brightness and color temperature of a room light. (mock API).

        Args:
            brightness: Light level from 0 to 100. Zero is off and 100 is full brightness
            color_temp: Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.

        Returns:
            A dictionary containing the set brightness and color temperature.
        """
        return {"brightness": brightness, "colorTemperature": color_temp}

### JavaScript

    import { Type } from '@google/genai';

    // Define a function that the model can call to control smart lights
    const setLightValuesFunctionDeclaration = {
      name: 'set_light_values',
      description: 'Sets the brightness and color temperature of a light.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          brightness: {
            type: Type.NUMBER,
            description: 'Light level from 0 to 100. Zero is off and 100 is full brightness',
          },
          color_temp: {
            type: Type.STRING,
            enum: ['daylight', 'cool', 'warm'],
            description: 'Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.',
          },
        },
        required: ['brightness', 'color_temp'],
      },
    };

    /**

    *   Set the brightness and color temperature of a room light. (mock API)
    *   @param {number} brightness - Light level from 0 to 100. Zero is off and 100 is full brightness
    *   @param {string} color_temp - Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.
    *   @return {Object} A dictionary containing the set brightness and color temperature.
    */
    function setLightValues(brightness, color_temp) {
      return {
        brightness: brightness,
        colorTemperature: color_temp
      };
    }

### Step 2: Call the model with function declarations

Once you have defined your function declarations, you can prompt the model to
use them. It analyzes the prompt and function declarations and decides whether
to respond directly or to call a function. If a function is called, the response
object will contain a function call suggestion.

### Python

    from google.genai import types

    # Configure the client and tools
    client = genai.Client()
    tools = types.Tool(function_declarations=[set_light_values_declaration])
    config = types.GenerateContentConfig(tools=[tools])

    # Define user prompt
    contents = [
        types.Content(
            role="user", parts=[types.Part(text="Turn the lights down to a romantic level")]
        )
    ]

    # Send request with function declarations
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=contents,
        config=config,
    )

    print(response.candidates[0].content.parts[0].function_call)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    // Generation config with function declaration
    const config = {
      tools: [{
        functionDeclarations: [setLightValuesFunctionDeclaration]
      }]
    };

    // Configure the client
    const ai = new GoogleGenAI({});

    // Define user prompt
    const contents = [
      {
        role: 'user',
        parts: [{ text: 'Turn the lights down to a romantic level' }]
      }
    ];

    // Send request with function declarations
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: config
    });

    console.log(response.functionCalls[0]);

The model then returns a `functionCall` object in an OpenAPI compatible
schema specifying how to call one or more of the declared functions in order to
respond to the user's question.

### Python

    id='8f2b1a3c' args={'color_temp': 'warm', 'brightness': 25} name='set_light_values'

### JavaScript

    {
      id: '8f2b1a3c',
      name: 'set_light_values',
      args: { brightness: 25, color_temp: 'warm' }
    }

### Step 3: Execute set_light_values function code

Extract the function call details from the model's response, parse the arguments
, and execute the `set_light_values` function.

### Python

    # Extract tool call details, it may not be in the first part.
    tool_call = response.candidates[0].content.parts[0].function_call

    if tool_call.name == "set_light_values":
        result = set_light_values(**tool_call.args)
        print(f"Function execution result: {result}")

### JavaScript

    // Extract tool call details
    const tool_call = response.functionCalls[0]

    let result;
    if (tool_call.name === 'set_light_values') {
      result = setLightValues(tool_call.args.brightness, tool_call.args.color_temp);
      console.log(`Function execution result: ${JSON.stringify(result)}`);
    }

### Step 4: Create user friendly response with function result and call the model again

Finally, send the result of the function execution back to the model so it can
incorporate this information into its final response to the user.

### Python

    from google import genai
    from google.genai import types

    # Create a function response part
    function_response_part = types.Part.from_function_response(
        name=tool_call.name,
        response={"result": result},
        id=tool_call.id,
    )

    # Append function call and result of the function execution to contents
    contents.append(response.candidates[0].content) # Append the content from the model's response.
    contents.append(types.Content(role="user", parts=[function_response_part])) # Append the function response

    client = genai.Client()
    final_response = client.models.generate_content(
        model="gemini-3.5-flash",
        config=config,
        contents=contents,
    )

    print(final_response.text)

### JavaScript

    // Create a function response part
    const function_response_part = {
      name: tool_call.name,
      response: { result },
      id: tool_call.id
    }

    // Append function call and result of the function execution to contents
    contents.push(response.candidates[0].content);
    contents.push({ role: 'user', parts: [{ functionResponse: function_response_part }] });

    // Get the final response from the model
    const final_response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: config
    });

    console.log(final_response.text);

This completes the function calling flow. The model successfully used the
`set_light_values` function to perform the request action of the user.

## Function declarations

When you implement function calling in a prompt, you create a `tools` object,
which contains one or more `function declarations`. You define functions using
JSON, specifically with a [select subset](https://ai.google.dev/api/caching#Schema)
of the [OpenAPI schema](https://spec.openapis.org/oas/v3.0.3#schemaw) format. A
single function declaration can include the following parameters:

- `name` (string): A unique name for the function (`get_weather_forecast`, `send_email`). Use descriptive names without spaces or special characters (use underscores or camelCase).
- `description` (string): A clear and detailed explanation of the function's purpose and capabilities. This is crucial for the model to understand when to use the function. Be specific and provide examples if helpful ("Finds theaters based on location and optionally movie title which is currently playing in theaters.").
- `parameters` (object): Defines the input parameters the function expects.
  - `type` (string): Specifies the overall data type, such as `object`.
  - `properties` (object): Lists individual parameters, each with:
    - `type` (string): The data type of the parameter, such as `string`, `integer`, `boolean, array`.
    - `description` (string): A description of the parameter's purpose and format. Provide examples and constraints ("The city and state, e.g., 'San Francisco, CA' or a zip code e.g., '95616'.").
    - `enum` (array, optional): If the parameter values are from a fixed set, use "enum" to list the allowed values instead of just describing them in the description. This improves accuracy ("enum": \["daylight", "cool", "warm"\]).
  - `required` (array): An array of strings listing the parameter names that are mandatory for the function to operate.

You can also construct `FunctionDeclarations` from Python functions directly using
`types.FunctionDeclaration.from_callable(client=client, callable=your_function)`.

## Function calling with thinking models

Gemini 3 and 2.5 series models use an internal ["thinking"](https://ai.google.dev/gemini-api/docs/thinking) process to reason through requests. This
significantly improves function calling performance,
allowing the model to better determine when to call a function and which
parameters to use. Because the Gemini API is stateless, models use
[thought signatures](https://ai.google.dev/gemini-api/docs/thought-signatures) to maintain context
across multi-turn conversations.

This section covers advanced management of thought signatures and is only
necessary if you're manually constructing API requests (e.g., via REST) or
manipulating conversation history.

**If you're using the [Google GenAI SDKs](https://ai.google.dev/gemini-api/docs/libraries) (our
official libraries), you don't need to manage this process** . The SDKs
automatically handle the necessary steps, as shown in the earlier
[example](https://ai.google.dev/gemini-api/docs/function-calling#step-4).

### Managing conversation history manually

If you modify the conversation history manually, instead of sending the
[complete previous response](https://ai.google.dev/gemini-api/docs/function-calling#step-4) you
must correctly handle the `thought_signature` included in the model's turn.

Follow these rules to ensure the model's context is preserved:

- Always send the `thought_signature` back to the model inside its original [`Part`](https://ai.google.dev/api#request-body-structure).
- **Always include the exact `id` from the `function_call` in your
  `function_response` so the API can map the result to the correct request.**
- Don't merge a `Part` containing a signature with one that does not. This breaks the positional context of the thought.
- Don't combine two `Parts` that both contain signatures, as the signature strings cannot be merged.

#### Gemini 3 thought signatures

In Gemini 3, any [`Part`](https://ai.google.dev/api#request-body-structure) of a model response
may contain a thought signature.
While we generally recommend returning signatures from all `Part` types,
passing back thought signatures is mandatory for function calling. Unless you
are manipulating conversation history manually, the Google GenAI SDK will
handle thought signatures automatically.

If you are manipulating conversation history manually, refer to the
[Thoughts Signatures](https://ai.google.dev/gemini-api/docs/thought-signatures) page for complete
guidance and details on handling thought signatures for Gemini 3.

##### Inspecting thought signatures

While not necessary for implementation, you can inspect the response to see the
`thought_signature` for debugging or educational purposes.

### Python

    import base64
    # After receiving a response from a model with thinking enabled
    # response = client.models.generate_content(...)

    # The signature is attached to the response part containing the function call
    part = response.candidates[0].content.parts[0]
    if part.thought_signature:
      print(base64.b64encode(part.thought_signature).decode("utf-8"))

### JavaScript

    // After receiving a response from a model with thinking enabled
    // const response = await ai.models.generateContent(...)

    // The signature is attached to the response part containing the function call
    const part = response.candidates[0].content.parts[0];
    if (part.thoughtSignature) {
      console.log(part.thoughtSignature);
    }

Learn more about limitations and usage of thought signatures, and about thinking
models in general, on the [Thinking](https://ai.google.dev/gemini-api/docs/thinking#signatures) page.

## Parallel function calling

In addition to single turn function calling, you can also call multiple
functions at once. Parallel function calling lets you execute multiple functions
at once and is used when the functions are not dependent on each other. This is
useful in scenarios like gathering data from multiple independent sources, such
as retrieving customer details from different databases or checking inventory
levels across various warehouses or performing multiple actions such as
converting your apartment into a disco.

When the model initiates multiple function calls in a single turn, you don't
need to return the `function_result` objects in the same order that the
`function_call` objects were received. The Gemini API maps each result back to
its corresponding call using the `id` from the model's output. This lets you
execute your functions asynchronously and append the results to your list as
they complete.

### Python

    power_disco_ball = {
        "name": "power_disco_ball",
        "description": "Powers the spinning disco ball.",
        "parameters": {
            "type": "object",
            "properties": {
                "power": {
                    "type": "boolean",
                    "description": "Whether to turn the disco ball on or off.",
                }
            },
            "required": ["power"],
        },
    }

    start_music = {
        "name": "start_music",
        "description": "Play some music matching the specified parameters.",
        "parameters": {
            "type": "object",
            "properties": {
                "energetic": {
                    "type": "boolean",
                    "description": "Whether the music is energetic or not.",
                },
                "loud": {
                    "type": "boolean",
                    "description": "Whether the music is loud or not.",
                },
            },
            "required": ["energetic", "loud"],
        },
    }

    dim_lights = {
        "name": "dim_lights",
        "description": "Dim the lights.",
        "parameters": {
            "type": "object",
            "properties": {
                "brightness": {
                    "type": "number",
                    "description": "The brightness of the lights, 0.0 is off, 1.0 is full.",
                }
            },
            "required": ["brightness"],
        },
    }

### JavaScript

    import { Type } from '@google/genai';

    const powerDiscoBall = {
      name: 'power_disco_ball',
      description: 'Powers the spinning disco ball.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          power: {
            type: Type.BOOLEAN,
            description: 'Whether to turn the disco ball on or off.'
          }
        },
        required: ['power']
      }
    };

    const startMusic = {
      name: 'start_music',
      description: 'Play some music matching the specified parameters.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          energetic: {
            type: Type.BOOLEAN,
            description: 'Whether the music is energetic or not.'
          },
          loud: {
            type: Type.BOOLEAN,
            description: 'Whether the music is loud or not.'
          }
        },
        required: ['energetic', 'loud']
      }
    };

    const dimLights = {
      name: 'dim_lights',
      description: 'Dim the lights.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          brightness: {
            type: Type.NUMBER,
            description: 'The brightness of the lights, 0.0 is off, 1.0 is full.'
          }
        },
        required: ['brightness']
      }
    };

Configure the function calling mode to allow using all of the specified tools.
To learn more, you can read about
[configuring function calling](https://ai.google.dev/gemini-api/docs/function-calling#function_calling_modes).

### Python

    from google import genai
    from google.genai import types

    # Configure the client and tools
    client = genai.Client()
    house_tools = [
        types.Tool(function_declarations=[power_disco_ball, start_music, dim_lights])
    ]
    config = types.GenerateContentConfig(
        tools=house_tools,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(
            disable=True
        ),
        # Force the model to call 'any' function, instead of chatting.
        tool_config=types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode='ANY')
        ),
    )

    chat = client.chats.create(model="gemini-3.5-flash", config=config)
    response = chat.send_message("Turn this place into a party!")

    # Print out each of the function calls requested from this single call
    print("Example 1: Forced function calling")
    for fn in response.function_calls:
        args = ", ".join(f"{key}={val}" for key, val in fn.args.items())
        print(f"{fn.name}({args}) - ID: {fn.id}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    // Set up function declarations
    const houseFns = [powerDiscoBall, startMusic, dimLights];

    const config = {
        tools: [{
            functionDeclarations: houseFns
        }],
        // Force the model to call 'any' function, instead of chatting.
        toolConfig: {
            functionCallingConfig: {
                mode: 'any'
            }
        }
    };

    // Configure the client
    const ai = new GoogleGenAI({});

    // Create a chat session
    const chat = ai.chats.create({
        model: 'gemini-3.5-flash',
        config: config
    });
    const response = await chat.sendMessage({message: 'Turn this place into a party!'});

    // Print out each of the function calls requested from this single call
    console.log("Example 1: Forced function calling");
    for (const fn of response.functionCalls) {
        const args = Object.entries(fn.args)
            .map(([key, val]) => `${key}=${val}`)
            .join(', ');
        console.log(`${fn.name}(${args}) - ID: ${fn.id}`);
    }

Each of the printed results reflects a single function call that the model has
requested. To send the results back, include the responses in the same order as
they were requested.

The Python SDK supports [automatic function calling](https://ai.google.dev/gemini-api/docs/function-calling#automatic_function_calling_python_only),
which automatically converts Python functions to declarations, handles the
function call execution and response cycle for you. Following is an example for
the disco use case.

> [!NOTE]
> **Note:** Automatic Function Calling is a Python SDK only feature at the moment.

### Python

    from google import genai
    from google.genai import types

    # Actual function implementations
    def power_disco_ball_impl(power: bool) -> dict:
        """Powers the spinning disco ball.

        Args:
            power: Whether to turn the disco ball on or off.

        Returns:
            A status dictionary indicating the current state.
        """
        return {"status": f"Disco ball powered {'on' if power else 'off'}"}

    def start_music_impl(energetic: bool, loud: bool) -> dict:
        """Play some music matching the specified parameters.

        Args:
            energetic: Whether the music is energetic or not.
            loud: Whether the music is loud or not.

        Returns:
            A dictionary containing the music settings.
        """
        music_type = "energetic" if energetic else "chill"
        volume = "loud" if loud else "quiet"
        return {"music_type": music_type, "volume": volume}

    def dim_lights_impl(brightness: float) -> dict:
        """Dim the lights.

        Args:
            brightness: The brightness of the lights, 0.0 is off, 1.0 is full.

        Returns:
            A dictionary containing the new brightness setting.
        """
        return {"brightness": brightness}

    # Configure the client
    client = genai.Client()
    config = types.GenerateContentConfig(
        tools=[power_disco_ball_impl, start_music_impl, dim_lights_impl]
    )

    # Make the request
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Do everything you need to this place into party!",
        config=config,
    )

    print("\nExample 2: Automatic function calling")
    print(response.text)
    # I've turned on the disco ball, started playing loud and energetic music, and dimmed the lights to 50% brightness. Let's get this party started!

## Compositional function calling

Compositional or sequential function calling allows Gemini to chain multiple
function calls together to fulfill a complex request. For example, to answer
"Get the temperature in my current location", the Gemini API might first invoke
a `get_current_location()` function followed by a `get_weather()` function that
takes the location as a parameter.

The following example demonstrates how to implement compositional function
calling using the Python SDK and automatic function calling.

### Python

This example uses the automatic function calling feature of the
`google-genai` Python SDK. The SDK automatically converts the Python
functions to the required schema, executes the function calls when requested
by the model, and sends the results back to the model to complete the task.

    import os
    from google import genai
    from google.genai import types

    # Example Functions
    def get_weather_forecast(location: str) -> dict:
        """Gets the current weather temperature for a given location."""
        print(f"Tool Call: get_weather_forecast(location={location})")
        # TODO: Make API call
        print("Tool Response: {'temperature': 25, 'unit': 'celsius'}")
        return {"temperature": 25, "unit": "celsius"}  # Dummy response

    def set_thermostat_temperature(temperature: int) -> dict:
        """Sets the thermostat to a desired temperature."""
        print(f"Tool Call: set_thermostat_temperature(temperature={temperature})")
        # TODO: Interact with a thermostat API
        print("Tool Response: {'status': 'success'}")
        return {"status": "success"}

    # Configure the client and model
    client = genai.Client()
    config = types.GenerateContentConfig(
        tools=[get_weather_forecast, set_thermostat_temperature]
    )

    # Make the request
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="If it's warmer than 20°C in London, set the thermostat to 20°C, otherwise set it to 18°C.",
        config=config,
    )

    # Print the final, user-facing response
    print(response.text)

**Expected Output**

When you run the code, you will see the SDK orchestrating the function
calls. The model first calls `get_weather_forecast`, receives the
temperature, and then calls `set_thermostat_temperature` with the correct
value based on the logic in the prompt.

    Tool Call: get_weather_forecast(location=London)
    Tool Response: {'temperature': 25, 'unit': 'celsius'}
    Tool Call: set_thermostat_temperature(temperature=20)
    Tool Response: {'status': 'success'}
    OK. I've set the thermostat to 20°C.

### JavaScript

This example shows how to use JavaScript/TypeScript SDK to do comopositional
function calling using a manual execution loop.

    import { GoogleGenAI, Type } from "@google/genai";

    // Configure the client
    const ai = new GoogleGenAI({});

    // Example Functions
    function get_weather_forecast({ location }) {
      console.log(`Tool Call: get_weather_forecast(location=${location})`);
      // TODO: Make API call
      console.log("Tool Response: {'temperature': 25, 'unit': 'celsius'}");
      return { temperature: 25, unit: "celsius" };
    }

    function set_thermostat_temperature({ temperature }) {
      console.log(
        `Tool Call: set_thermostat_temperature(temperature=${temperature})`,
      );
      // TODO: Make API call
      console.log("Tool Response: {'status': 'success'}");
      return { status: "success" };
    }

    const toolFunctions = {
      get_weather_forecast,
      set_thermostat_temperature,
    };

    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_weather_forecast",
            description:
              "Gets the current weather temperature for a given location.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                location: {
                  type: Type.STRING,
                },
              },
              required: ["location"],
            },
          },
          {
            name: "set_thermostat_temperature",
            description: "Sets the thermostat to a desired temperature.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                temperature: {
                  type: Type.NUMBER,
                },
              },
              required: ["temperature"],
            },
          },
        ],
      },
    ];

    // Prompt for the model
    let contents = [
      {
        role: "user",
        parts: [
          {
            text: "If it's warmer than 20°C in London, set the thermostat to 20°C, otherwise set it to 18°C.",
          },
        ],
      },
    ];

    // Loop until the model has no more function calls to make
    while (true) {
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: { tools },
      });

      if (result.functionCalls && result.functionCalls.length > 0) {
        const functionCall = result.functionCalls[0];

        const { name, args } = functionCall;

        if (!toolFunctions[name]) {
          throw new Error(`Unknown function call: ${name}`);
        }

        // Call the function and get the response.
        const toolResponse = toolFunctions[name](args);

        const functionResponsePart = {
          name: functionCall.name,
          response: {
            result: toolResponse,
          },
          id: functionCall.id,
        };

        // Send the function response back to the model.
        contents.push({
          role: "model",
          parts: [
            {
              functionCall: functionCall,
            },
          ],
        });
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: functionResponsePart,
            },
          ],
        });
      } else {
        // No more function calls, break the loop.
        console.log(result.text);
        break;
      }
    }

**Expected Output**

When you run the code, you will see the SDK orchestrating the function
calls. The model first calls `get_weather_forecast`, receives the
temperature, and then calls `set_thermostat_temperature` with the correct
value based on the logic in the prompt.

    Tool Call: get_weather_forecast(location=London)
    Tool Response: {'temperature': 25, 'unit': 'celsius'}
    Tool Call: set_thermostat_temperature(temperature=20)
    Tool Response: {'status': 'success'}
    OK. It's 25°C in London, so I've set the thermostat to 20°C.

Compositional function calling is a native [Live
API](https://ai.google.dev/gemini-api/docs/live) feature. This means Live API
can handle the function calling similar to the Python SDK.

### Python

    # Light control schemas
    turn_on_the_lights_schema = {'name': 'turn_on_the_lights'}
    turn_off_the_lights_schema = {'name': 'turn_off_the_lights'}

    prompt = """
      Hey, can you write run some python code to turn on the lights, wait 10s and then turn off the lights?
      """

    tools = [
        {'code_execution': {}},
        {'function_declarations': [turn_on_the_lights_schema, turn_off_the_lights_schema]}
    ]

    await run(prompt, tools=tools, modality="AUDIO")

### JavaScript

    // Light control schemas
    const turnOnTheLightsSchema = { name: 'turn_on_the_lights' };
    const turnOffTheLightsSchema = { name: 'turn_off_the_lights' };

    const prompt = `
      Hey, can you write run some python code to turn on the lights, wait 10s and then turn off the lights?
    `;

    const tools = [
      { codeExecution: {} },
      { functionDeclarations: [turnOnTheLightsSchema, turnOffTheLightsSchema] }
    ];

    await run(prompt, tools=tools, modality="AUDIO")

## Function calling modes

The Gemini API lets you control how the model uses the provided tools
(function declarations). Specifically, you can set the mode within
the.`function_calling_config`.

- `VALIDATED`: Default mode for tool combination (when built-in tools or structured outputs also enabled). The model is constrained to predict either function calls or natural language, and ensures function schema adherence. If `allowed_function_names` is not provided, the model picks from all of the available function declarations. If `allowed_function_names` is provided, the model picks from the set of allowed functions. This mode reduces malformed function calls (compared to `AUTO` mode).
- `AUTO`: Default mode when only function_declarations tool enabled. The model decides whether to generate a natural language response or suggest a function call based on the prompt and context.
- `ANY`: The model is constrained to always predict a function call and ensures function schema adherence. If `allowed_function_names` is not specified, the model can choose from any of the provided function declarations. If `allowed_function_names` is provided as a list, the model can only choose from the functions in that list. Use this mode when you require a function call response to every prompt (if applicable).
- `NONE`: The model is *prohibited* from making function calls. This is
  equivalent to sending a request without any function declarations. Use this to
  temporarily disable function calling without removing your tool definitions.

### Python

    from google.genai import types

    # Configure function calling mode
    tool_config = types.ToolConfig(
        function_calling_config=types.FunctionCallingConfig(
            mode="ANY", allowed_function_names=["get_current_temperature"]
        )
    )

    # Create the generation config
    config = types.GenerateContentConfig(
        tools=[tools],  # not defined here.
        tool_config=tool_config,
    )

### JavaScript

    import { FunctionCallingConfigMode } from '@google/genai';

    // Configure function calling mode
    const toolConfig = {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: ['get_current_temperature']
      }
    };

    // Create the generation config
    const config = {
      tools: tools, // not defined here.
      toolConfig: toolConfig,
    };

## Automatic function calling (Python only)

When using the Python SDK, you can provide Python functions directly as tools.
The SDK converts these functions into declarations, manages the function call
execution, and handles the response cycle for you. Define your function with
type hints and a docstring. For optimal results, it is recommended to use
[Google-style docstrings.](https://google.github.io/styleguide/pyguide.html#383-functions-and-methods)
The SDK will then automatically:

1. Detect function call responses from the model.
2. Call the corresponding Python function in your code.
3. Send the function's response back to the model.
4. Return the model's final text response.

The SDK currently doesn't parse argument descriptions into the property
description slots of the generated function declaration. Instead, it sends the
entire docstring as the top-level function description.

### Python

    from google import genai
    from google.genai import types

    # Define the function with type hints and docstring
    def get_current_temperature(location: str) -> dict:
        """Gets the current temperature for a given location.

        Args:
            location: The city and state, e.g. San Francisco, CA

        Returns:
            A dictionary containing the temperature and unit.
        """
        # ... (implementation) ...
        return {"temperature": 25, "unit": "Celsius"}

    # Configure the client
    client = genai.Client()
    config = types.GenerateContentConfig(
        tools=[get_current_temperature]
    )  # Pass the function itself

    # Make the request
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="What's the temperature in Boston?",
        config=config,
    )

    print(response.text)  # The SDK handles the function call and returns the final text

You can disable automatic function calling with:

### Python

    config = types.GenerateContentConfig(
        tools=[get_current_temperature],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
    )

### Automatic function schema declaration

The API is able to describe any of the following types. `Pydantic` types are
allowed, as long as the fields defined on them are also composed of allowed
types. Dict types (like `dict[str: int]`) are not well supported here, don't
use them.

### Python

    AllowedType = (
      int | float | bool | str | list['AllowedType'] | pydantic.BaseModel)

To see what the inferred schema looks like, you can convert it using
[`from_callable`](https://googleapis.github.io/python-genai/genai.html#genai.types.FunctionDeclaration.from_callable):

### Python

    from google import genai
    from google.genai import types

    def multiply(a: float, b: float):
        """Returns a * b."""
        return a * b

    client = genai.Client()
    fn_decl = types.FunctionDeclaration.from_callable(callable=multiply, client=client)

    # to_json_dict() provides a clean JSON representation.
    print(fn_decl.to_json_dict())

## Multi-tool use: Combine built-in tools with function calling

You can enable multiple tools, combining built-in tools with function calling in
the same request.

Gemini 3 models can combine built-in tools with function calling out-of-the-box,
thanks to the tool context circulation feature. Read the page on
[Combining built-in tools and function calling](https://ai.google.dev/gemini-api/docs/tool-combination) to learn more.

> [!WARNING]
> **Preview:** Combining built-in tools with function calling and tool context circulation features are in Preview in Gemini 3 models.

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    getWeather = {
        "name": "getWeather",
        "description": "Gets the weather for a requested city.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "The city and state, e.g. Utqiaġvik, Alaska",
                },
            },
            "required": ["city"],
        },
    }

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="What is the northernmost city in the United States? What's the weather like there today?",
        config=types.GenerateContentConfig(
          tools=[
            types.Tool(
              google_search=types.ToolGoogleSearch(),  # Built-in tool
              function_declarations=[getWeather]       # Custom tool
            ),
          ],
          include_server_side_tool_invocations=True
        ),
    )

    history = [
        types.Content(
            role="user",
            parts=[types.Part(text="What is the northernmost city in the United States? What's the weather like there today?")]
        ),
        response.candidates[0].content,
        types.Content(
            role="user",
            parts=[types.Part(
                function_response=types.FunctionResponse(
                    name="getWeather",
                    response={"response": "Very cold. 22 degrees Fahrenheit."},
                    id=response.candidates[0].content.parts[2].function_call.id
                )
            )]
        )
    ]

    response_2 = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=history,
        config=types.GenerateContentConfig(
          tools=[
            types.Tool(
              google_search=types.ToolGoogleSearch(),
              function_declarations=[getWeather]
            ),
          ],
          include_server_side_tool_invocations=True
        ),
    )

### Javascript

    import { GoogleGenAI, Type } from '@google/genai';

    const client = new GoogleGenAI({});

    const getWeather = {
        name: "getWeather",
        description: "Get the weather in a given location",
        parameters: {
            type: "OBJECT",
            properties: {
                location: {
                    type: "STRING",
                    description: "The city and state, e.g. San Francisco, CA"
                }
            },
            required: ["location"]
        }
    };

    async function run() {
        const model = client.models.generateContent({
            model: "gemini-3.5-flash",
        });

        const tools = [
          { googleSearch: {} },
          { functionDeclarations: [getWeather] }
        ];
        const toolConfig = { includeServerSideToolInvocations: true };

        const result1 = await model.generateContent({
            contents: [{role: "user", parts: [{text: "What is the northernmost city in the United States? What's the weather like there today?"}]}],
            tools: tools,
            toolConfig: toolConfig,
        });

        const response1 = result1.response;
        const functionCallId = response1.candidates[0].content.parts.find(p => p.functionCall)?.functionCall?.id;

        const history = [
            {
                role: "user",
                parts:[{text: "What is the northernmost city in the United States? What's the weather like there today?"}]
            },
            response1.candidates[0].content,
            {
                role: "user",
                parts: [{
                    functionResponse: {
                        name: "getWeather",
                        response: {response: "Very cold. 22 degrees Fahrenheit."},
                        id: functionCallId
                    }
                }]
            }
        ];

        const result2 = await model.generateContent({
            contents: history,
            tools: tools,
            toolConfig: toolConfig,
        });
    }

    run();

For models before the Gemini 3 series, use the
[Live API](https://ai.google.dev/gemini-api/docs/live-api/tools).

## Multimodal function responses

> [!NOTE]
> **Note:** This feature is available for [Gemini 3](https://ai.google.dev/gemini-api/docs/gemini-3) series models.

For Gemini 3 series models, you can include multimodal content in
the function response parts that you send to the model. The model can process
this multimodal content in its next turn to produce a more informed response.
The following MIME types are supported for multimodal content in function
responses:

- **Images** : `image/png`, `image/jpeg`, `image/webp`
- **Documents** : `application/pdf`, `text/plain`

To include multimodal data in a function response, include it as one or more
parts nested within the `functionResponse` part. Each multimodal part must
contain `inlineData`. If you reference a multimodal part from
within the structured `response` field, it must contain a unique `displayName`.

You can also reference a multimodal part from within the structured `response`
field of the `functionResponse` part by using the JSON reference format
`{"$ref": "<displayName>"}`. The model substitutes the reference with the
multimodal content when processing the response. Each `displayName` can only be
referenced once in the structured `response` field.

The following example shows a message containing a `functionResponse` for a
function named `get_image` and a nested part containing image data with
`displayName: "instrument.jpg"`. The `functionResponse`'s `response` field
references this image part:

### Python

    from google import genai
    from google.genai import types

    import requests

    client = genai.Client()

    # This is a manual, two turn multimodal function calling workflow:

    # 1. Define the function tool
    get_image_declaration = types.FunctionDeclaration(
      name="get_image",
      description="Retrieves the image file reference for a specific order item.",
      parameters={
          "type": "object",
          "properties": {
              "item_name": {
                  "type": "string",
                  "description": "The name or description of the item ordered (e.g., 'instrument')."
              }
          },
          "required": ["item_name"],
      },
    )
    tool_config = types.Tool(function_declarations=[get_image_declaration])

    # 2. Send a message that triggers the tool
    prompt = "Show me the instrument I ordered last month."
    response_1 = client.models.generate_content(
      model="gemini-3.5-flash",
      contents=[prompt],
      config=types.GenerateContentConfig(
          tools=[tool_config],
      )
    )

    # 3. Handle the function call
    function_call = response_1.function_calls[0]
    requested_item = function_call.args["item_name"]
    print(f"Model wants to call: {function_call.name}")

    # Execute your tool (e.g., call an API)
    # (This is a mock response for the example)
    print(f"Calling external tool for: {requested_item}")

    function_response_data = {
      "image_ref": {"$ref": "instrument.jpg"},
    }
    image_path = "https://goo.gle/instrument-img"
    image_bytes = requests.get(image_path).content
    function_response_multimodal_data = types.FunctionResponsePart(
      inline_data=types.FunctionResponseBlob(
        mime_type="image/jpeg",
        display_name="instrument.jpg",
        data=image_bytes,
      )
    )

    # 4. Send the tool's result back
    # Append this turn's messages to history for a final response.
    history = [
      types.Content(role="user", parts=[types.Part(text=prompt)]),
      response_1.candidates[0].content,
      types.Content(
        role="user",
        parts=[
            types.Part.from_function_response(
              id=function_call.id,
              name=function_call.name,
              response=function_response_data,
              parts=[function_response_multimodal_data]
            )
        ],
      )
    ]

    response_2 = client.models.generate_content(
      model="gemini-3.5-flash",
      contents=history,
      config=types.GenerateContentConfig(
          tools=[tool_config],
          thinking_config=types.ThinkingConfig(include_thoughts=True)
      ),
    )

    print(f"\nFinal model response: {response_2.text}")

### JavaScript

    import { GoogleGenAI, Type } from '@google/genai';

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // This is a manual, two turn multimodal function calling workflow:
    // 1. Define the function tool
    const getImageDeclaration = {
      name: 'get_image',
      description: 'Retrieves the image file reference for a specific order item.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          item_name: {
            type: Type.STRING,
            description: "The name or description of the item ordered (e.g., 'instrument').",
          },
        },
        required: ['item_name'],
      },
    };

    const toolConfig = {
      functionDeclarations: [getImageDeclaration],
    };

    // 2. Send a message that triggers the tool
    const prompt = 'Show me the instrument I ordered last month.';
    const response1 = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [toolConfig],
      },
    });

    // 3. Handle the function call
    const functionCall = response1.functionCalls[0];
    const requestedItem = functionCall.args.item_name;
    console.log(`Model wants to call: ${functionCall.name}`);

    // Execute your tool (e.g., call an API)
    // (This is a mock response for the example)
    console.log(`Calling external tool for: ${requestedItem}`);

    const functionResponseData = {
      image_ref: { $ref: 'instrument.jpg' },
    };

    const imageUrl = "https://goo.gle/instrument-img";
    const response = await fetch(imageUrl);
    const imageArrayBuffer = await response.arrayBuffer();
    const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');

    const functionResponseMultimodalData = {
      inlineData: {
        mimeType: 'image/jpeg',
        displayName: 'instrument.jpg',
        data: base64ImageData,
      },
    };

    // 4. Send the tool's result back
    // Append this turn's messages to history for a final response.
    const history = [
      { role: 'user', parts: [{ text: prompt }] },
      response1.candidates[0].content,
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: functionCall.id,
              name: functionCall.name,
              response: functionResponseData,
              parts: [functionResponseMultimodalData]
            },
          },
        ],
      },
    ];

    const response2 = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: history,
      config: {
        tools: [toolConfig],
        thinkingConfig: { includeThoughts: true },
      },
    });

    console.log(`\nFinal model response: ${response2.text}`);

### REST

    IMG_URL="https://goo.gle/instrument-img"

    MIME_TYPE=$(curl -sIL "$IMG_URL" | grep -i '^content-type:' | awk -F ': ' '{print $2}' | sed 's/\r$//' | head -n 1)
    if [[ -z "$MIME_TYPE" || ! "$MIME_TYPE" == image/* ]]; then
      MIME_TYPE="image/jpeg"
    fi

    # Check for macOS
    if [[ "$(uname)" == "Darwin" ]]; then
      IMAGE_B64=$(curl -sL "$IMG_URL" | base64 -b 0)
    elif [[ "$(base64 --version 2>&1)" = *"FreeBSD"* ]]; then
      IMAGE_B64=$(curl -sL "$IMG_URL" | base64)
    else
      IMAGE_B64=$(curl -sL "$IMG_URL" | base64 -w0)
    fi

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          ...,
          {
            "role": "user",
            "parts": [
            {
                "functionResponse": {
                  "name": "get_image",
                  "id": "UNIQUE_CALL_ID_HERE",
                  "response": {
                    "image_ref": {
                      "$ref": "instrument.jpg"
                    }
                  },
                  "parts": [
                    {
                      "inlineData": {
                        "displayName": "instrument.jpg",
                        "mimeType":"'"$MIME_TYPE"'",
                        "data": "'"$IMAGE_B64"'"
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      }'

## Function calling with Structured output

> [!NOTE]
> **Note:** This feature is available for [Gemini 3](https://ai.google.dev/gemini-api/docs/gemini-3) series models.

For Gemini 3 series models, you can use function calling with
[structured output](https://ai.google.dev/gemini-api/docs/structured-output). This lets the model
predict function calls or outputs that adhere to a specific schema. As a result,
you receive consistently formatted responses when the model doesn't generate
function calls.

## Model context protocol (MCP)

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) is
an open standard for connecting AI applications with external tools and data.
MCP provides a common protocol for models to access context, such as functions
(tools), data sources (resources), or predefined prompts.

The Gemini SDKs have built-in support for the MCP, reducing boilerplate code and
offering
[automatic tool calling](https://ai.google.dev/gemini-api/docs/function-calling#automatic_function_calling_python_only)
for MCP tools. When the model generates an MCP tool call, the Python and
JavaScript client SDK can automatically execute the MCP tool and send the
response back to the model in a subsequent request, continuing this loop until
no more tool calls are made by the model.

Here, you can find an example of how to use a local MCP server with Gemini and
`mcp` SDK.

### Python

Make sure the latest version of the
[`mcp` SDK](https://modelcontextprotocol.io/introduction) is installed on
your platform of choice.

    pip install mcp

> [!NOTE]
> **Note:** Python supports automatic tool calling by passing in the `ClientSession` into the `tools` parameters. If you want to disable it, you can provide `automatic_function_calling` with disabled `True`.

    import os
    import asyncio
    from datetime import datetime
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    from google import genai

    client = genai.Client()

    # Create server parameters for stdio connection
    server_params = StdioServerParameters(
        command="npx",  # Executable
        args=["-y", "@philschmid/weather-mcp"],  # MCP Server
        env=None,  # Optional environment variables
    )

    async def run():
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                # Prompt to get the weather for the current day in London.
                prompt = f"What is the weather in London in {datetime.now().strftime('%Y-%m-%d')}?"

                # Initialize the connection between client and server
                await session.initialize()

                # Send request to the model with MCP function declarations
                response = await client.aio.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=prompt,
                    config=genai.types.GenerateContentConfig(
                        temperature=0,
                        tools=[session],  # uses the session, will automatically call the tool
                        # Uncomment if you **don't** want the SDK to automatically call the tool
                        # automatic_function_calling=genai.types.AutomaticFunctionCallingConfig(
                        #     disable=True
                        # ),
                    ),
                )
                print(response.text)

    # Start the asyncio event loop and run the main function
    asyncio.run(run())

### JavaScript

Make sure the latest version of the `mcp` SDK is installed on your platform
of choice.

    npm install @modelcontextprotocol/sdk

> [!NOTE]
> **Note:** JavaScript supports automatic tool calling by wrapping the `client` with `mcpToTool`. If you want to disable it, you can provide `automaticFunctionCalling` with disabled `true`.

    import { GoogleGenAI, FunctionCallingConfigMode , mcpToTool} from '@google/genai';
    import { Client } from "@modelcontextprotocol/sdk/client/index.js";
    import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

    // Create server parameters for stdio connection
    const serverParams = new StdioClientTransport({
      command: "npx", // Executable
      args: ["-y", "@philschmid/weather-mcp"] // MCP Server
    });

    const client = new Client(
      {
        name: "example-client",
        version: "1.0.0"
      }
    );

    // Configure the client
    const ai = new GoogleGenAI({});

    // Initialize the connection between client and server
    await client.connect(serverParams);

    // Send request to the model with MCP tools
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `What is the weather in London in ${new Date().toLocaleDateString()}?`,
      config: {
        tools: [mcpToTool(client)],  // uses the session, will automatically call the tool
        // Uncomment if you **don't** want the sdk to automatically call the tool
        // automaticFunctionCalling: {
        //   disable: true,
        // },
      },
    });
    console.log(response.text)

    // Close the connection
    await client.close();

### Limitations with built-in MCP support

Built-in MCP support is a [experimental](https://ai.google.dev/gemini-api/docs/models#preview)
feature in our SDKs and has the following limitations:

- Only tools are supported, not resources nor prompts
- It is available for the Python and JavaScript/TypeScript SDK.
- Breaking changes might occur in future releases.

Manual integration of MCP servers is always an option if these limit what you're
building.

## Supported models

This section lists models and their function calling capabilities. Experimental
models are not included. You can find a comprehensive capabilities overview on
the [model overview](https://ai.google.dev/gemini-api/docs/models) page.

| Model | Function calling | Parallel function calling | Compositional function calling |
|---|---|---|---|
| [Gemini 3.1 Pro Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview) | ✔️ | ✔️ | ✔️ |
| [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) | ✔️ | ✔️ | ✔️ |
| [Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash) | ✔️ | ✔️ | ✔️ |
| [Gemini 2.5 Pro](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-pro) | ✔️ | ✔️ | ✔️ |
| [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) | ✔️ | ✔️ | ✔️ |
| [Gemini 2.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite) | ✔️ | ✔️ | ✔️ |

## Best practices

- **Function and Parameter Descriptions:** Be extremely clear and specific in your descriptions. The model relies on these to choose the correct function and provide appropriate arguments.
- **Naming:** Use descriptive function names (without spaces, periods, or dashes).
- **Strong Typing:** Use specific types (integer, string, enum) for parameters to reduce errors. If a parameter has a limited set of valid values, use an enum.
- **Tool Selection:** While the model can use an arbitrary number of tools, providing too many can increase the risk of selecting an incorrect or suboptimal tool. For best results, aim to provide only the relevant tools for the context or task, ideally keeping the active set to a maximum of 10-20. Consider dynamic tool selection based on conversation context if you have a large total number of tools.
- **Prompt Engineering:**
  - Provide context: Tell the model its role (e.g., "You are a helpful weather assistant.").
  - Give instructions: Specify how and when to use functions (e.g., "Don't guess dates; always use a future date for forecasts.").
  - Encourage clarification: Instruct the model to ask clarifying questions if needed.
  - See [Agentic workflows](https://ai.google.dev/gemini-api/docs/prompting-strategies#agentic-workflows) for further strategies on designing these prompts. Here is an example of a tested [system instruction](https://ai.google.dev/gemini-api/docs/prompting-strategies#agentic-si-template).
- **Temperature:** Use a low temperature (e.g., 0) for more deterministic and
  reliable function calls.

  > [!NOTE]
  > When using Gemini 3 models, we strongly recommend keeping the `temperature` at its default value of 1.0. Changing the temperature (setting it below 1.0) may lead to unexpected behavior, such as looping or degraded performance, particularly in complex mathematical or reasoning tasks.

- **Validation:** If a function call has significant consequences (e.g.,
  placing an order), validate the call with the user before executing it.

- **Check Finish Reason:** Always check the [`finishReason`](https://ai.google.dev/api/generate-content#FinishReason)
  in the model's response to handle cases where the model failed to generate a
  valid function call.

- **Error Handling**: Implement robust error handling in your functions to
  gracefully handle unexpected inputs or API failures. Return informative
  error messages that the model can use to generate helpful responses to the
  user.

- **Security:** Be mindful of security when calling external APIs. Use
  appropriate authentication and authorization mechanisms. Avoid exposing
  sensitive data in function calls.

- **Token Limits:** Function descriptions and parameters count towards your
  input token limit. If you're hitting token limits, consider limiting the
  number of functions or the length of the descriptions, break down complex
  tasks into smaller, more focused function sets.

- **Mix of bash and custom tools** For those building with a mix of bash and
  custom tools, Gemini 3.1 Pro Preview
  comes with a separate endpoint available via the API called
  [`gemini-3.1-pro-preview-customtools`](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview#gemini-31-pro-preview-customtools).

## Notes and limitations

- Positioning of function call parts: When using custom function declarations [alongside built-in tools](https://ai.google.dev/gemini-api/docs/tool-combination) (like Google Search), the model may return a mix of `functionCall`, `toolCall`, and `toolResponse` parts in a single turn. Because of this, don't assume the `functionCall` will always be the last item in the parts array. If you are manually parsing the JSON response, always iterate through the parts array rather than relying on position.
- Only a [subset of the OpenAPI
  schema](https://ai.google.dev/api/caching#FunctionDeclaration) is supported.
- For `ANY` mode, the API may reject very large or deeply nested schemas. If you encounter errors, try simplifying your function parameter and response schemas by shortening property names, reducing nesting, or limiting the number of function declarations.
- Supported parameter types in Python are limited.
- Automatic function calling is a Python SDK feature only.

# Streaming interactions

When creating an Interaction, you can set `stream: true` to incrementally stream the response using [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) (SSE).

### Python

    from google import genai

    client = genai.Client()

    stream = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Count to from 1 to 25.",
        stream=True,
    )
    for event in stream:
        if event.event_type == "step.delta":
            if event.delta.type == "text":
                print(event.delta.text, end="", flush=True)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const client = new GoogleGenAI({});

    const stream = await client.interactions.create({
        model: "gemini-3-flash-preview",
        input: "Count to from 1 to 25.",
        stream: true,
    });
    for await (const event of stream) {
        if (event.event_type === "step.delta") {
            if (event.delta.type === "text") {
                process.stdout.write(event.delta.text);
            }
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \
      --no-buffer \
      -d '{
        "model": "gemini-3-flash-preview",
        "input": "Count to from 1 to 25.",
        "stream": true
      }'

    event: interaction.created
    data: {"interaction":{"id":"v1_...","status":"in_progress","object":"interaction","model":"gemini-3-flash-preview"},"event_type":"interaction.created"}

    event: interaction.status_update
    data: {"interaction_id":"v1_...","status":"in_progress","event_type":"interaction.status_update"}

    event: step.start
    data: {"index":0,"step":{"type":"thought"},"event_type":"step.start"}

    event: step.delta
    data: {"index":0,"delta":{"signature":"...","type":"thought_signature"},"event_type":"step.delta"}

    event: step.stop
    data: {"index":0,"event_type":"step.stop"}

    event: step.start
    data: {"index":1,"step":{"type":"model_output"},"event_type":"step.start"}

    event: step.delta
    data: {"index":1,"delta":{"text":"1, 2, 3, 4, 5, 6, ","type":"text"},"event_type":"step.delta"}

    event: step.delta
    data: {"index":1,"delta":{"text":"7, 8, 9, 10, 11, 12, 13,","type":"text"},"event_type":"step.delta"}

    ...

    event: step.stop
    data: {"index":1,"event_type":"step.stop"}

    event: interaction.completed
    data: {"interaction":{"id":"v1_...","status":"completed","usage":{"total_tokens":346,"total_input_tokens":11,"input_tokens_by_modality":[{"modality":"text","tokens":11}],"total_cached_tokens":0,"total_output_tokens":90,"total_tool_use_tokens":0,"total_thought_tokens":245},"created":"2026-05-12T18:44:51Z","updated":"2026-05-12T18:44:51Z","service_tier":"standard","object":"interaction","model":"gemini-3-flash-preview"},"event_type":"interaction.completed"}

    event: done
    data: [DONE]

## Event types

Each server-sent event includes a named `event_type` and associated JSON data. The Interactions API uses a symmetric streaming model where all content---text, tool calls, thinking---flows through a consistent **step-based** event.

Each stream follows this event flow:

1. `interaction.created`: The interaction is created, includes metadata (ID, model, status).
2. A series of **steps** , each consisting of:
   - A `step.start` event, indicating the step type (e.g., `model_output`, `thought`, `function_call`).
   - One or more `step.delta` events with incremental data for that step.
   - A `step.stop` event marking the step as complete.
3. An `interaction.completed` event with final `usage` statistics.

When you set `stream: false`, the API returns a single `interaction` object with a `steps` array. Each element in `steps` is the fully assembled version of one `step.start` → `step.delta`(s) → `step.stop` cycle.

### `interaction.created`

Sent when the interaction is first created. Contains the interaction ID, model, and initial status.

    event: interaction.created
    data: {"interaction": {"id": "...", "model": "gemini-3-flash-preview", "status": "in_progress", "object": "interaction"}, "event_type": "interaction.created"}

### `interaction.status_update`

Signals an interaction-level status transition. May appear between steps.

    event: interaction.status_update
    data: {"interaction_id": "...", "status": "in_progress", "event_type": "interaction.status_update"}

### `step.start`

Marks the beginning of a new step. Contains the step `type` and `index`. The step type determines which delta types to expect and how the step appears in a non-streaming response:

| Step Type | Expected Delta Types | Description |
|---|---|---|
| `model_output` | `text`, `image`, `audio` | The model's final response content. |
| `thought` | `thought_signature`, `thought_summary` | Chain-of-thought reasoning. `summary` is only present when `thinking_summaries` is enabled. |
| `function_call` | `arguments_delta` | A request for the client to execute a function. Sets interaction status to `requires_action`. |
| Server-side tools | Varies by tool | Tools executed by the API (e.g., `google_search_call`, `google_search_result`, `code_execution_call`, `code_execution_result`). |

See the [Interactions API reference](https://ai.google.dev/api/interactions) for the full list.

    event: step.start
    data: {"index": 0, "step": {"type": "model_output"}, "event_type": "step.start"}

For function calls, the step includes the function name, id and empty arguments `{}`

    event: step.start
    data: {"index": 0, "step": {"type": "function_call", "id":"un6k8t18", "name": "get_weather", "arguments":{}}, "event_type": "step.start"}

### `step.delta`

Incremental data for the current step. The `delta` object contains a `type` field that determines its shape.

**Examples:**

**`text`:** Incremental text token from a `model_output` step:

    event: step.delta
    data: {"index": 0, "delta": {"type": "text", "text": "Hello, my name is Phil"}, "event_type": "step.delta"}

    event: step.delta
    data: {"index": 0, "delta": {"type": "text", "text": ", and I live in Germany." }, "event_type": "step.delta"}

**`image`:** Base64-encoded image data from a `model_output` step:

    event: step.delta
    data: {"index": 0, "delta": {"type": "image", "mime_type": "image/jpeg", "data": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCg..."}, "event_type": "step.delta"}

**`thought_summary`:** Thinking summary content from a `thought` step:

    event: step.delta
    data: {"index": 0, "delta": {"type": "thought_summary", "content": {"type": "text", "text": "I need to find the GCD..."}}, "event_type": "step.delta"}

**`arguments_delta`:** (Partial) JSON string for function call arguments. Must be accumulated across deltas:

    event: step.delta
    data: {"index": 0, "delta": {"type": "arguments_delta", "arguments": "{\"location\": \"San Francisco, CA\"}"}, "event_type": "step.delta"}

These are some of the most common delta types. For the complete list of all delta types, see the [Interactions API reference](https://ai.google.dev/api/interactions).

### `step.stop`

Marks the end of a step. Contains the step `index`.

    event: step.stop
    data: {"index": 0, "event_type": "step.stop"}

### `interaction.completed`

Sent when the interaction is finished. Contains the final interaction object with `usage` statistics. In non-streaming mode, this is the top-level response object itself. Does not include `steps` in the response.

    event: interaction.completed
    data: {"interaction": {"id": "v1_abc123", "status": "completed", "usage": {"total_input_tokens": 7, "total_output_tokens": 12, "total_tokens": 19}}, "event_type": "interaction.completed"}

### `error`

Sent when an error occurs during the interaction. Contains an error object with a message and code.

    event: error
    data: {"error":{"message":"Deadline expired before operation could complete.","code":"gateway_timeout"},"event_type":"error"}

## Streaming with tools

The Interactions API supports streaming with both client-side tools (function calling) and server-side tools (Google Search, Code Execution, etc.) in a single request. During streaming, tool invocations appear as typed steps in the event stream. For function calls, the `step.start` event delivers the function name, and `step.delta` events stream the arguments as JSON strings (`arguments_delta`). You must accumulate these deltas to get the full arguments. Server-side tools like Google Search are executed automatically by the API, producing `google_search_call` and `google_search_result` steps.

### Streaming with function calling

To perform function calling with streaming, the client must handle a multi-turn conversation:

1. **Turn 1 (Function Request):** Call `interactions.create` with `stream: true` and your defined `tools`. The API will stream a `function_call` step. You must accumulate the incremental argument JSON strings (`arguments_delta`) from `step.delta` events until the interaction completes with the status `requires_action`.
2. **Turn 2 (Sending Result):** Call `interactions.create` again, passing the `previous_interaction_id` (matching the ID of the first interaction) and sending a `function_result` block within the `input` array. This resumes the stream, allowing the model to generate its final response.

### Python

    from google import genai

    client = genai.Client()

    weather_tool = {
        "type": "function",
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA"
                }
            },
            "required": ["location"]
        }
    }

    # Turn 1: Request function call
    stream = client.interactions.create(
        model="gemini-3-flash-preview",
        tools=[weather_tool],
        input="What is the weather in Paris right now?",
        stream=True,
    )

    first_interaction_id = None
    func_call_id = None
    func_call_name = None
    func_args_accumulated = ""

    for event in stream:
        if event.event_type == "interaction.created":
            first_interaction_id = event.interaction.id
        elif event.event_type == "step.start":
            step = event.step
            if step.type == "function_call":
                func_call_id = step.id
                func_call_name = step.name
        elif event.event_type == "step.delta":
            if event.delta.type == "arguments_delta":
                func_args_accumulated += event.delta.arguments

    # Turn 2: Execute tool and send the result back to resume stream
    if func_call_id:
        # Execute weather_tool using accumulated arguments
        # args = json.loads(func_args_accumulated)
        dummy_result = {
            "content": [{"type": "text", "text": '{"weather": "Sunny and 22°C"}'}]
        }

        stream2 = client.interactions.create(
            model="gemini-3-flash-preview",
            previous_interaction_id=first_interaction_id,
            input=[{
                "type": "function_result",
                "name": func_call_name,
                "call_id": func_call_id,
                "result": dummy_result
            }],
            stream=True,
        )

        for event in stream2:
            if event.event_type == "step.delta":
                if event.delta.type == "text":
                    print(event.delta.text, end="", flush=True)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const client = new GoogleGenAI({});

    const weatherTool = {
        type: "function",
        name: "get_weather",
        description: "Get the current weather in a given location",
        parameters: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "The city and state, e.g. San Francisco, CA"
                }
            },
            required: ["location"]
        }
    };

    // Turn 1: Request function call
    const stream = await client.interactions.create({
        model: "gemini-3-flash-preview",
        tools: [weatherTool],
        input: "What is the weather in Paris right now?",
        stream: true,
    });

    let firstInteractionId = null;
    let funcCallId = null;
    let funcCallName = null;
    let funcArgsAccumulated = "";

    for await (const event of stream) {
        if (event.event_type === "interaction.created") {
            firstInteractionId = event.interaction.id;
        } else if (event.event_type === "step.start") {
            const step = event.step;
            if (step.type === "function_call") {
                funcCallId = step.id;
                funcCallName = step.name;
            }
        } else if (event.event_type === "step.delta") {
            if (event.delta.type === "arguments_delta") {
                funcArgsAccumulated += event.delta.arguments;
            }
        }
    }

    // Turn 2: Execute tool and send the result back to resume stream
    if (funcCallId && firstInteractionId && funcCallName) {
        // const args = JSON.parse(funcArgsAccumulated);
        const dummyResult = {
            content: [{ type: "text", text: '{"weather": "Sunny and 22°C"}' }]
        };

        const stream2 = await client.interactions.create({
            model: "gemini-3-flash-preview",
            previous_interaction_id: firstInteractionId,
            input: [{
                type: "function_result",
                name: funcCallName,
                call_id: funcCallId,
                result: dummyResult
            }],
            stream: true,
        });

        for await (const event of stream2) {
            if (event.event_type === "step.delta") {
                if (event.delta.type === "text") {
                    process.stdout.write(event.delta.text);
                }
            }
        }
    }

### REST

**Turn 1:** Request function call

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \
      --no-buffer \
      -d '{
        "model": "gemini-3-flash-preview",
        "input": "What is the weather in Paris right now?",
        "stream": true,
        "tools": [
          {
            "type": "function",
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
              "type": "object",
              "properties": {
                "location": {
                  "type": "string",
                  "description": "The city and state, e.g. San Francisco, CA"
                }
              },
              "required": ["location"]
            }
          }
        ]
      }'

**Turn 2:** Send the function result using the `previous_interaction_id` and `call_id` from Turn 1

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \
      --no-buffer \
      -d '{
        "model": "gemini-3-flash-preview",
        "previous_interaction_id": "v1_ChdGUVFJYXBXVUdLVEF4TjhQ...",
        "stream": true,
        "input": [
          {
            "type": "function_result",
            "name": "get_weather",
            "call_id": "CALL_ID",
            "result": {
              "content": [
                {
                  "type": "text",
                  "text": "{\"weather\": \"Sunny and 22°C\"}"
                }
              ]
            }
          }
        ]
      }'

### Streaming with multiple tools

The following example uses both a `function` tool and `google_search` in one request:

### Python

    from google import genai

    client = genai.Client()

    tools = [
        {"type": "google_search"},
        {
            "type": "function",
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    }
                },
                "required": ["location"]
            }
        }
    ]

    stream = client.interactions.create(
        model="gemini-3-flash-preview",
        tools=tools,
        input="Search what it the largest mountain in Europe and what the weather is there right now?",
        stream=True,
    )
    for event in stream:
        if event.event_type == "step.start":
            step = event.step
            print(f"\n--- Step {event.index}: {step.type} ---")
            # Show details for tool steps
            if step.type == "google_search_call":
                print(f"  Search ID: {step.id}")
            elif step.type == "google_search_result":
                print(f"  Result for: {step.call_id}")
            elif step.type == "function_call":
                print(f"  Function: {step.name}({step.arguments})")
        elif event.event_type == "step.delta":
            if event.delta.type == "text":
                print(event.delta.text, end="", flush=True)
            elif event.delta.type == "google_search_call":
                print(f"  Queries: {event.delta.arguments}")
            elif event.delta.type == "arguments_delta":
                print(f"  Args chunk: {event.delta.arguments}", end="", flush=True)
        elif event.event_type == "interaction.completed":
            print(f"\n\nStatus: {event.interaction.status}")
            if event.interaction.status == "requires_action":
                print("Action required: provide function call results to continue.")

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const client = new GoogleGenAI({});

    const tools = [
        { type: "google_search" },
        {
            type: "function",
            name: "get_weather",
            description: "Get the current weather in a given location",
            parameters: {
                type: "object",
                properties: {
                    location: {
                        type: "string",
                        description: "The city and state, e.g. San Francisco, CA"
                    }
                },
                required: ["location"]
            }
        }
    ];

    const stream = await client.interactions.create({
        model: "gemini-3-flash-preview",
        tools: tools,
        input: "Search what it the largest mountain in Europe and what the weather is there right now?",
        stream: true,
    });
    for await (const event of stream) {
        if (event.event_type === "step.start") {
            const step = event.step;
            console.log(`\n--- Step ${event.index}: ${step.type} ---`);
            // Show details for tool steps
            if (step.type === "google_search_call") {
                console.log(`  Search ID: ${step.id}`);
            } else if (step.type === "google_search_result") {
                console.log(`  Result for: ${step.call_id}`);
            } else if (step.type === "function_call") {
                console.log(`  Function: ${step.name}(${JSON.stringify(step.arguments)})`);
            }
        } else if (event.event_type === "step.delta") {
            if (event.delta.type === "text") {
                process.stdout.write(event.delta.text);
            } else if (event.delta.type === "google_search_call") {
                console.log(`  Queries: ${JSON.stringify(event.delta.arguments?.queries)}`);
            } else if (event.step.type === "google_search_result") {
                console.log(`  Result for: ${event.step.call_id}`);
            } else if (event.delta.type === "arguments_delta") {
                process.stdout.write(`  Args chunk: ${event.delta.arguments}`);
            }
        } else if (event.event_type === "interaction.completed") {
            console.log(`\n\nStatus: ${event.interaction.status}`);
            if (event.interaction.status === "requires_action") {
                console.log("Action required: provide function call results to continue.");
            }
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \
      --no-buffer \
      -d '{
        "model": "gemini-3-flash-preview",
        "input": "Search what it the largest mountain in Europe and what the weather is there right now?",
        "stream": true,
        "tools": [
          { "type": "google_search" },
          {
            "type": "function",
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
              "type": "object",
              "properties": {
                "location": {
                  "type": "string",
                  "description": "The city and state, e.g. San Francisco, CA"
                }
              },
              "required": ["location"]
            }
          }
        ]
      }'

    event: interaction.created
    data: {"interaction":{"id":"v1_...","status":"in_progress","object":"interaction","model":"gemini-3-flash-preview"},"event_type":"interaction.created"}

    event: interaction.status_update
    data: {"interaction_id":"v1_...","status":"in_progress","event_type":"interaction.status_update"}

    event: step.start
    data: {"index":0,"step":{"id":"mkutnkgn","signature":"","type":"google_search_call"},"event_type":"step.start"}

    event: step.delta
    data: {"index":0,"delta":{"signature":"...","type":"google_search_call","arguments":{"queries":["largest mountain in Europe"]}},"event_type":"step.delta"}

    event: step.stop
    data: {"index":0,"event_type":"step.stop"}

    event: step.start
    data: {"index":1,"step":{"call_id":"mkutnkgn","signature":"","type":"google_search_result"},"event_type":"step.start"}

    event: step.delta
    data: {"index":1,"delta":{"signature":"...","type":"google_search_result","is_error":false},"event_type":"step.delta"}

    event: step.stop
    data: {"index":1,"event_type":"step.stop"}

    event: step.start
    data: {"index":2,"step":{"type":"thought"},"event_type":"step.start"}

    event: step.delta
    data: {"index":2,"delta":{"signature":"...","type":"thought_signature"},"event_type":"step.delta"}

    event: step.stop
    data: {"index":2,"event_type":"step.stop"}

    event: step.start
    data: {"index":3,"step":{"id":"ktr5aysg","type":"function_call","name":"get_weather","arguments":{}},"event_type":"step.start"}

    event: step.delta
    data: {"index":3,"delta":{"arguments":"{\"location\":\"Mount Elbrus, Russia\"}","type":"arguments_delta"},"event_type":"step.delta"}

    event: step.stop
    data: {"index":3,"event_type":"step.stop"}

    event: interaction.completed
    data: {"interaction":{"id":"v1_...","status":"requires_action","usage":{"total_tokens":299,"total_input_tokens":138,"input_tokens_by_modality":[{"modality":"text","tokens":138}],"total_cached_tokens":0,"total_output_tokens":20,"total_tool_use_tokens":0,"total_thought_tokens":141},"created":"2026-05-12T17:24:26Z","updated":"2026-05-12T17:24:26Z","service_tier":"standard","object":"interaction","model":"gemini-3-flash-preview"},"event_type":"interaction.completed"}

    event: done
    data: [DONE]

## Streaming with thinking

When the model uses thinking, you'll receive `thought` steps with two distinct delta types: `thought_summary` (incremental text or image summary content) and `thought_signature` (an encrypted representation of the model's internal reasoning, sent as the last delta before `step.stop`). If `thinking_summaries` is enabled, `thought_summary` deltas stream a summary of the model's reasoning. For more details on thinking, see the [Thinking guide](https://ai.google.dev/gemini-api/docs/interactions/thinking).

### Python

    from google import genai

    client = genai.Client()

    stream = client.interactions.create(
        model="gemini-3-flash-preview",
        input="What is the greatest common divisor of 1071 and 462?",
        generation_config={
            "thinking_summaries": "auto"
        },
        stream=True,
    )
    for event in stream:
        if event.event_type == "step.start":
            print(f"\n--- Step: {event.step.type} ---")
        elif event.event_type == "step.delta":
            if event.delta.type == "thought_summary":
                if event.delta.content.type == "text":
                    print(event.delta.content.text, end="", flush=True)
            elif event.delta.type == "text":
                print(event.delta.text, end="", flush=True)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const client = new GoogleGenAI({});

    const stream = await client.interactions.create({
        model: "gemini-3-flash-preview",
        input: "What is the greatest common divisor of 1071 and 462?",
        generation_config: {
            thinking_summaries: "auto",
        },
        stream: true,
    });
    for await (const event of stream) {
        if (event.event_type === "step.start") {
            console.log(`\n--- Step: ${event.step.type} ---`);
        } else if (event.event_type === "step.delta") {
            if (event.delta.type === "thought_summary") {
                if (event.delta.content.type === "text") {
                    process.stdout.write(event.delta.content.text);
                }
            } else if (event.delta.type === "text") {
                process.stdout.write(event.delta.text);
            }
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \
      --no-buffer \
      -d '{
        "model": "gemini-3-flash-preview",
        "input": "What is the greatest common divisor of 1071 and 462?",
        "stream": true,
        "generation_config": {
          "thinking_summaries": "auto"
        }
      }'

    event: interaction.created
    data: {"interaction":{"id":"v1_...","status":"in_progress","object":"interaction","model":"gemini-3-flash-preview"},"event_type":"interaction.created"}

    event: interaction.status_update
    data: {"interaction_id":"v1_...","status":"in_progress","event_type":"interaction.status_update"}

    event: step.start
    data: {"index":0,"step":{"type":"thought"},"event_type":"step.start"}

    event: step.delta
    data: {"index":0,"delta":{"content":{"text":"**Implementing Euclidean Algorithm**\n\nI've just worked through a detailed example applying the Euclidean algorithm to find the GCD of 1071 and 462, confirming its step-by-step nature. The calculations went smoothly, tracking the remainders until zero. My focus is now solidifying the implementation logic, ensuring accuracy and considering potential edge cases. I'll translate this example into code.\n\n\n","type":"text"},"type":"thought_summary"},"event_type":"step.delta"}

    event: step.delta
    data: {"index":0,"delta":{"signature":"...","type":"thought_signature"},"event_type":"step.delta"}

    event: step.stop
    data: {"index":0,"event_type":"step.stop"}

    event: step.start
    data: {"index":1,"step":{"type":"model_output"},"event_type":"step.start"}

    ...

## Streaming with agents

The Interactions API supports agents like Deep Research. Agents use `background=True` and return results asynchronously, but you can also stream agent interactions to receive progress updates and intermediate steps as they happen. For more details, see the [Deep Research guide](https://ai.google.dev/gemini-api/docs/interactions/deep-research).

### Python

    from google import genai

    client = genai.Client()

    stream = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Research the latest advances in quantum computing.",
        stream=True,
        background=True,
        agent_config={
            "type": "deep-research",
            "thinking_summaries": "auto"
        }
    )
    for event in stream:
        if event.event_type == "step.start":
            print(f"\n--- Step: {event.step.type} ---")
        elif event.event_type == "step.delta":
            if event.delta.type == "text":
                print(event.delta.text, end="", flush=True)
            elif event.delta.type == "thought_summary":
                if event.delta.content.type == "text":
                    print(event.delta.content.text, end="", flush=True)
        elif event.event_type == "interaction.completed":
            print(f"\n\nTotal Tokens: {event.interaction.usage.total_tokens}")

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const client = new GoogleGenAI({});

    const stream = await client.interactions.create({
        agent: "deep-research-preview-04-2026",
        input: "Research the latest advances in quantum computing.",
        stream: true,
        background: true,
        agent_config: {
            type: "deep-research",
            thinking_summaries: "auto"
        }
    });
    for await (const event of stream) {
        if (event.event_type === "step.start") {
            console.log(`\n--- Step: ${event.step.type} ---`);
        } else if (event.event_type === "step.delta") {
            if (event.delta.type === "text") {
                process.stdout.write(event.delta.text);
            } else if (event.delta.type === "thought_summary") {
                if (event.delta.content.type === "text") {
                    process.stdout.write(event.delta.content.text);
                }
            }
        } else if (event.event_type === "interaction.completed") {
            console.log(`\n\nTotal Tokens: ${event.interaction.usage.total_tokens}`);
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \
      --no-buffer \
      -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "Research the latest advances in quantum computing.",
        "stream": true,
        "background": true,
        "agent_config": {
          "type": "deep-research",
          "thinking_summaries": "auto"
        }
      }'

    event: interaction.created
    data: {"interaction":{"id":"v1_...","status":"in_progress","object":"interaction","agent":"deep-research-preview-04-2026"},"event_type":"interaction.created"}

    event: interaction.status_update
    data: {"interaction_id":"v1_...","status":"in_progress","event_type":"interaction.status_update"}

    event: step.start
    data: {"index":0,"step":{"type":"thought"},"event_type":"step.start"}

    event: step.delta
    data: {"index":0,"delta":{"content":{"text":"***Generating research plan***\n\nTo best answer your request, I'm starting by constructing a comprehensive research plan. This will outline the key areas I need to investigate and the strategy I'll use to connect them."},"type":"thought_summary"},"event_type":"step.delta"}

    ... (additional thought steps) ...

    event: step.stop
    data: {"index":0,"event_type":"step.stop"}

    event: step.start
    data: {"index":1,"step":{"type":"model_output"},"event_type":"step.start"}

    event: step.delta
    data: {"index":1,"delta":{"text":"# The Quantum Inflection Point: Exhaustive Analysis of Hardware, Algorithms, and Market Dynamics in 2026\n\n## Executive Summary\n\n..."},"event_type":"step.delta"}

    event: step.stop
    data: {"index":1,"event_type":"step.stop"}

    event: interaction.completed
    data: {"interaction":{"id":"v1_...","status":"completed","usage":{"total_tokens":1117031,"total_input_tokens":428865,"total_output_tokens":22294,"total_thought_tokens":26213},"created":"2026-05-12T17:24:27Z","updated":"2026-05-12T17:24:27Z","object":"interaction","agent":"deep-research-preview-04-2026"},"event_type":"interaction.completed"}

    event: done
    data: [DONE]

## Streaming image generation

The Interactions API supports streaming multiple output modalities simultaneously. By requesting both `text` and `image` in the `response_format`, you can receive interleaved text and generated images in the same stream.

The following example uses `gemini-3.1-flash-image-preview` (Nano Banana 2) to search for information and generate a story with interleaved illustrations.

### Python

    from google import genai

    client = genai.Client()

    stream = client.interactions.create(
        model="gemini-3.1-flash-image-preview",
        tools=[{"type": "google_search", "search_types": ["web_search", "image_search"]}],
        input="Search for the history of the Colosseum and write a short illustrated story about a gladiator named Marcus. Interleave text and generated images.",
        response_format=[
            {"type": "text"},
            {"type": "image"}
        ],
        stream=True,
    )

    for event in stream:
        if event.event_type == "step.delta":
            if event.delta.type == "text":
                print(event.delta.text, end="", flush=True)
            elif event.delta.type == "image":
                print(f"\n[Image chunk: {len(event.delta.data)} bytes]", end="", flush=True)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const client = new GoogleGenAI({});

    const stream = await client.interactions.create({
        model: "gemini-3.1-flash-image-preview",
        tools: [{ type: "google_search", search_types: ["web_search", "image_search"] }],
        input: "Search for the history of the Colosseum and write a short illustrated story about a gladiator named Marcus. Interleave text and generated images.",
        response_format: [
            { type: "text" },
            { type: "image" }
        ],
        stream: true,
    });

    for await (const event of stream) {
        if (event.event_type === "step.delta") {
            if (event.delta.type === "text") {
                process.stdout.write(event.delta.text);
            } else if (event.delta.type === "image") {
                console.log(`\n[Image chunk: ${event.delta.data.length} bytes]`);
            }
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \
      --no-buffer \
      -d '{
        "model": "gemini-3.1-flash-image-preview",
        "input": "Search for the history of the Colosseum and write a short illustrated story about a gladiator named Marcus. Interleave text and generated images.",
        "stream": true,
        "tools": [
          { "type": "google_search",
            "search_types": ["web_search", "image_search"]
          }
        ],
        "generation_config": {
          "thinking_summaries": "auto"
        },
        "response_format": [
          { "type": "text" }, { "type": "image"}
        ]
      }'

    event: interaction.created
    data: {"interaction":{"id":"v1_...","status":"in_progress","object":"interaction","model":"gemini-3.1-flash-image-preview"},"event_type":"interaction.created"}

    event: interaction.status_update
    data: {"interaction_id":"v1_...","status":"in_progress","event_type":"interaction.status_update"}

    event: step.start
    data: {"index":0,"step":{"type":"model_output"},"event_type":"step.start"}

    event: step.delta
    data: {"index":0,"delta":{"text":"Here is a short illustrated story about the Colosseum...\n\n### Part 1: The New Flavian Amphitheater\n\n...","type":"text"},"event_type":"step.delta"}

    ...

    event: step.stop
    data: {"index":0,"event_type":"step.stop"}

    event: step.start
    data: {"index":1,"step":{"type":"thought"},"event_type":"step.start"}

    event: step.delta
    data: {"index":1,"delta":{"signature":"...","type":"thought_signature"},"event_type":"step.delta"}

    event: step.stop
    data: {"index":1,"event_type":"step.stop"}

    event: step.start
    data: {"index":2,"step":{"type":"model_output"},"event_type":"step.start"}

    event: step.delta
    data: {"index":2,"delta":{"mime_type":"image/jpeg","data":"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCg...","type":"image"},"event_type":"step.delta"}

    event: step.delta
    data: {"index":2,"delta":{"text":"### Part 2: The Hypogeum and the Wait\n\n...","type":"text"},"event_type":"step.delta"}

    ...

    event: step.stop
    data: {"index":2,"event_type":"step.stop"}

    event: step.start
    data: {"index":3,"step":{"type":"thought"},"event_type":"step.start"}

    event: step.delta
    data: {"index":3,"delta":{"signature":"...","type":"thought_signature"},"event_type":"step.delta"}

    event: step.stop
    data: {"index":3,"event_type":"step.stop"}

    event: step.start
    data: {"index":4,"step":{"type":"model_output"},"event_type":"step.start"}

    event: step.delta
    data: {"index":4,"delta":{"mime_type":"image/jpeg","data":"/9j/4AAQSkZJRgABAQAAAQABAAD/...","type":"image"},"event_type":"step.delta"}

    event: step.delta
    data: {"index":4,"delta":{"text":"### Part 3: The Moment of Spectacle\n\n...","type":"text"},"event_type":"step.delta"}

    ...

    event: step.stop
    data: {"index":4,"event_type":"step.stop"}

    event: interaction.completed
    data: {"interaction":{"id":"v1_...","status":"completed","usage":{"total_tokens":6128,"total_input_tokens":29,"total_output_tokens":6099,"output_tokens_by_modality":[{"modality":"image","tokens":4480}]}},"event_type":"interaction.completed"}

    event: done
    data: [DONE]

## Handling unknown events

In accordance with the API's versioning policy, new event types and delta types may be added over time. Your code should handle unknown event types gracefully---log and skip any events you don't recognize rather than throwing an error.

## What's next

- Learn more about the [Interactions API](https://ai.google.dev/gemini-api/docs/interactions).
- Explore [Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling) with tools.
- Learn about [Thinking](https://ai.google.dev/gemini-api/docs/interactions/thinking) for enhanced reasoning.
- Try the [Deep Research Agent](https://ai.google.dev/gemini-api/docs/interactions/deep-research) for long-running tasks.
- See the [Interactions API reference](https://ai.google.dev/api/interactions) for all event types and delta types.

# OpenAI compatibility

<br />

Gemini models are accessible using the OpenAI libraries (Python and TypeScript /
Javascript) along with the REST API, by updating three lines of code
and using your [Gemini API key](https://aistudio.google.com/apikey). If you
aren't already using the OpenAI libraries, we recommend that you call the
[Gemini API directly](https://ai.google.dev/gemini-api/docs/quickstart).

### Python

    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    response = client.chat.completions.create(
        model="gemini-3.5-flash",
        messages=[
            {   "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "Explain to me how AI works"
            }
        ]
    )

    print(response.choices[0].message)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    const response = await openai.chat.completions.create({
        model: "gemini-3.5-flash",
        messages: [
            {   role: "system",
                content: "You are a helpful assistant." 
            },
            {
                role: "user",
                content: "Explain to me how AI works",
            },
        ],
    });

    console.log(response.choices[0].message);

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $GEMINI_API_KEY" \
      -d '{
        "model": "gemini-3.5-flash",
        "messages": [
          {
            "role": "user",
            "content": "Explain to me how AI works"
          }
        ]
      }'

What changed? Just three lines!

- **`api_key="GEMINI_API_KEY"`** : Replace "`GEMINI_API_KEY`" with your actual Gemini
  API key, which you can get in [Google AI Studio](https://aistudio.google.com).

- **`base_url="https://generativelanguage.googleapis.com/v1beta/openai/"`:** This
  tells the OpenAI library to send requests to the Gemini API endpoint instead of
  the default URL.

- **`model="gemini-3.5-flash"`**: Choose a compatible Gemini model

## Thinking

Gemini models are trained to think through complex problems, leading
to significantly improved reasoning. The Gemini API comes with [thinking
parameters](https://ai.google.dev/gemini-api/docs/thinking) which give fine grain
control over how much the model will think.

Different Gemini models have different reasoning configurations, you can see how
they map to OpenAI's reasoning efforts as follows:

| `reasoning_effort` (OpenAI) | `thinking_level` (Gemini 3.1 Pro) | `thinking_level` (Gemini 3.1 Flash-Lite) | `thinking_level` (Gemini 3 Flash) | `thinking_budget` (Gemini 2.5) |

| `reasoning_effort` (OpenAI) | `thinking_level` (Gemini 3.1 Pro) | `thinking_level` (Gemini 3.1 Flash-Lite) | `thinking_level` (Gemini 3 Flash) | `thinking_budget` (Gemini 2.5) |
|---|---|---|---|---|
| `minimal` | `low` | `minimal` | `minimal` | `1,024` |
| `low` | `low` | `low` | `low` | `1,024` |
| `medium` | `medium` | `medium` | `medium` | `8,192` |
| `high` | `high` | `high` | `high` | `24,576` |

If no `reasoning_effort` is specified, Gemini uses the model's
default [level](https://ai.google.dev/gemini-api/docs/thinking#levels) or [budget](https://ai.google.dev/gemini-api/docs/thinking#set-budget).

If you want to disable thinking, you can set `reasoning_effort` to `"none"` for
2.5 models. Reasoning cannot be turned off for Gemini 2.5 Pro or 3 models.

### Python

    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    response = client.chat.completions.create(
        model="gemini-3.5-flash",
        reasoning_effort="low",
        messages=[
            {   "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "Explain to me how AI works"
            }
        ]
    )

    print(response.choices[0].message)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    const response = await openai.chat.completions.create({
        model: "gemini-3.5-flash",
        reasoning_effort: "low",
        messages: [
            {   role: "system",
                content: "You are a helpful assistant." 
            },
            {
                role: "user",
                content: "Explain to me how AI works",
            },
        ],
    });

    console.log(response.choices[0].message);

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $GEMINI_API_KEY" \
      -d '{
        "model": "gemini-3.5-flash",
        "reasoning_effort": "low",
        "messages": [
          {
            "role": "user",
            "content": "Explain to me how AI works"
          }
        ]
      }'

Gemini thinking models also produce [thought summaries](https://ai.google.dev/gemini-api/docs/thinking#summaries).
You can use the [`extra_body`](https://ai.google.dev/gemini-api/docs/openai#extra-body) field to include Gemini fields
in your request.

Note that `reasoning_effort` and `thinking_level`/`thinking_budget` overlap
functionality, so they can't be used at the same time.

### Python

    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    response = client.chat.completions.create(
        model="gemini-3.5-flash",
        messages=[{"role": "user", "content": "Explain to me how AI works"}],
        extra_body={
          'extra_body': {
            "google": {
              "thinking_config": {
                "thinking_level": "low",
                "include_thoughts": True
              }
            }
          }
        }
    )

    print(response.choices[0].message)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    const response = await openai.chat.completions.create({
        model: "gemini-3.5-flash",
        messages: [{role: "user", content: "Explain to me how AI works",}],
        extra_body: {
          "google": {
            "thinking_config": {
              "thinking_level": "low",
              "include_thoughts": true
            }
          }
        }
    });

    console.log(response.choices[0].message);

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer GEMINI_API_KEY" \
      -d '{
          "model": "gemini-3.5-flash",
            "messages": [{"role": "user", "content": "Explain to me how AI works"}],
            "extra_body": {
              "google": {
                "thinking_config": {
                  "thinking_level": "low",
                  "include_thoughts": true
                }
              }
            }
          }'

Gemini 3 supports OpenAI compatibility for thought signatures in chat completion
APIs. You can find the full example on the [thought signatures](https://ai.google.dev/gemini-api/docs/thought-signatures#openai) page.

## Streaming

The Gemini API supports [streaming responses](https://ai.google.dev/gemini-api/docs/text-generation?lang=python#generate-a-text-stream).

### Python

    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    response = client.chat.completions.create(
      model="gemini-3.5-flash",
      messages=[
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {   "role": "user",
            "content": "Hello!"
        }
      ],
      stream=True
    )

    for chunk in response:
        print(chunk.choices[0].delta)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    async function main() {
      const completion = await openai.chat.completions.create({
        model: "gemini-3.5-flash",
        messages: [
          {
              "role": "system",
              "content": "You are a helpful assistant."
          },
          {
              "role": "user",
              "content": "Hello!"
          }
        ],
        stream: true,
      });

      for await (const chunk of completion) {
        console.log(chunk.choices[0].delta.content);
      }
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer GEMINI_API_KEY" \
      -d '{
          "model": "gemini-3.5-flash",
          "messages": [
              {"role": "user", "content": "Explain to me how AI works"}
          ],
          "stream": true
        }'

## Function calling

Function calling makes it easier for you to get structured data outputs from
generative models and is [supported in the Gemini API](https://ai.google.dev/gemini-api/docs/function-calling/tutorial).

### Python

    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    tools = [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get the weather in a given location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. Chicago, IL",
              },
              "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
            },
            "required": ["location"],
          },
        }
      }
    ]

    messages = [{"role": "user", "content": "What's the weather like in Chicago today?"}]
    response = client.chat.completions.create(
      model="gemini-3.5-flash",
      messages=messages,
      tools=tools,
      tool_choice="auto"
    )

    print(response)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    async function main() {
      const messages = [{"role": "user", "content": "What's the weather like in Chicago today?"}];
      const tools = [
          {
            "type": "function",
            "function": {
              "name": "get_weather",
              "description": "Get the weather in a given location",
              "parameters": {
                "type": "object",
                "properties": {
                  "location": {
                    "type": "string",
                    "description": "The city and state, e.g. Chicago, IL",
                  },
                  "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
              },
            }
          }
      ];

      const response = await openai.chat.completions.create({
        model: "gemini-3.5-flash",
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      });

      console.log(response);
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer GEMINI_API_KEY" \
    -d '{
      "model": "gemini-3.5-flash",
      "messages": [
        {
          "role": "user",
          "content": "What'\''s the weather like in Chicago today?"
        }
      ],
      "tools": [
        {
          "type": "function",
          "function": {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
              "type": "object",
              "properties": {
                "location": {
                  "type": "string",
                  "description": "The city and state, e.g. Chicago, IL"
                },
                "unit": {
                  "type": "string",
                  "enum": ["celsius", "fahrenheit"]
                }
              },
              "required": ["location"]
            }
          }
        }
      ],
      "tool_choice": "auto"
    }'

## Image understanding

Gemini models are natively multimodal and provide best in class performance on
[many common vision tasks](https://ai.google.dev/gemini-api/docs/vision).

### Python

    import base64
    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    # Function to encode the image
    def encode_image(image_path):
      with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

    # Getting the base64 string
    base64_image = encode_image("Path/to/agi/image.jpeg")

    response = client.chat.completions.create(
      model="gemini-3.5-flash",
      messages=[
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": "What is in this image?",
            },
            {
              "type": "image_url",
              "image_url": {
                "url":  f"data:image/jpeg;base64,{base64_image}"
              },
            },
          ],
        }
      ],
    )

    print(response.choices[0])

### JavaScript

    import OpenAI from "openai";
    import fs from 'fs/promises';

    const openai = new OpenAI({
      apiKey: "GEMINI_API_KEY",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    async function encodeImage(imagePath) {
      try {
        const imageBuffer = await fs.readFile(imagePath);
        return imageBuffer.toString('base64');
      } catch (error) {
        console.error("Error encoding image:", error);
        return null;
      }
    }

    async function main() {
      const imagePath = "Path/to/agi/image.jpeg";
      const base64Image = await encodeImage(imagePath);

      const messages = [
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": "What is in this image?",
            },
            {
              "type": "image_url",
              "image_url": {
                "url": `data:image/jpeg;base64,${base64Image}`
              },
            },
          ],
        }
      ];

      try {
        const response = await openai.chat.completions.create({
          model: "gemini-3.5-flash",
          messages: messages,
        });

        console.log(response.choices[0]);
      } catch (error) {
        console.error("Error calling Gemini API:", error);
      }
    }

    main();

### REST

    bash -c '
      base64_image=$(base64 -i "Path/to/agi/image.jpeg");
      curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer GEMINI_API_KEY" \
        -d "{
          \"model\": \"gemini-3.5-flash\",
          \"messages\": [
            {
              \"role\": \"user\",
              \"content\": [
                { \"type\": \"text\", \"text\": \"What is in this image?\" },
                {
                  \"type\": \"image_url\",
                  \"image_url\": { \"url\": \"data:image/jpeg;base64,${base64_image}\" }
                }
              ]
            }
          ]
        }"
    '

## Generate an image

Generate an image using `gemini-2.5-flash-image` or `gemini-3-pro-image-preview`. Supported parameters include `prompt`, `model`, `n`, `size`, and `response_format`. Any other parameters not listed here or in the [`extra_body`](https://ai.google.dev/gemini-api/docs/openai#extra-body) section will be silently ignored by the compatibility layer.

> [!TIP]
> You can enable **Grounding with Google Search** and configure **safety settings** using the `extra_body` parameter. See the [`extra_body`](https://ai.google.dev/gemini-api/docs/openai#extra-body) section for available parameters. Grounding with Google Search is only available on Gemini 3 and newer models.

### Python

    import base64
    from openai import OpenAI
    from PIL import Image
    from io import BytesIO

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )

    response = client.images.generate(
        model="gemini-2.5-flash-image",
        prompt="a portrait of a sheepadoodle wearing a cape",
        response_format='b64_json',
        n=1,
    )

    for image_data in response.data:
      image = Image.open(BytesIO(base64.b64decode(image_data.b64_json)))
      image.show()

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
      apiKey: "GEMINI_API_KEY",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });

    async function main() {
      const image = await openai.images.generate(
        {
          model: "gemini-2.5-flash-image",
          prompt: "a portrait of a sheepadoodle wearing a cape",
          response_format: "b64_json",
          n: 1,
        }
      );

      console.log(image.data);
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/images/generations" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer GEMINI_API_KEY" \
      -d '{
            "model": "gemini-2.5-flash-image",
            "prompt": "a portrait of a sheepadoodle wearing a cape",
            "response_format": "b64_json",
            "n": 1,
          }'

## Generate a video

Generate a video using `veo-3.1-generate-preview` via the Sora-compatible
`/v1/videos` endpoint. Supported top-level parameters are `prompt` and `model`. Additional parameters like `duration_seconds`, `image`, and `aspect_ratio` must be passed with `extra_body`. See the [`extra_body`](https://ai.google.dev/gemini-api/docs/openai#extra-body) section
for all available parameters.

Video generation is a long-running operation that returns
an operation ID you can poll for completion.

### Python

    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    # Returns a Long Running Operation (status: processing)
    response = client.videos.create(
        model="veo-3.1-generate-preview",
        prompt="A cinematic drone shot of a waterfall",
    )

    print(f"Operation ID: {response.id}")
    print(f"Status: {response.status}")

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    async function main() {
        // Returns a Long Running Operation (status: processing)
        const response = await openai.videos.create({
            model: "veo-3.1-generate-preview",
            prompt: "A cinematic drone shot of a waterfall",
        });

        console.log(`Operation ID: ${response.id}`);
        console.log(`Status: ${response.status}`);
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/videos" \
      -H "Authorization: Bearer $GEMINI_API_KEY" \
      -F "model=veo-3.1-generate-preview" \
      -F "prompt=A cinematic drone shot of a waterfall"

### Check video status

Video generation is asynchronous. Use `GET /v1/videos/{id}` to poll the status
and retrieve the final video URL when complete:

### Python

    import time
    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    # Poll until video is ready
    video_id = response.id  # From the create call
    while True:
        video = client.videos.retrieve(video_id)
        if video.status == "completed":
            print(f"Video URL: {video.url}")
            break
        elif video.status == "failed":
            print(f"Generation failed: {video.error}")
            break
        print(f"Status: {video.status}. Waiting...")
        time.sleep(10)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    async function main() {
        // Poll until video is ready
        const videoId = response.id;  // From the create call
        while (true) {
            const video = await openai.videos.retrieve(videoId);
            if (video.status === "completed") {
                console.log(`Video URL: ${video.url}`);
                break;
            } else if (video.status === "failed") {
                console.log(`Generation failed: ${video.error}`);
                break;
            }
            console.log(`Status: ${video.status}. Waiting...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/videos/VIDEO_ID" \
      -H "Authorization: Bearer $GEMINI_API_KEY"

## Audio understanding

Analyze audio input:

### Python

    import base64
    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    with open("/path/to/your/audio/file.wav", "rb") as audio_file:
      base64_audio = base64.b64encode(audio_file.read()).decode('utf-8')

    response = client.chat.completions.create(
        model="gemini-3.5-flash",
        messages=[
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": "Transcribe this audio",
            },
            {
                  "type": "input_audio",
                  "input_audio": {
                    "data": base64_audio,
                    "format": "wav"
              }
            }
          ],
        }
      ],
    )

    print(response.choices[0].message.content)

### JavaScript

    import fs from "fs";
    import OpenAI from "openai";

    const client = new OpenAI({
      apiKey: "GEMINI_API_KEY",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });

    const audioFile = fs.readFileSync("/path/to/your/audio/file.wav");
    const base64Audio = Buffer.from(audioFile).toString("base64");

    async function main() {
      const response = await client.chat.completions.create({
        model: "gemini-3.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe this audio",
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: "wav",
                },
              },
            ],
          },
        ],
      });

      console.log(response.choices[0].message.content);
    }

    main();

### REST

> [!NOTE]
> **Note:** If you get an `Argument list too long` error, the encoding of your audio file might be too long for curl.

    bash -c '
      base64_audio=$(base64 -i "/path/to/your/audio/file.wav");
      curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer GEMINI_API_KEY" \
        -d "{
          \"model\": \"gemini-3.5-flash\",
          \"messages\": [
            {
              \"role\": \"user\",
              \"content\": [
                { \"type\": \"text\", \"text\": \"Transcribe this audio file.\" },
                {
                  \"type\": \"input_audio\",
                  \"input_audio\": {
                    \"data\": \"${base64_audio}\",
                    \"format\": \"wav\"
                  }
                }
              ]
            }
          ]
        }"
    '

## Structured output

Gemini models can output JSON objects in any [structure you define](https://ai.google.dev/gemini-api/docs/structured-output).

### Python

    from pydantic import BaseModel
    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    class CalendarEvent(BaseModel):
        name: str
        date: str
        participants: list[str]

    completion = client.beta.chat.completions.parse(
        model="gemini-3.5-flash",
        messages=[
            {"role": "system", "content": "Extract the event information."},
            {"role": "user", "content": "John and Susan are going to an AI conference on Friday."},
        ],
        response_format=CalendarEvent,
    )

    print(completion.choices[0].message.parsed)

### JavaScript

    import OpenAI from "openai";
    import { zodResponseFormat } from "openai/helpers/zod";
    import { z } from "zod";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai"
    });

    const CalendarEvent = z.object({
      name: z.string(),
      date: z.string(),
      participants: z.array(z.string()),
    });

    const completion = await openai.chat.completions.parse({
      model: "gemini-3.5-flash",
      messages: [
        { role: "system", content: "Extract the event information." },
        { role: "user", content: "John and Susan are going to an AI conference on Friday" },
      ],
      response_format: zodResponseFormat(CalendarEvent, "event"),
    });

    const event = completion.choices[0].message.parsed;
    console.log(event);

## Embeddings

Text embeddings measure the relatedness of text strings and can be generated
using the [Gemini API](https://ai.google.dev/gemini-api/docs/embeddings). You can use
`gemini-embedding-2-preview` for multimodal embeddings or
`gemini-embedding-001` for text-only embeddings.

### Python

    from openai import OpenAI

    client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    response = client.embeddings.create(
        input="Your text string goes here",
        model="gemini-embedding-2-preview"
    )

    print(response.data[0].embedding)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
        apiKey: "GEMINI_API_KEY",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    async function main() {
      const embedding = await openai.embeddings.create({
        model: "gemini-embedding-2-preview",
        input: "Your text string goes here",
      });

      console.log(embedding);
    }

    main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/openai/embeddings" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer GEMINI_API_KEY" \
    -d '{
        "input": "Your text string goes here",
        "model": "gemini-embedding-2-preview"
      }'

## Batch API

You can create [batch jobs](https://ai.google.dev/gemini-api/docs/batch-mode), submit them, and check
their status using the OpenAI library.

You'll need to prepare the JSONL file in OpenAI input format. For example:

    {"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gemini-3.5-flash", "messages": [{"role": "user", "content": "Tell me a one-sentence joke."}]}}
    {"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gemini-3.5-flash", "messages": [{"role": "user", "content": "Why is the sky blue?"}]}}

OpenAI compatibility for Batch supports creating a batch,
monitoring job status, and viewing batch results.

Compatibility for upload and download is currently not supported. Instead, the
following example uses the `genai` client for uploading and downloading
[files](https://ai.google.dev/gemini-api/docs/files), the same as when using the Gemini [Batch API](https://ai.google.dev/gemini-api/docs/batch-mode#input-file).

### Python

    from openai import OpenAI

    # Regular genai client for uploads & downloads
    from google import genai
    client = genai.Client()

    openai_client = OpenAI(
        api_key="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    # Upload the JSONL file in OpenAI input format, using regular genai SDK
    uploaded_file = client.files.upload(
        file='my-batch-requests.jsonl',
        config=types.UploadFileConfig(display_name='my-batch-requests', mime_type='jsonl')
    )

    # Create batch
    batch = openai_client.batches.create(
        input_file_id=batch_input_file_id,
        endpoint="/v1/chat/completions",
        completion_window="24h"
    )

    # Wait for batch to finish (up to 24h)
    while True:
        batch = client.batches.retrieve(batch.id)
        if batch.status in ('completed', 'failed', 'cancelled', 'expired'):
            break
        print(f"Batch not finished. Current state: {batch.status}. Waiting 30 seconds...")
        time.sleep(30)
    print(f"Batch finished: {batch}")

    # Download results in OpenAI output format, using regular genai SDK
    file_content = genai_client.files.download(file=batch.output_file_id).decode('utf-8')

    # See batch_output JSONL in OpenAI output format
    for line in file_content.splitlines():
        print(line)    

The OpenAI SDK also supports [generating embeddings with the Batch API](https://ai.google.dev/gemini-api/docs/batch-api#batch-embeddings). To do so, switch out the
`create` method's `endpoint` field for an embeddings endpoint, as well as the
`url` and `model` keys in the JSONL file:

    # JSONL file using embeddings model and endpoint
    # {"custom_id": "request-1", "method": "POST", "url": "/v1/embeddings", "body": {"model": "ggemini-embedding-001", "messages": [{"role": "user", "content": "Tell me a one-sentence joke."}]}}
    # {"custom_id": "request-2", "method": "POST", "url": "/v1/embeddings", "body": {"model": "gemini-embedding-001", "messages": [{"role": "user", "content": "Why is the sky blue?"}]}}

    # ...

    # Create batch step with embeddings endpoint
    batch = openai_client.batches.create(
        input_file_id=batch_input_file_id,
        endpoint="/v1/embeddings",
        completion_window="24h"
    )

See the [Batch embedding generation](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_OpenAI_Compatibility.ipynb)
section of the OpenAI compatibility cookbook for a complete example.

## Flex and Priority inference

The Gemini API matches OpenAI's `service_tier` parameter in name and logic,
enforcing limits and gracefully directing traffic for both the Flex and Priority
inference tiers.

### Python

    from openai import OpenAI

    client = OpenAI(
      api_key="GEMINI_API_KEY",
      base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    completion = client.chat.completions.create(
      model="gemini-3.5-flash",
      messages=[
        {"role": "user", "content": "Write a short poem about clouds."}
      ],
      service_tier="priority" # Or service_tier="flex"
    )

    print(completion)

When not explicitly assigned, `service_tier` defaults to `standard`, equivalent
to `default` for OpenAI.
Learn more about inference tiers in the [Optimization](https://ai.google.dev/gemini-api/docs/optimization) documentation.

## Enable Gemini features with `extra_body`

There are several features supported by Gemini that are not available in OpenAI
models but can be enabled using the `extra_body` field.

| Parameter | Type | Endpoint | Description |
|---|---|---|---|
| **`cached_content`** | Text | Chat | Corresponds to Gemini's general content cache. |
| **`thinking_config`** | Object | Chat | Corresponds to Gemini's ThinkingConfig. |
| **`aspect_ratio`** | Text | Images | Output aspect ratio (e.g., `"16:9"`, `"1:1"`, `"9:16"`). |
| **`generation_config`** | Object | Images | Gemini generation config object (e.g., `{"responseModalities": ["IMAGE"], "candidateCount": 2}`). |
| **`safety_settings`** | List | Images | Custom safety threshold filters (e.g., `[{"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"}]`). |
| **`tools`** | List | Images | Enables grounding (e.g., `[{"google_search": {}}]`). Only for `gemini-3-pro-image-preview`. |
| **`aspect_ratio`** | Text | Video | Dimensions of the output video (`16:9` for landscape, `9:16` for portrait). Maps from `size` if not specified. |
| **`resolution`** | Text | Video | Output resolution (`720p`, `1080p`, `4K`). Note: `1080p` and `4K` trigger upsampler pipeline. |
| **`duration_seconds`** | Integer | Video | Generation length (values: `4`, `6`, `8`). Must be `8` when using `reference_images`, interpolation, or extension. |
| **`frame_rate`** | Text | Video | Frame rate for video output (e.g., `"24"`). |
| **`input_reference`** | Text | Video | Reference input for video generation. |
| **`extend_video_id`** | Text | Video | ID of an existing video to extend. |
| **`negative_prompt`** | Text | Video | Items to exclude (e.g., `"shaky camera"`). |
| **`seed`** | Integer | Video | Integer for deterministic generation. |
| **`style`** | Text | Video | Visual styling (`cinematic` default, `creative` for social-media optimized). |
| **`person_generation`** | Text | Video | Controls generation of people (`allow_adult`, `allow_all`, `dont_allow`). |
| **`reference_images`** | List | Video | Up to 3 images for style/character reference (base64 assets). |
| **`image`** | Text | Video | Base64-encoded initial input image to condition the video generation. |
| **`last_frame`** | Object | Video | Final image for interpolation (requires `image` as first frame). |

### Example using `extra_body`

Here's an example of using `extra_body` to set `cached_content`:

### Python

    from openai import OpenAI

    client = OpenAI(
        api_key=MY_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/"
    )

    stream = client.chat.completions.create(
        model="gemini-3.5-flash",
        n=1,
        messages=[
            {
                "role": "user",
                "content": "Summarize the video"
            }
        ],
        stream=True,
        stream_options={'include_usage': True},
        extra_body={
            'extra_body':
            {
                'google': {
                  'cached_content': "cachedContents/0000aaaa1111bbbb2222cccc3333dddd4444eeee"
              }
            }
        }
    )

    for chunk in stream:
        print(chunk)
        print(chunk.usage.to_dict())

## List models

Get a list of available Gemini models:

### Python

    from openai import OpenAI

    client = OpenAI(
      api_key="GEMINI_API_KEY",
      base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    models = client.models.list()
    for model in models:
      print(model.id)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
      apiKey: "GEMINI_API_KEY",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });

    async function main() {
      const list = await openai.models.list();

      for await (const model of list) {
        console.log(model);
      }
    }
    main();

### REST

    curl https://generativelanguage.googleapis.com/v1beta/openai/models \
    -H "Authorization: Bearer GEMINI_API_KEY"

## Retrieve a model

Retrieve a Gemini model:

### Python

    from openai import OpenAI

    client = OpenAI(
      api_key="GEMINI_API_KEY",
      base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    model = client.models.retrieve("gemini-3.5-flash")
    print(model.id)

### JavaScript

    import OpenAI from "openai";

    const openai = new OpenAI({
      apiKey: "GEMINI_API_KEY",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });

    async function main() {
      const model = await openai.models.retrieve("gemini-3.5-flash");
      console.log(model.id);
    }

    main();

### REST

    curl https://generativelanguage.googleapis.com/v1beta/openai/models/gemini-3.5-flash \
    -H "Authorization: Bearer GEMINI_API_KEY"

## Current limitations

Support for the OpenAI libraries is still in beta while we extend feature support.

If you have questions about supported parameters, upcoming features, or run into
any issues getting started with Gemini, join our [Developer Forum](https://discuss.ai.google.dev/c/gemini-api/4).

## What's next

Try our [OpenAI Compatibility Colab](https://colab.sandbox.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_OpenAI_Compatibility.ipynb) to work through more detailed
examples.

# Understand and count tokens

Gemini and other generative AI models process input and output at a granularity
called a *token*.

**For Gemini models, a token is equivalent to about 4 characters.
100 tokens is equal to about 60-80 English words.**

## About tokens

Tokens can be single characters like `z` or whole words like `cat`. Long words
are broken up into several tokens. The set of all tokens used by the model is
called the vocabulary, and the process of splitting text into tokens is called
*tokenization*.

When billing is enabled, the [cost of a call to the Gemini API](https://ai.google.dev/pricing) is
determined in part by the number of input and output tokens, so knowing how to
count tokens can be helpful.

You can try out counting tokens in our Colab.

|---|---|---|
| [![](https://ai.google.dev/static/site-assets/images/docs/notebook-site-button.png)View on ai.google.dev](https://ai.google.dev/gemini-api/docs/tokens) | [![](https://www.tensorflow.org/images/colab_logo_32px.png)Try a Colab notebook](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Counting_Tokens.ipynb) | [![](https://www.tensorflow.org/images/GitHub-Mark-32px.png)View notebook on GitHub](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Counting_Tokens.ipynb) |

## Count tokens

All input to and output from the Gemini API is tokenized, including text, image
files, and other non-text modalities.

You can count tokens in the following ways:

- **Call [`count_tokens`](https://ai.google.dev/api/rest/v1/models/countTokens) with the input
  of the request.**
  This returns the total number of tokens in *the
  input only*. You can make this call before sending the input to the
  model to check the size of your requests.

- **Use the `usage_metadata` attribute on the `response` object after
  calling `generate_content`.**
  This returns the total number of
  tokens in *both the input and the output* : `total_token_count`.  
  It
  also returns the token counts of the input and output separately:
  `prompt_token_count` (input tokens) and `candidates_token_count`
  (output tokens).

  If you are using a [thinking
  model](https://ai.google.dev/gemini-api/docs/thinking), the tokens used during the thinking
  process are returned in `thoughts_token_count`. And if you are using
  [Context caching](https://ai.google.dev/gemini-api/docs/caching), the cached token
  count will be in `cached_content_token_count`.

### Count text tokens

If you call `count_tokens` with a text-only input, it returns the token count of
the text in *the input only* (`total_tokens`). You can make this call before
calling `generate_content` to check the size of your requests.

Another option is calling `generate_content` and then using the `usage_metadata`
attribute on the `response` object to get the following:

- The separate token counts of the input (`prompt_token_count`), the cached content (`cached_content_token_count`) and the output (`candidates_token_count`)
- The token count for the thinking process (`thoughts_token_count`)
- The total number of tokens in *both the input and the output*
  (`total_token_count`)

### Python

    from google import genai

    client = genai.Client()
    prompt = "The quick brown fox jumps over the lazy dog."

    total_tokens = client.models.count_tokens(
        model="gemini-3.5-flash", contents=prompt
    )
    print("total_tokens: ", total_tokens)

    response = client.models.generate_content(
        model="gemini-3.5-flash", contents=prompt
    )

    print(response.usage_metadata)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const ai = new GoogleGenAI({});
    const prompt = "The quick brown fox jumps over the lazy dog.";

    async function main() {
      const countTokensResponse = await ai.models.countTokens({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      console.log(countTokensResponse.totalTokens);

      const generateResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      console.log(generateResponse.usageMetadata);
    }

    await main();

### Go

    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)

    // Convert prompt to a slice of *genai.Content using the helper.
    contents := []*genai.Content{
      genai.NewContentFromText(prompt, genai.RoleUser),
    }
    countResp, err := client.Models.CountTokens(ctx, "gemini-3.5-flash", contents, nil)
    if err != nil {
      return err
    }
    fmt.Println("total_tokens:", countResp.TotalTokens)

    response, err := client.Models.GenerateContent(ctx, "gemini-3.5-flash", contents, nil)
    if err != nil {
      log.Fatal(err)
    }
    usageMetadata, err := json.MarshalIndent(response.UsageMetadata, "", "  ")
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println(string(usageMetadata))
        ```

### Count multi-turn (chat) tokens

If you call `count_tokens` with the chat history, it returns the total token
count of the text from each role in the chat (`total_tokens`).

Another option is calling `send_message` and then using the `usage_metadata`
attribute on the `response` object to get the following:

- The separate token counts of the input (`prompt_token_count`), the cached content (`cached_content_token_count`) and the output (`candidates_token_count`)
- The token count for the thinking process (`thoughts_token_count`)
- The total number of tokens in *both the input and the output* (`total_token_count`)

To understand how big your next conversational turn will be, you need to append
it to the history when you call `count_tokens`.

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    chat = client.chats.create(
        model="gemini-3.5-flash",
        history=[
            types.Content(
                role="user", parts=[types.Part(text="Hi my name is Bob")]
            ),
            types.Content(role="model", parts=[types.Part(text="Hi Bob!")]),
        ],
    )

    print(
        client.models.count_tokens(
            model="gemini-3.5-flash", contents=chat.get_history()
        )
    )

    response = chat.send_message(
        message="In one sentence, explain how a computer works to a young child."
    )
    print(response.usage_metadata)

    extra = types.UserContent(
        parts=[
            types.Part(
                text="What is the meaning of life?",
            )
        ]
    )
    history = [*chat.get_history(), extra]
    print(client.models.count_tokens(model="gemini-3.5-flash", contents=history))

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const ai = new GoogleGenAI({});

    async function main() {
      const history = [
        { role: "user", parts: [{ text: "Hi my name is Bob" }] },
        { role: "model", parts: [{ text: "Hi Bob!" }] },
      ];
      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        history: history,
      });

      const countTokensResponse = await ai.models.countTokens({
        model: "gemini-3.5-flash",
        contents: chat.getHistory(),
      });
      console.log(countTokensResponse.totalTokens);

      const chatResponse = await chat.sendMessage({
        message: "In one sentence, explain how a computer works to a young child.",
      });
      console.log(chatResponse.usageMetadata);

      const extraMessage = {
        role: "user",
        parts: [{ text: "What is the meaning of life?" }],
      };
      const combinedHistory = [...chat.getHistory(), extraMessage];
      const combinedCountTokensResponse = await ai.models.countTokens({
        model: "gemini-3.5-flash",
        contents: combinedHistory,
      });
      console.log(
        "Combined history token count:",
        combinedCountTokensResponse.totalTokens,
      );
    }

    await main();

### Go

    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)

    history := []*genai.Content{
      {Role: genai.RoleUser, Parts: []*genai.Part({Text: "Hi my name is Bob"})},
      {Role: genai.RoleModel, Parts: []*genai.Part({Text: "Hi Bob!"})},
    }
    chat, err := client.Chats.Create(ctx, "gemini-3.5-flash", nil, history)
    if err != nil {
      log.Fatal(err)
    }

    firstTokenResp, err := client.Models.CountTokens(ctx, "gemini-3.5-flash", chat.History(false), nil)
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println(firstTokenResp.TotalTokens)

    resp, err := chat.SendMessage(ctx, genai.NewPartFromText("In one sentence, explain how a computer works to a young child."))
    if err != nil {
      log.Fatal(err)
    }
    fmt.Printf("%#v\n", resp.UsageMetadata)

    extra := genai.NewContentFromText("What is the meaning of life?", genai.RoleUser)
    hist := chat.History(false)
    hist = append(hist, extra)

    secondTokenResp, err := client.Models.CountTokens(ctx, "gemini-3.5-flash", hist, nil)
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println(secondTokenResp.TotalTokens)

### Count multimodal tokens

All input to the Gemini API is tokenized, including text, image files, and other
non-text modalities. Note the following high-level key points about tokenization
of multimodal input during processing by the Gemini API:

- Image inputs with both dimensions \<=384 pixels are counted as
  258 tokens. Images larger in one or both dimensions are cropped and scaled as
  needed into tiles of 768x768 pixels, each counted as 258 tokens.

- Video and audio files are converted to tokens at the following fixed rates:
  video at 263 tokens per second and audio at 32 tokens per second.

#### Media resolutions

[Gemini 3 models](https://ai.google.dev/gemini-api/docs/models#gemini-3) introduce granular control over
multimodal vision processing with the `media_resolution` parameter. The
`media_resolution` parameter determines the
**maximum number of tokens allocated per input image or video frame.**
Higher resolutions improve the model's ability to
read fine text or identify small details, but increase token usage and latency.

For more details about the parameter and how it can impact token calculations,
see the [media resolution](https://ai.google.dev/gemini-api/docs/media-resolution) guide.

#### Image files

If you call `count_tokens` with a text-and-image input, it returns the combined
token count of the text and the image in *the input only* (`total_tokens`). You
can make this call before calling `generate_content` to check the size of your
requests. You can also optionally call `count_tokens` on the text and the file
separately.

Another option is calling `generate_content` and then using the `usage_metadata`
attribute on the `response` object to get the following:

- The separate token counts of the input (`prompt_token_count`), the cached content (`cached_content_token_count`) and the output (`candidates_token_count`)
- The token count for the thinking process (`thoughts_token_count`)
- The total number of tokens in *both the input and the output* (`total_token_count`)

Example that uses an uploaded image from the File API:

### Python

    from google import genai

    client = genai.Client()
    prompt = "Tell me about this image"
    your_image_file = client.files.upload(file=media / "organ.jpg")

    print(
        client.models.count_tokens(
            model="gemini-3.5-flash", contents=[prompt, your_image_file]
        )
    )

    response = client.models.generate_content(
        model="gemini-3.5-flash", contents=[prompt, your_image_file]
    )
    print(response.usage_metadata)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const ai = new GoogleGenAI({});
    const prompt = "Tell me about this image";

    async function main() {
      const organ = await ai.files.upload({
        file: path.join(media, "organ.jpg"),
        config: { mimeType: "image/jpeg" },
      });

      const countTokensResponse = await ai.models.countTokens({
        model: "gemini-3.5-flash",
        contents: createUserContent([
          prompt,
          createPartFromUri(organ.uri, organ.mimeType),
        ]),
      });
      console.log(countTokensResponse.totalTokens);

      const generateResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: createUserContent([
          prompt,
          createPartFromUri(organ.uri, organ.mimeType),
        ]),
      });
      console.log(generateResponse.usageMetadata);
    }

    await main();

### Go

    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)

    file, err := client.Files.UploadFromPath(
      ctx, 
      filepath.Join(getMedia(), "organ.jpg"), 
      &genai.UploadFileConfig{
        MIMEType : "image/jpeg",
      },
    )
    if err != nil {
      log.Fatal(err)
    }
    parts := []*genai.Part{
      genai.NewPartFromText("Tell me about this image"),
      genai.NewPartFromURI(file.URI, file.MIMEType),
    }
    contents := []*genai.Content{
      genai.NewContentFromParts(parts, genai.RoleUser),
    }

    tokenResp, err := client.Models.CountTokens(ctx, "gemini-3.5-flash", contents, nil)
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println("Multimodal image token count:", tokenResp.TotalTokens)

    response, err := client.Models.GenerateContent(ctx, "gemini-3.5-flash", contents, nil)
    if err != nil {
      log.Fatal(err)
    }
    usageMetadata, err := json.MarshalIndent(response.UsageMetadata, "", "  ")
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println(string(usageMetadata))

Example that provides the image as inline data:

### Python

    from google import genai
    import PIL.Image

    client = genai.Client()
    prompt = "Tell me about this image"
    your_image_file = PIL.Image.open(media / "organ.jpg")

    print(
        client.models.count_tokens(
            model="gemini-3.5-flash", contents=[prompt, your_image_file]
        )
    )

    response = client.models.generate_content(
        model="gemini-3.5-flash", contents=[prompt, your_image_file]
    )
    print(response.usage_metadata)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const ai = new GoogleGenAI({});
    const prompt = "Tell me about this image";
    const imageBuffer = fs.readFileSync(path.join(media, "organ.jpg"));

    const imageBase64 = imageBuffer.toString("base64");

    const contents = createUserContent([
      prompt,
      createPartFromBase64(imageBase64, "image/jpeg"),
    ]);

    async function main() {
      const countTokensResponse = await ai.models.countTokens({
        model: "gemini-3.5-flash",
        contents: contents,
      });
      console.log(countTokensResponse.totalTokens);

      const generateResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
      });
      console.log(generateResponse.usageMetadata);
    }

    await main();

### Go

    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)

    imageBytes, err := os.ReadFile("organ.jpg")
    if err != nil {
        log.Fatalf("Failed to read image file: %v", err)
    }
    parts := []*genai.Part{
      genai.NewPartFromText("Tell me about this image"),
      {
            InlineData: &genai.Blob{
                  MIMEType: "image/jpeg",
                  Data:     imageBytes,
            },
      },
    }
    contents := []*genai.Content{
      genai.NewContentFromParts(parts, genai.RoleUser),
    }

    tokenResp, err := client.Models.CountTokens(ctx, "gemini-3.5-flash", contents, nil)
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println("Multimodal image token count:", tokenResp.TotalTokens)

    response, err := client.Models.GenerateContent(ctx, "gemini-3.5-flash", contents, nil)
    if err != nil {
      log.Fatal(err)
    }
    usageMetadata, err := json.MarshalIndent(response.UsageMetadata, "", "  ")
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println(string(usageMetadata))

#### Video or audio files

Audio and video are each converted to tokens at the following fixed rates:

- Video: 263 tokens per second
- Audio: 32 tokens per second

If you call `count_tokens` with a text-and-video/audio input, it returns the
combined token count of the text and the video/audio file in *the input only*
(`total_tokens`). You can make this call before calling `generate_content` to
check the size of your requests. You can also optionally call `count_tokens` on
the text and the file separately.

Another option is calling `generate_content` and then using the `usage_metadata`
attribute on the `response` object to get the following:

- The separate token counts of the input (`prompt_token_count`), the cached content (`cached_content_token_count`) and the output (`candidates_token_count`)
- The token count for the thinking process (`thoughts_token_count`)
- The total number of tokens in *both the input and the output*
  (`total_token_count`).

### Python

    from google import genai
    import time

    client = genai.Client()
    prompt = "Tell me about this video"
    your_file = client.files.upload(file=media / "Big_Buck_Bunny.mp4")

    while not your_file.state or your_file.state.name != "ACTIVE":
        print("Processing video...")
        print("File state:", your_file.state)
        time.sleep(5)
        your_file = client.files.get(name=your_file.name)

    print(
        client.models.count_tokens(
            model="gemini-3.5-flash", contents=[prompt, your_file]
        )
    )

    response = client.models.generate_content(
        model="gemini-3.5-flash", contents=[prompt, your_file]
    )
    print(response.usage_metadata)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const ai = new GoogleGenAI({});
    const prompt = "Tell me about this video";

    async function main() {
      let videoFile = await ai.files.upload({
        file: path.join(media, "Big_Buck_Bunny.mp4"),
        config: { mimeType: "video/mp4" },
      });

      while (!videoFile.state || videoFile.state.toString() !== "ACTIVE") {
        console.log("Processing video...");
        console.log("File state: ", videoFile.state);
        await sleep(5000);
        videoFile = await ai.files.get({ name: videoFile.name });
      }

      const countTokensResponse = await ai.models.countTokens({
        model: "gemini-3.5-flash",
        contents: createUserContent([
          prompt,
          createPartFromUri(videoFile.uri, videoFile.mimeType),
        ]),
      });
      console.log(countTokensResponse.totalTokens);

      const generateResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: createUserContent([
          prompt,
          createPartFromUri(videoFile.uri, videoFile.mimeType),
        ]),
      });
      console.log(generateResponse.usageMetadata);
    }

    await main();

### Go

    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)

    file, err := client.Files.UploadFromPath(
      ctx,
      filepath.Join(getMedia(), "Big_Buck_Bunny.mp4"),
      &genai.UploadFileConfig{
        MIMEType : "video/mp4",
      },
    )
    if err != nil {
      log.Fatal(err)
    }

    for file.State == genai.FileStateUnspecified || file.State != genai.FileStateActive {
      fmt.Println("Processing video...")
      fmt.Println("File state:", file.State)
      time.Sleep(5 * time.Second)

      file, err = client.Files.Get(ctx, file.Name, nil)
      if err != nil {
        log.Fatal(err)
      }
    }

    parts := []*genai.Part{
      genai.NewPartFromText("Tell me about this video"),
      genai.NewPartFromURI(file.URI, file.MIMEType),
    }
    contents := []*genai.Content{
      genai.NewContentFromParts(parts, genai.RoleUser),
    }

    tokenResp, err := client.Models.CountTokens(ctx, "gemini-3.5-flash", contents, nil)
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println("Multimodal video/audio token count:", tokenResp.TotalTokens)
    response, err := client.Models.GenerateContent(ctx, "gemini-3.5-flash", contents, nil)
    if err != nil {
      log.Fatal(err)
    }
    usageMetadata, err := json.MarshalIndent(response.UsageMetadata, "", "  ")
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println(string(usageMetadata))

### Count thought tokens

> [!NOTE]
> **Note:** The API provides **summaries** in both the [free and paid tiers](https://ai.google.dev/gemini-api/docs/pricing). **Thought signatures** increase the input token count (and your cost) when you send them back in subsequent conversational turns.

When you turn on thinking, response pricing is the sum of output tokens and thinking tokens. You can retrieve the total number of generated thinking tokens from the `thoughtsTokenCount` field (or SDK equivalent).

### Python

    # ...
    print("Thoughts tokens:", response.usage_metadata.thoughts_token_count)
    print("Output tokens:", response.usage_metadata.candidates_token_count)

### JavaScript

    // ...
    console.log(`Thoughts tokens: ${response.usageMetadata.thoughtsTokenCount}`);
    console.log(`Output tokens: ${response.usageMetadata.candidatesTokenCount}`);

### Go

    // ...
    fmt.Println("Thoughts tokens:", response.UsageMetadata.ThoughtsTokenCount)
    fmt.Println("Output tokens:", response.UsageMetadata.CandidatesTokenCount)

Thinking models generate full thoughts to improve the quality of the final response, and then output [summaries](https://ai.google.dev/gemini-api/docs/thinking#summaries) to provide insight into the thought process. So, the API bases pricing on the full thought tokens the model generates to create a summary, even though the API only outputs the summary.

You can learn more about how to configure thinking in the [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking) guide.

## Context windows

The models available through the Gemini API have context windows that are
measured in tokens. The context window defines how much input you can provide
and how much output the model can generate. You can determine the size of the
context window by calling the [`models.get` endpoint](https://ai.google.dev/api/rest/v1/models/get)
or by looking in the [models documentation](https://ai.google.dev/gemini-api/docs/models).

### Python

    from google import genai

    client = genai.Client()
    model_info = client.models.get(model="gemini-3.5-flash")
    print(f"{model_info.input_token_limit=}")
    print(f"{model_info.output_token_limit=}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const ai = new GoogleGenAI({});

    async function main() {
      const modelInfo = await ai.models.get({model: 'gemini-3.5-flash'});
      console.log(modelInfo.inputTokenLimit);
      console.log(modelInfo.outputTokenLimit);
    }

    await main();

### Go

    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)
    if err != nil {
      log.Fatal(err)
    }
    modelInfo, err := client.ModelInfo(ctx, "models/gemini-3.5-flash")
    if err != nil {
      log.Fatal(err)
    }
    fmt.Println("input token limit:", modelInfo.InputTokenLimit)
    fmt.Println("output token limit:", modelInfo.OutputTokenLimit)

# Prompt design strategies

*Prompt design* is the process of creating prompts, or natural language requests,
that elicit accurate, high quality responses from a language model.

This page introduces basic concepts, strategies, and best practices to get you
started designing prompts to get the most out of Gemini AI models.

> [!NOTE]
> **Note:** Prompt engineering is iterative. These guidelines and templates are starting points. Experiment and refine based on your specific use cases and observed model responses.

## Topic-specific prompt guides

Looking for more specific prompt strategies? Check out our other prompting guides
on:

- [Prompting with media files](https://ai.google.dev/gemini-api/docs/files#prompt-guide)
- Prompting for image generation with [Imagen](https://ai.google.dev/gemini-api/docs/imagen#imagen-prompt-guide) and [Gemini Native Image Generation](https://ai.google.dev/gemini-api/docs/image-generation#prompt-guide)
- [Prompting for video generation](https://ai.google.dev/gemini-api/docs/video#prompt-guide)

You can find other sample prompts in the [prompt gallery](https://ai.google.dev/gemini-api/prompts)
meant to interactively showcase many of the concepts shared in this guide.

## Clear and specific instructions

An effective and efficient way to customize model behavior is to provide it with
clear and specific instructions. Instructions can be in the form of a question,
step-by-step tasks, or as complex as mapping out a user's experience and mindset.

### Input

Input is the required text in the prompt that you want the model to provide a
response to. Inputs can be a question that the model
answers (question input), a task the model performs (task input), an entity the
model operates on (entity input), or partial input that the model completes or
continues (completion input).

| **Input type** | **Prompt** | **Generated output** |
|---|---|---|
| Question | What's a good name for a flower shop that specializes in selling bouquets of dried flowers? Create a list of 5 options with just the names. | Here are 5 names for a flower shop specializing in dried flowers: 1. Everlasting Blooms 2. Dried & Delightful 3. The Petal Preserve 4. Whispers of Wildflowers 5. Forever Blooms |
| Task | ``` Give me a simple list of just the things that I must bring on a camping trip. The list should have 5 items. ``` | ``` 1. **Tent:** Your shelter from the elements. 2. **Sleeping Bag:** Stay warm and comfortable. 3. **Sleeping Pad:** Insulation and cushioning for a good night's sleep. 4. **Headlamp or Flashlight:** Light for nighttime activities. 5. **First Aid Kit:** Be prepared for minor injuries. ``` |
| Entity | Classify the following items as [large, small]: Elephant Mouse Snail | Here's the classification: ***Elephant:** Large* **Mouse:** Small * **Snail:** Small |

#### Partial input completion

Generative language models work like an advanced auto completion tool. When you
provide partial content, the model can provide the rest of the content or what
it thinks is a continuation of that content as a response. When doing so, if you
include any examples or context, the model can take those examples or context
into account.

The following example provides a prompt with an instruction and an entity input:

|---|
| **Prompt:** ``` For the given order, return a JSON object that has the fields cheeseburger, hamburger, fries, or drink, with the value being the quantity. Order: A burger and a drink. ``` **Response:** ``` { "cheeseburger": 0, "hamburger": 1, "fries": 0, "drink": 1 } ``` (gemini-2.5-flash) |

While the model did as prompted, writing out the instructions in natural language
can sometimes be challenging and it leaves a lot to the model's interpretation.
For example, a restaurants menu might contain many items. To reduce the size of
the JSON response, you probably want to omit the items that weren't ordered. In
this case, you can give an example and a response prefix and let the model
complete it:

|---|
| **Prompt:** ```` Valid fields are cheeseburger, hamburger, fries, and drink. Order: Give me a cheeseburger and fries Output: ``` { "cheeseburger": 1, "fries": 1 } ``` Order: I want two burgers, a drink, and fries. Output: ```` **Response:** ```` ``` { "hamburger": 2, "drink": 1, "fries": 1 } ``` ```` (gemini-2.5-flash) |

Notice how "cheeseburger" was excluded from the output because it wasn't a part
of the order.

While you can specify the format of simple JSON response objects using prompts,
we recommend using Gemini API's
[structured output](https://ai.google.dev/gemini-api/docs/structured-output) feature when specifying
a more complex JSON Schema for the response.

### Constraints

Specify any constraints on reading the prompt or generating a response. You can
tell the model what to do and not to do. For example, you can specify a constraint
in the prompt on how long you want a summary to be:

|---|
| **Prompt:** ``` Summarize this text in one sentence: Text: A quantum computer exploits quantum mechanical phenomena to perform calculations exponentially faster than any modern traditional computer. At very tiny scales, physical matter acts as both particles and as waves, and quantum computing uses specialized hardware to leverage this behavior. The operating principles of quantum devices is beyond the scope of classical physics. When deployed at scale, quantum computers could be used in a wide variety of applications such as: in cybersecurity to break existing encryption methods while helping researchers create new ones, in meteorology to develop better weather forecasting etc. However, the current state of the art quantum computers are still largely experimental and impractical. ``` <br /> **Response:** ``` Exploiting quantum mechanical phenomena, quantum computers can perform calculations exponentially faster than traditional computers for potential applications like cybersecurity and meteorology, although they are currently largely experimental and impractical. ``` (gemini-2.5-flash) <br /> |

### Response format

You can give instructions that specify the format of the response. For example,
you can ask for the response to be formatted as a table, bulleted list, elevator
pitch, keywords, sentence, or paragraph. The following system instruction tells
the model to be more conversational in its response:

|---|
| **System instruction** ``` All questions should be answered comprehensively with details, unless the user requests a concise response specifically. ``` **Prompt** ``` What is a smart way to make a business that sells DVD's in 2026? ``` **Response:** ``` Starting a business selling DVDs in 2026 presents significant challenges due to the overwhelming dominance of digital streaming and on-demand services; a "smart" approach would therefore require a highly specialized niche, a strong value proposition beyond just the disc, and likely a focus on community or collector markets rather than mainstream consumption. Here's a breakdown of what a smart DVD business in 2026 would likely entail: 1. Extreme Niche Specialization: You cannot compete with streaming libraries. Your business must focus on what digital doesn't offer easily or at all. This could include: * Out-of-Print & Rare Titles: Sourcing films or TV shows that have never been released digitally or are currently unavailable on major streaming platforms. .... ``` (gemini-2.5-flash) |

#### Format responses with the completion strategy

The [completion strategy](https://ai.google.dev/gemini-api/docs/prompting-strategies#completion) can also help format the response.
The following example prompts the model to create an essay outline:

|---|
| **Prompt:** ``` Create an outline for an essay about hummingbirds. ``` **Response:** ``` Here is a possible outline for an essay about hummingbirds: I. Introduction A. Hook: Start with a captivating fact or description about hummingbirds (e.g., their speed, iridescent colors, or tiny size). B. Background: Briefly introduce hummingbirds – where they are found (Americas), their reputation as unique birds. C. Thesis Statement: State the main point of the essay, which could be about the remarkable adaptations, behaviors, and ecological importance of hummingbirds. II. Appearance and Identification ..... ``` (gemini-2.5-flash) |

The prompt didn't specify the format for the outline and the model chose a format
for you. To get the model to return an outline in a specific format, you can add
text that represents the start of the outline and let the model complete it based
on the pattern that you initiated.

|---|
| **Prompt:** ``` Create an outline for an essay about hummingbirds. I. Introduction * ``` **Response:** ``` Okay, here is an outline for an essay about hummingbirds, starting from the introduction you provided: I. Introduction * Hook: Start with a captivating fact or description about hummingbirds (e.g., their speed, iridescent colors, or tiny size). * Background: Briefly introduce hummingbirds – where they are found (Americas), their reputation as unique birds, and their general characteristics. * Thesis Statement: State the main point of the essay, focusing on the remarkable adaptations, behaviors, and ecological significance that make hummingbirds extraordinary. ..... ``` (gemini-2.5-flash) |

## Zero-shot vs few-shot prompts

You can include examples in the prompt that show the model what getting it right
looks like. The model attempts to identify patterns and relationships from the
examples and applies them when generating a response. Prompts that contain a few
examples are called *few-shot* prompts, while prompts that provide no
examples are called *zero-shot* prompts. Few-shot prompts are often used
to regulate the formatting, phrasing, scoping, or general patterning of model
responses. Use specific and varied examples to help the model narrow its focus
and generate more accurate results.

We recommend to always include few-shot examples in your prompts. Prompts without
few-shot examples are likely to be less effective. In fact, you can remove
instructions from your prompt if your examples are clear enough in showing the
task at hand.

The following zero-shot prompt asks the model to choose the best explanation.

|---|
| **Prompt:** ``` Please choose the best explanation to the question: Question: How is snow formed? Explanation1: Snow is formed when water vapor in the air freezes into ice crystals in the atmosphere, which can combine and grow into snowflakes as they fall through the atmosphere and accumulate on the ground. Explanation2: Water vapor freezes into ice crystals forming snow. Answer: ``` **Response:** ``` Explanation1 is the better explanation because it provides more detail on the process, including how ice crystals combine and grow into snowflakes as they fall through the atmosphere. ``` (gemini-2.5-flash) |

If your use case requires the model to produce concise responses, you can include
examples in the prompt that give preference to concise responses.

The following prompt provides two examples that show preference to the shorter
explanations. In the response, you can see that the examples guided the model to
choose the shorter explanation (`Explanation2`) as opposed to the longer
explanation (`Explanation1`) like it did previously.

|---|
| **Prompt:** ``` Below are some examples showing a question, explanation, and answer format: Question: Why is the sky blue? Explanation1: The sky appears blue because of Rayleigh scattering, which causes shorter blue wavelengths of light to be scattered more easily than longer red wavelengths, making the sky look blue. Explanation2: Due to Rayleigh scattering effect. Answer: Explanation2 Question: What is the cause of earthquakes? Explanation1: Sudden release of energy in the Earth's crust. Explanation2: Earthquakes happen when tectonic plates suddenly slip or break apart, causing a release of energy that creates seismic waves that can shake the ground and cause damage. Answer: Explanation1 Now, Answer the following question given the example formats above: Question: How is snow formed? Explanation1: Snow is formed when water vapor in the air freezes into ice crystals in the atmosphere, which can combine and grow into snowflakes as they fall through the atmosphere and accumulate on the ground. Explanation2: Water vapor freezes into ice crystals forming snow. Answer: ``` **Response:** ``` Answer: Explanation2 ``` (gemini-2.5-flash) |

### Optimal number of examples

Models like Gemini can often pick up on patterns using a few examples, though
you may need to experiment with the number of examples to provide in the prompt
for the best results. At the same time, if you include too many examples,
the model may start to [overfit](https://developers.google.com/machine-learning/glossary#overfitting)
the response to the examples.

### Consistent formatting

Make sure that the structure and formatting of few-shot examples are the same to
avoid responses with undesired formats. One of the primary objectives of adding
few-shot examples in prompts is to show the model the response format. Therefore,
it is essential to ensure a consistent format across all examples, especially
paying attention to XML tags, white spaces, newlines, and example splitters.

## Add context

You can include instructions and information in a prompt that the model needs
to solve a problem, instead of assuming that the model has all of the required
information. This contextual information helps the model understand the constraints
and details of what you're asking for it to do.

The following example asks the model to give troubleshooting guidance for a router:

|---|
| **Prompt:** ``` What should I do to fix my disconnected wifi? The light on my Google Wifi router is yellow and blinking slowly. ``` **Response:** ``` A yellow blinking light on your Google Wifi router usually indicates a problem with the internet connection. Here are some steps to troubleshoot and fix the issue: 1. Restart your router and modem: - Unplug your modem from the power outlet and wait for 30 seconds. - Plug your modem back in and wait for it to fully boot up. - Unplug your Google Wifi router and wait for 30 seconds. - Plug your Google Wifi router back in and wait for it to fully boot up. ..... ``` (gemini-2.5-flash) |

The response looks like generic troubleshooting information that's not specific
to the router or the status of the LED indicator lights.

To customize the response for the specific router, you can add to the prompt the router's
troubleshooting guide as context for it to refer to when providing a response.

|---|
| **Prompt:** ``` Answer the question using the text below. Respond with only the text provided. Question: What should I do to fix my disconnected wifi? The light on my Google Wifi router is yellow and blinking slowly. Text: Color: Slowly pulsing yellow What it means: There is a network error. What to do: Check that the Ethernet cable is connected to both your router and your modem and both devices are turned on. You might need to unplug and plug in each device again. Color: Fast blinking yellow What it means: You are holding down the reset button and are factory resetting this device. What to do: If you keep holding down the reset button, after about 12 seconds, the light will turn solid yellow. Once it is solid yellow, let go of the factory reset button. Color: Solid yellow What it means: Router is factory resetting. What to do: This can take up to 10 minutes. When it's done, the device will reset itself and start pulsing white, letting you know it's ready for setup. Color: Solid red What it means: Something is wrong. What to do: Critical failure. Factory reset the router. If the light stays red, contact Wifi customer support. ``` **Response:** ``` Check that the Ethernet cable is connected to both your router and your modem and both devices are turned on. You might need to unplug and plug in each device again. ``` (gemini-2.5-flash) |

## Break down prompts into components

For use cases that require complex prompts, you can help the model manage this
complexity by breaking things down into simpler components.

1. **Break down instructions:** Instead of having many instructions in one
   prompt, create one prompt per instruction. You can choose which prompt to
   process based on the user's input.

2. **Chain prompts:** For complex tasks that involve multiple sequential steps,
   make each step a prompt and chain the prompts together in a sequence. In this
   sequential chain of prompts, the output of one prompt in the sequence becomes
   the input of the next prompt. The output of the last prompt in the sequence
   is the final output.

3. **Aggregate responses:** Aggregation is when you want to perform different
   parallel tasks on different portions of the data and aggregate the results to
   produce the final output. For example, you can tell the model to perform one
   operation on the first part of the data, perform another operation on the rest
   of the data and aggregate the results.

## Experiment with model parameters

Each call that you send to a model includes parameter values that control how
the model generates a response. The model can generate different results for
different parameter values. Experiment with different parameter values to get
the best values for the task. The parameters available for
different models may differ. The most common parameters are the following:

1. **Max output tokens:** Specifies the maximum number of tokens that can be
   generated in the response. A token is approximately four characters. 100
   tokens correspond to roughly 60-80 words.

2. **Temperature:** The temperature controls the degree of randomness in token
   selection. The temperature is used for sampling during response generation,
   which occurs when `topP` and `topK` are applied. Lower temperatures are good
   for prompts that require a more deterministic or less open-ended response,
   while higher temperatures can lead to more diverse or creative results. A
   temperature of 0 is deterministic, meaning that the highest probability
   response is always selected.

   > [!NOTE]
   > **Note:** When using Gemini 3 models, we strongly recommend keeping the `temperature` at its default value of 1.0. Changing the temperature (setting it below 1.0) may lead to unexpected behavior, such as looping or degraded performance, particularly in complex mathematical or reasoning tasks.

3. **`topK`:** The `topK` parameter changes how the model selects tokens for
   output. A `topK` of 1 means the selected token is the most probable among
   all the tokens in the model's vocabulary (also called greedy decoding),
   while a `topK` of 3 means that the next token is selected from among the 3
   most probable using the temperature. For each token selection step, the
   `topK` tokens with the highest probabilities are sampled. Tokens are then
   further filtered based on `topP` with the final token selected using
   temperature sampling.

4. **`topP`:** The `topP` parameter changes how the model selects tokens for
   output. Tokens are selected from the most to least probable until the sum of
   their probabilities equals the `topP` value. For example, if tokens A, B,
   and C have a probability of 0.3, 0.2, and 0.1 and the `topP` value is 0.5,
   then the model will select either A or B as the next token by using the
   temperature and exclude C as a candidate. The default `topP` value is 0.95.

5. **`stop_sequences`:** Set a stop sequence to
   tell the model to stop generating content. A stop sequence can be any
   sequence of characters. Try to avoid using a sequence of characters that
   may appear in the generated content.

## Prompt iteration strategies

Prompt design can sometimes require a few iterations before
you consistently get the response you're looking for. This section provides
guidance on some things you can try when iterating on your prompts:

1. **Use different phrasing:** Using different words or phrasing in your prompts
   often yields different responses from the model even though they all mean the
   same thing. If you're not getting the expected results from your prompt, try
   rephrasing it.

   |---|
   | ``` Version 1: How do I bake a pie? Version 2: Suggest a recipe for a pie. Version 3: What's a good pie recipe? ``` <br /> |

2. **Switch to an analogous task:** If you can't get the model to follow your
   instructions for a task, try giving it instructions for an analogous task
   that achieves the same result.

   This prompt tells the model to categorize a book by using predefined categories:

   |---|
   | **Prompt:** ``` Which category does The Odyssey belong to: thriller sci-fi mythology biography ``` **Response:** ``` The Odyssey belongs to the category of **mythology**. Here's why: * **Mythology:** The Odyssey tells the story of Odysseus, a hero from Greek mythology, and his journey home after the Trojan War. It features gods, monsters, and supernatural events common to Greek mythology. ..... ``` (gemini-2.5-flash) |

   The response is correct, but the model didn't stay within the bounds of the
   options. You also want to model to just respond with one of the options instead
   of in a full sentence. In this case, you can rephrase the instructions as a
   multiple choice question and ask the model to choose an option.

   <br />

   |---|
   | **Prompt:** ``` Multiple choice problem: Which of the following options describes the book The Odyssey? Options: - thriller - sci-fi - mythology - biography ``` **Response:** ``` The correct answer is mythology. ``` (gemini-2.5-flash) |

3. **Change the order of prompt content:** The order of the content in the prompt
   can sometimes affect the response. Try changing the content order and see
   how that affects the response.

       Version 1:
       [examples]
       [context]
       [input]

       Version 2:
       [input]
       [examples]
       [context]

       Version 3:
       [examples]
       [input]
       [context]

## Fallback responses

A fallback response is a response returned by the model when either the prompt
or the response triggers a safety filter. An example of a fallback response is
"I'm not able to help with that, as I'm only a language model."

If the model responds with a fallback response, try increasing the temperature.

## Grounding and code execution

Gemini is able to use tools to avoid hallucinations in scenarios where it might
otherwise produce incorrect responses.

[Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search) connects the
Gemini model to real-time web content, and should be enabled whenever the model
may need to know obscure or recent facts.

Gemini's [code execution tool](https://ai.google.dev/gemini-api/docs/code-execution) enables the
model to generate and run Python code, and should be enabled whenever the model
needs to perform any kind of arithmetic, counting, or calculation.

## Gemini 3

[Gemini 3 models](https://ai.google.dev/gemini-api/docs/models#gemini-3) are designed for advanced
reasoning and instruction following.
They respond best to prompts that are direct, well-structured, and clearly
define the task and any constraints. The following practices are recommended for
optimal results with Gemini 3:

### Core prompting principles

- **Be precise and direct:** State your goal clearly and concisely. Avoid unnecessary or overly persuasive language.
- **Use consistent structure:** Employ clear delimiters to separate different parts of your prompt. XML-style tags (e.g., `<context>`, `<task>`) or Markdown headings are effective. Choose one format and use it consistently within a single prompt.
- **Define parameters:** Explicitly explain any ambiguous terms or parameters.
- **Control output verbosity:** By default, Gemini 3 models provide direct and efficient answers. If you need a more conversational or detailed response, you must explicitly request it in your instructions.
- **Handle multimodal inputs coherently:** When using text, images, audio, or video, treat them as equal-class inputs. Ensure your instructions clearly reference each modality as needed.
- **Prioritize critical instructions:** Place essential behavioral constraints, role definitions (persona), and output format requirements in the System Instruction or at the very beginning of the user prompt.
- **Structure for long contexts:** When providing large amounts of context (e.g., documents, code), supply all the context first. Place your specific instructions or questions at the very *end* of the prompt.
- **Anchor context:** After a large block of data, use a clear transition phrase to bridge the context and your query, such as "Based on the information above..."

### Gemini 3 Flash strategies

- **Current day accuracy:** Add the following clause to the system
  instructions to help the model pay attention to the current day being in 2026:

      For time-sensitive user queries that require up-to-date information, you
      MUST follow the provided current time (date and year) when formulating
      search queries in tool calls. Remember it is 2026 this year.

- **Knowledge cutoff accuracy:** Add the following clause to the system
  instructions to make the model aware of its knowledge cutoff:

      Your knowledge cutoff date is January 2025.

- **Grounding performance:** Add the following clause to the system
  instructions (with edits where appropriate) to improve the model's ability
  to ground responses in provided context:

      You are a strictly grounded assistant limited to the information provided in
      the User Context. In your answers, rely **only** on the facts that are
      directly mentioned in that context. You must **not** access or utilize your
      own knowledge or common sense to answer. Do not assume or infer from the
      provided facts; simply report them exactly as they appear. Your answer must
      be factual and fully truthful to the provided text, leaving absolutely no
      room for speculation or interpretation. Treat the provided context as the
      absolute limit of truth; any facts or details that are not directly
      mentioned in the context must be considered **completely untruthful** and
      **completely unsupported**. If the exact answer is not explicitly written in
      the context, you must state that the information is not available.

### Enhancing reasoning and planning

Gemini 2.5 and 3 series models automatically generate internal "thinking" text
to improve reasoning performance. As such, it's generally not necessary to have
the model outline, plan, or detail reasoning steps in the returned response
itself. For problems that require heavy reasoning, simple requests like "Think
very hard before answering" can improve performance, though at the cost of
extra thinking tokens.

See the [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking) documentation for more
detail.

### Structured prompting examples

Using tags or Markdown helps the model distinguish between instructions,
context, and tasks.

**XML example:**

    <role>
    You are a helpful assistant.
    </role>

    <constraints>
    1. Be objective.
    2. Cite sources.
    </constraints>

    <context>
    [Insert User Input Here - The model knows this is data, not instructions]
    </context>

    <task>
    [Insert the specific user request here]
    </task>

**Markdown example:**

    # Identity
    You are a senior solution architect.

    # Constraints
    - No external libraries allowed.
    - Python 3.11+ syntax only.

    # Output format
    Return a single code block.

### Example template combining best practices

This template captures the core principles for prompting with Gemini 3. Always
make sure to iterate and modify for your specific use case.

**System Instruction:**

    <role>
    You are Gemini 3, a specialized assistant for [Insert Domain, e.g., Data Science].
    You are precise, analytical, and persistent.
    </role>

    <instructions>
    1. **Plan**: Analyze the task and create a step-by-step plan.
    2. **Execute**: Carry out the plan.
    3. **Validate**: Review your output against the user's task.
    4. **Format**: Present the final answer in the requested structure.
    </instructions>

    <constraints>
    - Verbosity: [Specify Low/Medium/High]
    - Tone: [Specify Formal/Casual/Technical]
    </constraints>

    <output_format>
    Structure your response as follows:
    1. **Executive Summary**: [Short overview]
    2. **Detailed Response**: [The main content]
    </output_format>

**User Prompt:**

    <context>
    [Insert relevant documents, code snippets, or background info here]
    </context>

    <task>
    [Insert specific user request here]
    </task>

    <final_instruction>
    Remember to think step-by-step before answering.
    </final_instruction>

## Agentic workflows

For deep agentic workflows, specific instructions are often required to control how the model reasons, plans, and executes tasks. While Gemini provides strong general performance, complex agents often require you to configure the trade-off between computational cost (latency and tokens) and task accuracy.

When designing prompts for agents, consider the following dimensions of behavior that you can steer in the agent:

### Reasoning and strategy

Configuration for how the model thinks and plans before taking action.

- **Logical decomposition:** Defines how thoroughly the model must analyze constraints, prerequisites, and the order of operations.
- **Problem diagnosis**: Controls the depth of analysis when identifying causes and the model's use of abductive reasoning. Determines if the model should accept the most obvious answer or explore complex, less probable explanations.
- **Information exhaustiveness:** The trade-off between analyzing every available policy and document versus prioritizing efficiency and speed.

### Execution and reliability

Configuration for how the agent operates autonomously and handles roadblocks.

- **Adaptability:** How the model reacts to new data. Determines whether it should strictly adhere to its initial plan or pivot immediately when observations contradict assumptions.
- **Persistence and Recovery:** The degree to which the model attempts to self-correct errors. High persistence increases success rates but risks higher token costs or loops.
- **Risk Assessment:** The logic for evaluating consequences. Explicitly distinguishes between low-risk exploratory actions (reads) and high-risk state changes (writes).

### Interaction and output

Configuration for how the agent communicates with the user and formats results.

- **Ambiguity and permission handling:** Defines when the model is permitted to make assumptions versus when it must pause execution to ask the user for clarification or permission.
- **Verbosity:** Controls the volume of text generated alongside tool calls. This determines if the model explains its actions to the user or remains silent during execution.
- **Precision and completeness:** The required fidelity of the output. Specifies whether the model must solve for every edge case and provide exact figures or if ballpark estimates are acceptable.

### System instruction template

The following system instruction is an example that has been evaluated by researchers to improve performance on agentic benchmarks where the model must adhere to a complex rulebook and interact with a user. It encourages the agent to act as a strong reasoner and planner, enforces specific behaviors across dimensions listed above and requires the model to proactively plan before taking any action.

You can adapt this template to fit your specific use case constraints.

    You are a very strong reasoner and planner. Use these critical instructions to structure your plans, thoughts, and responses.

    Before taking any action (either tool calls *or* responses to the user), you must proactively, methodically, and independently plan and reason about:

    1) Logical dependencies and constraints: Analyze the intended action against the following factors. Resolve conflicts in order of importance:
        1.1) Policy-based rules, mandatory prerequisites, and constraints.
        1.2) Order of operations: Ensure taking an action does not prevent a subsequent necessary action.
            1.2.1) The user may request actions in a random order, but you may need to reorder operations to maximize successful completion of the task.
        1.3) Other prerequisites (information and/or actions needed).
        1.4) Explicit user constraints or preferences.

    2) Risk assessment: What are the consequences of taking the action? Will the new state cause any future issues?
        2.1) For exploratory tasks (like searches), missing *optional* parameters is a LOW risk. **Prefer calling the tool with the available information over asking the user, unless** your `Rule 1` (Logical Dependencies) reasoning determines that optional information is required for a later step in your plan.

    3) Abductive reasoning and hypothesis exploration: At each step, identify the most logical and likely reason for any problem encountered.
        3.1) Look beyond immediate or obvious causes. The most likely reason may not be the simplest and may require deeper inference.
        3.2) Hypotheses may require additional research. Each hypothesis may take multiple steps to test.
        3.3) Prioritize hypotheses based on likelihood, but do not discard less likely ones prematurely. A low-probability event may still be the root cause.

    4) Outcome evaluation and adaptability: Does the previous observation require any changes to your plan?
        4.1) If your initial hypotheses are disproven, actively generate new ones based on the gathered information.

    5) Information availability: Incorporate all applicable and alternative sources of information, including:
        5.1) Using available tools and their capabilities
        5.2) All policies, rules, checklists, and constraints
        5.3) Previous observations and conversation history
        5.4) Information only available by asking the user

    6) Precision and Grounding: Ensure your reasoning is extremely precise and relevant to each exact ongoing situation.
        6.1) Verify your claims by quoting the exact applicable information (including policies) when referring to them. 

    7) Completeness: Ensure that all requirements, constraints, options, and preferences are exhaustively incorporated into your plan.
        7.1) Resolve conflicts using the order of importance in #1.
        7.2) Avoid premature conclusions: There may be multiple relevant options for a given situation.
            7.2.1) To check for whether an option is relevant, reason about all information sources from #5.
            7.2.2) You may need to consult the user to even know whether something is applicable. Do not assume it is not applicable without checking.
        7.3) Review applicable sources of information from #5 to confirm which are relevant to the current state.

    8) Persistence and patience: Do not give up unless all the reasoning above is exhausted.
        8.1) Don't be dissuaded by time taken or user frustration.
        8.2) This persistence must be intelligent: On *transient* errors (e.g. please try again), you *must* retry **unless an explicit retry limit (e.g., max x tries) has been reached**. If such a limit is hit, you *must* stop. On *other* errors, you must change your strategy or arguments, not repeat the same failed call.

    9) Inhibit your response: only take an action after all the above reasoning is completed. Once you've taken an action, you cannot take it back.

## Next steps

- Now that you have a deeper understanding of prompt design, try writing your own prompts using [Google AI Studio](http://aistudio.google.com).
- To learn about multimodal prompting, see [Prompting with media files](https://ai.google.dev/gemini-api/docs/files#prompt-guide).
- To learn about image prompting, see the [Nano Banana](https://ai.google.dev/gemini-api/docs/image-generation#prompt-guide) and [Imagen](https://ai.google.dev/gemini-api/docs/imagen#imagen-prompt-guide) prompt guides.
- To learn about video prompting, see the [Veo prompt guide](https://ai.google.dev/gemini-api/docs/video#prompt-guide).

<br />

This API reference describes the standard, streaming, and real-time APIs you can
use to interact with the Gemini models. You can use the REST APIs in any
environment that supports HTTP requests. Refer to the
[Quickstart guide](https://ai.google.dev/gemini-api/docs/quickstart) for how to
get started with your first API call. If you're looking for the references for
our language-specific libraries and SDKs, go to the link for that language in
the left navigation under **SDK references**.

## Primary endpoints

The Gemini API is organized around the following major endpoints:

- **Interactions ([`CreateInteraction`](https://ai.google.dev/api/interactions-api#CreateInteraction)) (Recommended):** The recommended standard primitive for building with Gemini, optimized for agentic workflows, server-side state management, and complex multi-modal, multi-turn conversations.
- **Standard content generation ([`generateContent`](https://ai.google.dev/api/generate-content#method:-models.generatecontent)):** A standard REST endpoint that processes your request and returns the model's full response in a single package. This is best for non-interactive tasks where you can wait for the entire result.
- **Streaming content generation ([`streamGenerateContent`](https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent)):** Uses Server-Sent Events (SSE) to push chunks of the response to you as they are generated. This provides a faster, more interactive experience for applications like chatbots.
- **Live API ([`BidiGenerateContent`](https://ai.google.dev/api/live#send-messages)):** A stateful WebSocket-based API for bi-directional streaming, designed for real-time conversational use cases.
- **Batch mode ([`batchGenerateContent`](https://ai.google.dev/api/batch-mode)):** A standard REST endpoint for submitting batches of `generateContent` requests.
- **Embeddings ([`embedContent`](https://ai.google.dev/api/embeddings)):** A standard REST endpoint that generates a text embedding vector from the input `Content`.
- **Gen Media APIs:** Endpoints for generating media with our specialized models such as [Imagen for image generation](https://ai.google.dev/api/models#method:-models.predict), and [Veo for video generation](https://ai.google.dev/api/models#method:-models.predictlongrunning). Gemini also has these capabilities built in which you can access using the `generateContent` API.
- **Platform APIs:** Utility endpoints that support core capabilities such as [uploading files](https://ai.google.dev/api/files), and [counting tokens](https://ai.google.dev/api/tokens).

## Authentication

All requests to the Gemini API must include a `x-goog-api-key` header with your
API key. Create one with a few clicks in [Google AI
Studio](https://aistudio.google.com/app/apikey).

The following is an example request with the API key included in the header:

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "Explain how AI works in a few words"
              }
            ]
          }
        ]
      }'

For instructions on how to pass your key to the API using Gemini SDKs,
see the [Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key) guide.

## Content generation

This is the central endpoint for sending prompts to the model. There are two
endpoints for generating content, the key difference is how you receive the
response:

- **[`generateContent`](https://ai.google.dev/api/generate-content#method:-models.generatecontent)
  (REST)**: Receives a request and provides a single response after the model has finished its entire generation.
- **[`streamGenerateContent`](https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent)
  (SSE)**: Receives the exact same request, but the model streams back chunks of the response as they are generated. This provides a better user experience for interactive applications as it lets you display partial results immediately.

### Request body structure

The [request body](https://ai.google.dev/api/generate-content#request-body) is a JSON object that is
**identical** for both standard and streaming modes and is built from a few core
objects:

- [`Content`](https://ai.google.dev/api/caching#Content) object: Represents a single turn in a conversation.
- [`Part`](https://ai.google.dev/api/caching#Part) object: A piece of data within a `Content` turn (like text or an image).
- `inline_data` ([`Blob`](https://ai.google.dev/api/caching#Blob)): A container for raw media bytes and their MIME type.

At the highest level, the request body contains a `contents` object, which is a
list of `Content` objects, each representing turns in conversation. In most
cases, for basic text generation, you will have a single `Content` object, but
if you'd like to maintain conversation history, you can use multiple `Content`
objects.

The following shows a typical `generateContent` request body:

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
              "role": "user",
              "parts": [
                  // A list of Part objects goes here
              ]
          },
          {
              "role": "model",
              "parts": [
                  // A list of Part objects goes here
              ]
          }
        ]
      }'

### Response body structure

The [response body](https://ai.google.dev/api/generate-content#response-body) is similar for both
the streaming and standard modes except for the following:

- Standard mode: The response body contains an instance of [`GenerateContentResponse`](https://ai.google.dev/api/generate-content#v1beta.GenerateContentResponse).
- Streaming mode: The response body contains a stream of [`GenerateContentResponse`](https://ai.google.dev/api/generate-content#v1beta.GenerateContentResponse) instances.

At a high level, the response body contains a `candidates` object, which is a
list of `Candidate` objects. The `Candidate` object contains a `Content`
object that has the generated response returned from the model.

## Request examples

The following examples show how these components come together for different
types of requests.

### Text-only prompt

A simple text prompt consists of a `contents` array with a single `Content`
object. That object's `parts` array, in turn, contains a single `Part` object
with a `text` field.

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "Explain how AI works in a single paragraph."
              }
            ]
          }
        ]
      }'

### Multimodal prompt (text and image)

To provide both text and an image in a prompt, the `parts` array should contain
two `Part` objects: one for the text, and one for the image `inline_data`.

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
        "contents": [{
        "parts":[
            {
                "inline_data": {
                "mime_type":"image/jpeg",
                "data": "/9j/4AAQSkZJRgABAQ... (base64-encoded image)"
                }
            },
            {"text": "What is in this picture?"},
          ]
        }]
      }'

### Multi-turn conversations (chat)

To build a conversation with multiple turns, you define the `contents` array
with multiple `Content` objects. The API will use this entire history as context
for the next response. The `role` for each `Content` object should alternate
between `user` and `model`.

> [!NOTE]
> **Note:** The client SDKs provide a chat interface that manages this list for you automatically. When using the REST API, you are responsible for maintaining the conversation history.

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "role": "user",
            "parts": [
              { "text": "Hello." }
            ]
          },
          {
            "role": "model",
            "parts": [
              { "text": "Hello! How can I help you today?" }
            ]
          },
          {
            "role": "user",
            "parts": [
              { "text": "Please write a four-line poem about the ocean." }
            ]
          }
        ]
      }'

### Key takeaways

- `Content` is the envelope: It's the top-level container for a message turn, whether it's from the user or the model.
- `Part` enables multimodality: Use multiple `Part` objects within a single `Content` object to combine different types of data (text, image, video URI, etc.).
- Choose your data method:
  - For small, directly embedded media (like most images), use a `Part` with `inline_data`.
  - For larger files or files you want to reuse across requests, use the File API to upload the file and reference it with a `file_data` part.
- Manage conversation history: For chat applications using the REST API, build the `contents` array by appending `Content` objects for each turn, alternating between `"user"` and `"model"` roles. If you're using an SDK, refer to the SDK documentation for the recommended way to manage conversation history.

## Response examples

The following examples show how these components come together for different
types of requests.

### Text-only response

A default text response consists of a `candidates` array with one or more
`content` objects that contain the model's response.

The following is an example of a **standard** response:

    {
      "candidates": [
        {
          "content": {
            "parts": [
              {
                "text": "At its core, Artificial Intelligence works by learning from vast amounts of data ..."
              }
            ],
            "role": "model"
          },
          "finishReason": "STOP",
          "index": 1
        }
      ],
    }

The following is series of **streaming** responses. Each response contains a
`responseId` that ties the full response together:

    {
      "candidates": [
        {
          "content": {
            "parts": [
              {
                "text": "The image displays"
              }
            ],
            "role": "model"
          },
          "index": 0
        }
      ],
      "usageMetadata": {
        "promptTokenCount": ...
      },
      "modelVersion": "gemini-3.5-flash",
      "responseId": "mAitaLmkHPPlz7IPvtfUqQ4"
    }

    ...

    {
      "candidates": [
        {
          "content": {
            "parts": [
              {
                "text": " the following materials:\n\n*   **Wood:** The accordion and the violin are primarily"
              }
            ],
            "role": "model"
          },
          "index": 0
        }
      ],
      "usageMetadata": {
        "promptTokenCount": ...
      }
      "modelVersion": "gemini-3.5-flash",
      "responseId": "mAitaLmkHPPlz7IPvtfUqQ4"
    }

## Live API (BidiGenerateContent) WebSockets API

Live API offers a stateful WebSocket based API for bi-directional streaming to
enable real-time streaming use cases. You can review
[Live API guide](https://ai.google.dev/gemini-api/docs/live) and the [Live API reference](https://ai.google.dev/api/live)
for more details.

## Specialized models

In addition to the Gemini family of models, Gemini API offers endpoints for
specialized models such as [Imagen](https://ai.google.dev/gemini-api/docs/imagen),
[Lyria](https://ai.google.dev/gemini-api/docs/music-generation) and
[embedding](https://ai.google.dev/gemini-api/docs/embeddings) models. You can check out
these guides under the Models section.

## Platform APIs

The rest of the endpoints enable additional capabilities to use with the main
endpoints described so far. Check out topics
[Batch mode](https://ai.google.dev/gemini-api/docs/batch-mode) and
[File API](https://ai.google.dev/gemini-api/docs/files) in the Guides section to learn more.

## What's next

If you're just getting started, check out the following guides, which will help
you understand the Gemini API programming model:

- [Gemini API quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- [Gemini model guide](https://ai.google.dev/gemini-api/docs/models/gemini)

You might also want to check out the capabilities guides, which introduce different
Gemini API features and provide code examples:

- [Text generation](https://ai.google.dev/gemini-api/docs/text-generation)
- [Context caching](https://ai.google.dev/gemini-api/docs/caching)
- [Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)

# Models

The models endpoint provides a way for you to programmatically list the available models, and retrieve extended metadata such as supported functionality and context window sizing. Read more in [the Models guide](https://ai.google.dev/gemini-api/docs/models/gemini).

## Method: models.get

- [Endpoint](https://ai.google.dev/api/models#body.HTTP_TEMPLATE)
- [Path parameters](https://ai.google.dev/api/models#body.PATH_PARAMETERS)
- [Request body](https://ai.google.dev/api/models#body.request_body)
- [Response body](https://ai.google.dev/api/models#body.response_body)
- [Authorization scopes](https://ai.google.dev/api/models#body.aspect)
- [Example request](https://ai.google.dev/api/models#body.codeSnippets)
  - [Get](https://ai.google.dev/api/models#body.codeSnippets.group)

Gets information about a specific `Model` such as its version number, token limits, [parameters](https://ai.google.dev/gemini-api/docs/models/generative-models#model-parameters) and other metadata. Refer to the [Gemini models guide](https://ai.google.dev/gemini-api/docs/models/gemini) for detailed model information.

### Endpoint

get `https://generativelanguage.googleapis.com/v1beta/{name=models/*}`

### Path parameters

`name` `string` Required. The resource name of the model.

This name should match a model name returned by the `models.list` method.

Format: `models/{model}` It takes the form `models/{model}`.

### Request body

The request body must be empty.

### Example request

### Python

    from google import genai

    client = genai.Client()
    model_info = client.models.get(model="gemini-2.0-flash")
    print(model_info)

### Go

    ctx := context.Background()
    client, err := genai.NewClient(ctx, &genai.ClientConfig{
     APIKey:  os.Getenv("GEMINI_API_KEY"),
     Backend: genai.BackendGeminiAPI,
    })
    if err != nil {
     log.Fatal(err)
    }

    modelInfo, err := client.Models.Get(ctx, "gemini-2.0-flash", nil)
    if err != nil {
     log.Fatal(err)
    }

    fmt.Println(modelInfo)

### Shell

    curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=$GEMINI_API_KEY

### Response body

If successful, the response body contains an instance of `https://ai.google.dev/api/models#Model`.

## Method: models.list

- [Endpoint](https://ai.google.dev/api/models#body.HTTP_TEMPLATE)
- [Query parameters](https://ai.google.dev/api/models#body.QUERY_PARAMETERS)
- [Request body](https://ai.google.dev/api/models#body.request_body)
- [Response body](https://ai.google.dev/api/models#body.response_body)
  - [JSON representation](https://ai.google.dev/api/models#body.ListModelsResponse.SCHEMA_REPRESENTATION)
- [Authorization scopes](https://ai.google.dev/api/models#body.aspect)
- [Example request](https://ai.google.dev/api/models#body.codeSnippets)
  - [List](https://ai.google.dev/api/models#body.codeSnippets.group)

Lists the [`Model`s](https://ai.google.dev/gemini-api/docs/models/gemini) available through the Gemini API.

### Endpoint

get `https://generativelanguage.googleapis.com/v1beta/models`

### Query parameters

`pageSize` `integer` The maximum number of `Models` to return (per page).

If unspecified, 50 models will be returned per page. This method returns at most 1000 models per page, even if you pass a larger pageSize.
`pageToken` `string` A page token, received from a previous `models.list` call.

Provide the `pageToken` returned by one request as an argument to the next request to retrieve the next page.

When paginating, all other parameters provided to `models.list` must match the call that provided the page token.

### Request body

The request body must be empty.

### Example request

### Python

    from google import genai

    client = genai.Client()

    print("List of models that support generateContent:\n")
    for m in client.models.list():
        for action in m.supported_actions:
            if action == "generateContent":
                print(m.name)

    print("List of models that support embedContent:\n")
    for m in client.models.list():
        for action in m.supported_actions:
            if action == "embedContent":
                print(m.name)

### Go

    ctx := context.Background()
    client, err := genai.NewClient(ctx, &genai.ClientConfig{
     APIKey:  os.Getenv("GEMINI_API_KEY"),
     Backend: genai.BackendGeminiAPI,
    })
    if err != nil {
     log.Fatal(err)
    }


    // Retrieve the list of models.
    models, err := client.Models.List(ctx, &genai.ListModelsConfig{})
    if err != nil {
     log.Fatal(err)
    }

    fmt.Println("List of models that support generateContent:")
    for _, m := range models.Items {
     for _, action := range m.SupportedActions {
      if action == "generateContent" {
       fmt.Println(m.Name)
       break
      }
     }
    }

    fmt.Println("\nList of models that support embedContent:")
    for _, m := range models.Items {
     for _, action := range m.SupportedActions {
      if action == "embedContent" {
       fmt.Println(m.Name)
       break
      }
     }
    }

### Shell

    curl https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY

### Response body

Response from `ListModel` containing a paginated list of Models.

If successful, the response body contains data with the following structure:
Fields `models[]` ``object (`https://ai.google.dev/api/models#Model`)`` The returned Models.
`nextPageToken` `string` A token, which can be sent as `pageToken` to retrieve the next page.

If this field is omitted, there are no more pages.

| JSON representation |
|---|
| ``` { "models": [ { object (`https://ai.google.dev/api/models#Model`) } ], "nextPageToken": string } ``` |

## REST Resource: models

- [Resource: Model](https://ai.google.dev/api/models#Model)
  - [JSON representation](https://ai.google.dev/api/models#Model.SCHEMA_REPRESENTATION)
- [Methods](https://ai.google.dev/api/models#METHODS_SUMMARY)

## Resource: Model

Information about a Generative Language Model.
Fields `name` `string` Required. The resource name of the `Model`. Refer to [Model variants](https://ai.google.dev/gemini-api/docs/models/gemini#model-variations) for all allowed values.

Format: `models/{model}` with a `{model}` naming convention of:

- "{baseModelId}-{version}"

Examples:

- `models/gemini-1.5-flash-001`
`baseModelId` `string` Required. The name of the base model, pass this to the generation request.

Examples:

- `gemini-1.5-flash`
`version` `string` Required. The version number of the model.

This represents the major version (`1.0` or `1.5`)
`displayName` `string` The human-readable name of the model. E.g. "Gemini 1.5 Flash".

The name can be up to 128 characters long and can consist of any UTF-8 characters.
`description` `string` A short description of the model.
`inputTokenLimit` `integer` Maximum number of input tokens allowed for this model.
`outputTokenLimit` `integer` Maximum number of output tokens available for this model.
`supportedGenerationMethods[]` `string` The model's supported generation methods.

The corresponding API method names are defined as Pascal case strings, such as `generateMessage` and `generateContent`.
`thinking` `boolean` Whether the model supports thinking.
`temperature` `number` Controls the randomness of the output.

Values can range over `[0.0,maxTemperature]`, inclusive. A higher value will produce responses that are more varied, while a value closer to `0.0` will typically result in less surprising responses from the model. This value specifies default to be used by the backend while making the call to the model.
`maxTemperature` `number` The maximum temperature this model can use.
`topP` `number` For [Nucleus sampling](https://ai.google.dev/gemini-api/docs/prompting-strategies#top-p).

Nucleus sampling considers the smallest set of tokens whose probability sum is at least `topP`. This value specifies default to be used by the backend while making the call to the model.
`topK` `integer` For Top-k sampling.

Top-k sampling considers the set of `topK` most probable tokens. This value specifies default to be used by the backend while making the call to the model. If empty, indicates the model doesn't use top-k sampling, and `topK` isn't allowed as a generation parameter.

| JSON representation |
|---|
| ``` { "name": string, "baseModelId": string, "version": string, "displayName": string, "description": string, "inputTokenLimit": integer, "outputTokenLimit": integer, "supportedGenerationMethods": [ string ], "thinking": boolean, "temperature": number, "maxTemperature": number, "topP": number, "topK": integer } ``` |

## Method: models.predict

- [Endpoint](https://ai.google.dev/api/models#body.HTTP_TEMPLATE)
- [Path parameters](https://ai.google.dev/api/models#body.PATH_PARAMETERS)
- [Request body](https://ai.google.dev/api/models#body.request_body)
  - [JSON representation](https://ai.google.dev/api/models#body.request_body.SCHEMA_REPRESENTATION)
- [Response body](https://ai.google.dev/api/models#body.response_body)
  - [JSON representation](https://ai.google.dev/api/models#body.PredictResponse.SCHEMA_REPRESENTATION)
- [Authorization scopes](https://ai.google.dev/api/models#body.aspect)

Performs a prediction request.

### Endpoint

post `https://generativelanguage.googleapis.com/v1beta/{model=models/*}:predict`

### Path parameters

`model` `string` Required. The name of the model for prediction. Format: `name=models/{model}`. It takes the form `models/{model}`.

### Request body

The request body contains data with the following structure:
Fields `instances[]` ``value (`https://protobuf.dev/reference/protobuf/google.protobuf#value` format)`` Required. The instances that are the input to the prediction call.
`parameters` ``value (`https://protobuf.dev/reference/protobuf/google.protobuf#value` format)`` Optional. The parameters that govern the prediction call.

### Response body

Response message for \[PredictionService.Predict\].

If successful, the response body contains data with the following structure:
Fields `predictions[]` ``value (`https://protobuf.dev/reference/protobuf/google.protobuf#value` format)`` The outputs of the prediction call.

| JSON representation |
|---|
| ``` { "predictions": [ value ] } ``` |

## Method: models.predictLongRunning

- [Endpoint](https://ai.google.dev/api/models#body.HTTP_TEMPLATE)
- [Path parameters](https://ai.google.dev/api/models#body.PATH_PARAMETERS)
- [Request body](https://ai.google.dev/api/models#body.request_body)
  - [JSON representation](https://ai.google.dev/api/models#body.request_body.SCHEMA_REPRESENTATION)
- [Response body](https://ai.google.dev/api/models#body.response_body)
- [Authorization scopes](https://ai.google.dev/api/models#body.aspect)

Same as models.predict but returns an LRO.

### Endpoint

post `https://generativelanguage.googleapis.com/v1beta/{model=models/*}:predictLongRunning`

### Path parameters

`model` `string` Required. The name of the model for prediction. Format: `name=models/{model}`.

### Request body

The request body contains data with the following structure:
Fields `instances[]` ``value (`https://protobuf.dev/reference/protobuf/google.protobuf#value` format)`` Required. The instances that are the input to the prediction call.
`parameters` ``value (`https://protobuf.dev/reference/protobuf/google.protobuf#value` format)`` Optional. The parameters that govern the prediction call.

### Response body

If successful, the response body contains an instance of `https://ai.google.dev/api/batch-api#Operation`.
