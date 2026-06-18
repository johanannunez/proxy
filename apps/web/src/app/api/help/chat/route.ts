import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const SYSTEM_PROMPT = `You are a helpful assistant for Proxy, a property management platform for rental property owners. Answer questions using ONLY the provided help articles. Be concise and helpful. If the articles do not cover the question, say so and suggest contacting hello@myproxyhost.com. Never make up information.`;

export async function POST(request: NextRequest) {
  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Search for relevant articles
  const { data: articles } = await service.rpc("search_help_articles", {
    search_query: message,
    max_results: 5,
  });

  const relevantArticles = (articles ?? []) as unknown as Array<{
    id: string;
    title: string;
    slug: string;
    summary: string;
    content: string;
    category_name?: string;
  }>;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Fallback: no API key, return article list
  if (!apiKey) {
    if (relevantArticles.length === 0) {
      return NextResponse.json({
        response:
          "I could not find any articles matching your question. Please contact us at hello@myproxyhost.com for further assistance.",
        articles: [],
      });
    }

    const articleList = relevantArticles
      .map((a) => `- ${a.title}: /help/${a.slug}`)
      .join("\n");

    return NextResponse.json({
      response: `Here are some articles that may help:\n\n${articleList}\n\nIf none of these answer your question, reach out to hello@myproxyhost.com.`,
      articles: relevantArticles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
      })),
    });
  }

  // Build context from article contents
  const context = relevantArticles
    .map(
      (a, i) =>
        `Article ${i + 1}: ${a.title}\nCategory: ${a.category_name ?? "General"}\nSummary: ${a.summary ?? ""}\n\n${a.content ?? ""}`,
    )
    .join("\n\n---\n\n");

  const userMessage = context
    ? `Context from help articles:\n\n${context}\n\n---\n\nUser question: ${message}`
    : `No relevant help articles were found. User question: ${message}`;

  // Stream response from Claude
  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    console.error("[help/chat] Anthropic API error:", errorText);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
  }

  // Stream the response back to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta"
              ) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
                );
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        console.error("[help/chat] Stream error:", err);
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
