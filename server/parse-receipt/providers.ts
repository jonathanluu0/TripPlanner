// Vision providers for receipt reading.
//
// Everything about *what* we ask for (the prompt, the JSON shape, validation)
// lives in index.ts and is shared. A provider only knows how to send one image
// plus one prompt to its API and hand back the raw text it replied with, so
// adding another (Gemini, a local model) is a small function, not a rewrite.

export type ProviderName = "anthropic" | "openai";

export interface VisionRequest {
  imageBase64: string;
  mediaType: string;
  prompt: string;
}

export interface VisionProvider {
  name: ProviderName;
  /** Model actually used, for logging and the receipt's record. */
  model: string;
  /** Returns the model's raw reply; the caller parses and validates it. */
  read(req: VisionRequest): Promise<string>;
}

class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4.1-mini",
};

/**
 * Picks the provider: the caller may ask for one (handy for comparing them on
 * the same receipt), otherwise RECEIPT_PROVIDER, otherwise whichever key is set.
 */
export function selectProvider(requested?: string): VisionProvider {
  const name = (requested || Deno.env.get("RECEIPT_PROVIDER") || autodetect()) as ProviderName;
  if (name === "openai") return openai();
  if (name === "anthropic") return anthropic();
  throw new ProviderError(400, `Unknown receipt provider "${name}"`);
}

function autodetect(): ProviderName {
  if (Deno.env.get("ANTHROPIC_API_KEY")) return "anthropic";
  if (Deno.env.get("OPENAI_API_KEY")) return "openai";
  throw new ProviderError(500, "No receipt-reading API key is set on this function");
}

function requireKey(name: string): string {
  const key = Deno.env.get(name);
  if (!key) throw new ProviderError(500, `${name} is not set on this function`);
  return key;
}

function anthropic(): VisionProvider {
  const model = Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODELS.anthropic;
  return {
    name: "anthropic",
    model,
    async read({ imageBase64, mediaType, prompt }) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": requireKey("ANTHROPIC_API_KEY"),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: prompt },
            ],
          }],
        }),
      });
      const body = await expectOk(res, "anthropic");
      return (body.content as Array<{ text?: string }> ?? []).map((part) => part.text ?? "").join("");
    },
  };
}

function openai(): VisionProvider {
  const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODELS.openai;
  return {
    name: "openai",
    model,
    async read({ imageBase64, mediaType, prompt }) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${requireKey("OPENAI_API_KEY")}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          // Ask for JSON explicitly; the prompt describes the shape.
          response_format: { type: "json_object" },
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            ],
          }],
        }),
      });
      const body = await expectOk(res, "openai");
      const choices = body.choices as Array<{ message?: { content?: string } }> ?? [];
      return choices[0]?.message?.content ?? "";
    },
  };
}

async function expectOk(res: Response, provider: string): Promise<Record<string, unknown>> {
  if (!res.ok) {
    const detail = await res.text();
    console.error(`${provider} error:`, res.status, detail.slice(0, 500));
    // Don't leak the provider's message (it can contain key details) — but a
    // 401 there is our misconfiguration, not the caller's fault.
    throw new ProviderError(res.status === 401 ? 500 : 502, "The receipt reader is unavailable right now");
  }
  return await res.json() as Record<string, unknown>;
}

export { ProviderError };
