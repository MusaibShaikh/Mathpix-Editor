import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log("AI Edit API called");

    if (!OPENROUTER_API_KEY) {
      console.error("No OpenRouter API key found");
      return NextResponse.json(
        { success: false, error: "OpenRouter API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { prompt, selectedText, fullContent } = body;

    console.log("Request data:", { prompt, hasSelectedText: !!selectedText });

    const systemPrompt = `
You are an expert technical document editor specializing in Mathpix Markdown (.mmd) files.

Rules:
1. ONLY return valid Mathpix Markdown content — no explanations, no commentary.
2. Preserve LaTeX commands, equations, chemistry formulas, and technical notation exactly unless explicitly asked.
3. If editing selected text, return ONLY the modified selection that can replace the original selection.
4. If editing the whole document, return the full modified document.
5. Maintain proper context and formatting around edited sections.
6. Do not introduce formatting errors or break document structure.
7. If the request is unclear, return: "ERROR: Please clarify your request".
8. If unsafe, return: "ERROR: This edit might damage the document formatting".
`;

    if (selectedText) {
      // For selected text, send the selection + surrounding context
      const contextBefore = fullContent.substring(0, fullContent.indexOf(selectedText)).slice(-500); // Last 500 chars before
      const contextAfter = fullContent.substring(fullContent.indexOf(selectedText) + selectedText.length).slice(0, 500); // First 500 chars after
      
      const userContent = `
Context before selection:
${contextBefore}

SELECTED TEXT TO EDIT:
${selectedText}

Context after selection:
${contextAfter}

User request: ${prompt}

Return ONLY the modified selected text that will replace the original selection.
`;

      console.log('Processing selected text with context...');

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.1,
          max_output_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("OpenRouter API error response:", errText);
        return NextResponse.json(
          { success: false, error: `OpenRouter API error: ${response.statusText}` },
          { status: response.status }
        );
      }

      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content || "";

      return NextResponse.json({
        success: true,
        editedText: aiResponse.trim(),
      });

    } else {
      // For whole document editing, use chunking but with overlap
      const maxChars = 300000; // Reduced chunk size
      const overlap = 5000; // Overlap between chunks
      
      if (fullContent.length <= maxChars) {
        // Small enough to process as one chunk
        const userContent = `Document to edit:\n${fullContent}\n\nUser request: ${prompt}`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout:free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
            temperature: 0.1,
            max_output_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          return NextResponse.json(
            { success: false, error: `OpenRouter API error: ${response.statusText}` },
            { status: response.status }
          );
        }

        const result = await response.json();
        const aiResponse = result.choices?.[0]?.message?.content || "";

        return NextResponse.json({
          success: true,
          editedText: aiResponse.trim(),
        });

      } else {
        // Document too large 
        return NextResponse.json({
          success: true,
          editedText: "ERROR: Document is too large. Please select the specific section you want to edit instead of editing the entire document.",
        });
      }
    }

  } catch (error: any) {
    console.error("AI Edit API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: `AI Edit API error: ${error.message || "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "AI Edit API is working",
    hasApiKey: !!OPENROUTER_API_KEY,
  });
}
