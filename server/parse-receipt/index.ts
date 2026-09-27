// Supabase Edge Function: read a receipt photo with a vision model.
//
// Deploy:  supabase functions deploy parse-receipt
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (or OPENAI_API_KEY=sk-...)
//
// Provider is pluggable (see providers.ts): Claude Haiku 4.5 (~$0.004/receipt)
// or GPT-4.1 mini (~$0.0015/receipt). Set RECEIPT_PROVIDER, or pass
// {"provider":"openai"} in the request to compare them on the same photo.
//
// Only users signed in to this Supabase project can call it — the caller's
// token is checked before any credit is spent, so a stranger who finds the URL
// gets a 401.

import { ProviderError, selectProvider } from "./providers.ts";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // ~4.5MB of base64

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

interface ParsedItem {
  name: string;
  basePrice: number;
  quantity: number;
  extras?: Array<{ label: string; amount: number }>;
}

interface ParsedReceipt {
  merchant: string;
  date?: string;
  items: ParsedItem[];
  tax: number;
  tip: number;
  fees: Array<{ label: string; amount: number }>;
  total: number;
  confidence: number;
}

const PROMPT = `Read this receipt and return ONLY a JSON object, no other text.

{
  "merchant": "business name",
  "date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "item name as printed",
      "basePrice": 0,
      "quantity": 1,
      "extras": [{ "label": "add-on or discount", "amount": 0 }]
    }
  ],
  "tax": 0,
  "tip": 0,
  "fees": [{ "label": "service fee / delivery / resort fee", "amount": 0 }],
  "total": 0,
  "confidence": 0.0
}

Rules:
- EVERY amount is an integer number of CENTS. $12.34 is 1234.
- "total" is the total actually printed on the receipt (the amount charged),
  not a sum you compute. If no total is printed, use 0.
- Discounts, coupons and "you saved" lines belong in the "extras" of the item
  they apply to, as NEGATIVE amounts. Never list them as separate items.
- Add-ons that increase an item's price (extra shot, guacamole) are positive extras.
- Ignore subtotal, change, cash/card/auth lines and loyalty points.
- "confidence" is your own honest estimate (0–1) of how accurately you read it;
  use a low value when the print is unclear or cut off.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await requireSignedInUser(req);

    const { imageBase64, mediaType, provider: requested } = await readImage(req);
    const provider = selectProvider(requested);
    const raw = await provider.read({ imageBase64, mediaType, prompt: PROMPT });
    const parsed = coerce(raw);
    return json({ ...parsed, model: provider.model, provider: provider.name }, 200);
  } catch (err) {
    const status = err instanceof HttpError || err instanceof ProviderError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("parse-receipt failed:", message);
    return json({ error: message }, status);
  }
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `${name} is not set on this function`);
  return value;
}

/**
 * Only users signed in to this Supabase project may call the function —
 * otherwise the URL alone would let anyone spend your Anthropic credit.
 * Guests count: an anonymous sign-in is still a real user.
 */
async function requireSignedInUser(req: Request): Promise<void> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in to scan receipts");

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!res.ok) throw new HttpError(401, "Your session has expired — reload and try again");
}

async function readImage(req: Request): Promise<{ imageBase64: string; mediaType: string; provider?: string }> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) throw new HttpError(400, "No image in the request");
    return { imageBase64: await toBase64(await file.arrayBuffer()), mediaType: file.type || "image/jpeg" };
  }

  const body = await req.json() as { imageBase64?: string; mediaType?: string; provider?: string };
  if (!body.imageBase64) throw new HttpError(400, "No imageBase64 in the request");
  if (body.imageBase64.length > MAX_IMAGE_BYTES) throw new HttpError(413, "That photo is too large");
  return { imageBase64: body.imageBase64, mediaType: body.mediaType || "image/jpeg", provider: body.provider };
}

/** Chunked so a large image doesn't blow the call stack. */
async function toBase64(buffer: ArrayBuffer): Promise<string> {
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, "That photo is too large");
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

/** The model is asked for strict JSON; this makes sure we can trust what we got. */
function coerce(raw: string): ParsedReceipt {
  const jsonText = raw.trim().startsWith("{") ? raw : raw.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new HttpError(502, "Could not read the receipt");

  const obj = JSON.parse(jsonText) as Record<string, unknown>;
  const cents = (value: unknown): number => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? n : 0;
  };

  return {
    merchant: String(obj.merchant ?? ""),
    date: obj.date ? String(obj.date) : undefined,
    items: asArray(obj.items).map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        name: String(item.name ?? "Item"),
        basePrice: cents(item.basePrice),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        extras: asArray(item.extras).map((rawExtra) => {
          const extra = rawExtra as Record<string, unknown>;
          return { label: String(extra.label ?? "Extra"), amount: cents(extra.amount) };
        }),
      };
    }),
    tax: cents(obj.tax),
    tip: cents(obj.tip),
    fees: asArray(obj.fees).map((rawFee) => {
      const fee = rawFee as Record<string, unknown>;
      return { label: String(fee.label ?? "Fee"), amount: cents(fee.amount) };
    }),
    total: cents(obj.total),
    confidence: typeof obj.confidence === "number" ? Math.min(1, Math.max(0, obj.confidence)) : 0.8,
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
