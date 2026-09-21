// Supabase Edge Function: Receipt parsing with Claude vision
// Deploy: supabase functions deploy parse-receipt
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-...

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

interface ParsedReceipt {
  merchant: string;
  date?: string;
  items: Array<{
    name: string;
    basePrice: number; // cents
    quantity: number;
  }>;
  tax: number; // cents
  tip: number; // cents
  fees: Array<{
    label: string;
    amount: number; // cents
  }>;
  total: number; // cents
  confidence: number; // 0..1
}

interface RequestBody {
  imageBase64?: string;
  mediaType?: string;
}

// Helper: convert base64 image to Anthropic image format
async function encodeImage(
  imageBase64: string,
  mediaType: string
): Promise<{
  type: "base64";
  media_type: string;
  data: string;
}> {
  return {
    type: "base64",
    media_type: mediaType || "image/jpeg",
    data: imageBase64,
  };
}

// Parse response from Claude to ensure it's valid JSON
function validateAndCoerceResponse(raw: string): ParsedReceipt {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    // If not valid JSON, try extracting JSON from text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not extract JSON from response");
    }
  }

  // Validate and coerce structure
  const obj = parsed as Record<string, unknown>;

  const result: ParsedReceipt = {
    merchant: String(obj.merchant || "Unknown"),
    date: obj.date ? String(obj.date) : undefined,
    items: Array.isArray(obj.items)
      ? obj.items.map((item: unknown) => {
          const i = item as Record<string, unknown>;
          return {
            name: String(i.name || "Item"),
            basePrice: parseInt(String(i.basePrice || 0), 10),
            quantity: parseInt(String(i.quantity || 1), 10),
          };
        })
      : [],
    tax: parseInt(String(obj.tax || 0), 10),
    tip: parseInt(String(obj.tip || 0), 10),
    fees: Array.isArray(obj.fees)
      ? obj.fees.map((fee: unknown) => {
          const f = fee as Record<string, unknown>;
          return {
            label: String(f.label || "Fee"),
            amount: parseInt(String(f.amount || 0), 10),
          };
        })
      : [],
    total: parseInt(String(obj.total || 0), 10),
    confidence:
      typeof obj.confidence === "number" ? obj.confidence : 0.8,
  };

  return result;
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-1-vision-20250714";

    let imageBase64: string;
    let mediaType: string;

    // Handle both multipart and JSON request formats
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Parse multipart form
      const formData = await req.formData();
      const file = formData.get("image") as File;
      if (!file) {
        throw new Error("No image field in multipart request");
      }

      mediaType = file.type || "image/jpeg";
      const arrayBuffer = await file.arrayBuffer();
      imageBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    } else {
      // Parse JSON
      const body = (await req.json()) as RequestBody;
      imageBase64 = body.imageBase64 || "";
      mediaType = body.mediaType || "image/jpeg";

      if (!imageBase64) {
        throw new Error("No imageBase64 in request body");
      }
    }

    // Call Anthropic API with vision
    const imagePayload = await encodeImage(imageBase64, mediaType);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: imagePayload,
              },
              {
                type: "text",
                text: `Extract receipt data from this image and return a JSON object with NO ADDITIONAL TEXT.
Strict schema: {
  "merchant": "string (business name)",
  "date": "string (ISO date YYYY-MM-DD or null)",
  "items": [
    {"name": "item name", "basePrice": number (cents, integer), "quantity": number (integer)}
  ],
  "tax": number (cents, integer),
  "tip": number (cents, integer),
  "fees": [
    {"label": "fee description", "amount": number (cents, integer)}
  ],
  "total": number (printed total in cents, integer),
  "confidence": number (0.0 to 1.0, your confidence in accuracy)
}

Guidelines:
- ALL PRICES IN CENTS (multiply dollars by 100)
- Items: extract line item name, unit price, and quantity
- Tax: if not itemized, estimate or 0
- Tip: line-item tip amount or 0
- Fees: service charges, delivery, resort fees, etc.
- Confidence: how sure you are (0.8+ for clear receipts)
- Return ONLY valid JSON, no markdown, no extra text`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error: ${anthropicRes.status} ${errText}`);
    }

    interface AnthropicMessage {
      content: Array<{
        type: string;
        text?: string;
      }>;
    }

    const anthropicData = (await anthropicRes.json()) as AnthropicMessage;
    const textContent = anthropicData.content.find(
      (c: { type: string; text?: string }) => c.type === "text"
    );
    if (!textContent || !textContent.text) {
      throw new Error("No text response from Anthropic");
    }

    // Validate and coerce the response
    const parsed = validateAndCoerceResponse(textContent.text);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
});
