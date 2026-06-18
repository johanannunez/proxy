import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a property management document specialist for short-term rental co-hosting companies. Create professional, client-facing document templates for property owners and managers.

Return ONLY a JSON object with this exact structure:
{
  "templateName": "Human-readable document name",
  "documentKey": "snake_case_key",
  "description": "One to two client-facing sentences: what this document is for and why the owner benefits from signing it. Write directly to the property owner (e.g. 'This agreement establishes...'). No internal jargon.",
  "signerRoles": ["Owner", "Proxy"],
  "gateStep": "Agreement (step 1)",
  "documentBody": "Full document in markdown format"
}

Rules for documentBody (CRITICAL — follow exactly):
- Write in proper markdown. Use ## for major section headers, ### for subsections.
- Use **bold** for key terms, defined roles, and important obligations on first use.
- Use _italics_ for emphasis (amounts, dates, thresholds that vary per owner).
- Do NOT repeat the document title at the top — start immediately with the parties clause or an intro paragraph.
- For signature lines: use a horizontal rule (---) followed by a clear label: "**Owner Signature** ___________________________ Date ___________". Never use placeholder dashes for signatures.
- 500-750 words. Write in plain legal English — clear and enforceable, not verbose.
- Include a numbered list for obligations when 3 or more items apply.
- End with a Signatures section that labels each party by their role (Owner, Co-Host / Property Manager, etc.).

Additional rules:
- signerRoles: array from ["Owner", "Proxy", "Guest", "Vendor"]. Usually ["Owner", "Proxy"].
- gateStep: one of "Agreement (step 1)", "Onboarding (step 2)", "Pre-listing (step 3)".
- documentKey: snake_case version of templateName, lowercase only.
- Respond with ONLY the JSON object. No markdown fences around the outer JSON. No explanation.`;

export async function POST(req: NextRequest) {
  const { prompt, chips } = await req.json() as {
    prompt: string;
    chips: { state: string; signers: string; category: string };
  };

  const apiKey = process.env.OPENROUTER_API_PROXY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  const contextLines = [
    `Create a property management document: ${prompt}`,
    chips?.state && chips.state !== "" ? `Property state: ${chips.state}` : "",
    chips?.signers ? `Who signs: ${chips.signers}` : "",
    chips?.category ? `Document category: ${chips.category}` : "",
  ].filter(Boolean).join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.myproxyhost.com",
      "X-Title": "Proxy Template Generator",
    },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4-5",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextLines },
      ],
      temperature: 0.4,
      max_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[generate-template] OpenRouter error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content as string | undefined;

  if (!content) {
    return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Invalid AI response format" }, { status: 502 });
  }
}
