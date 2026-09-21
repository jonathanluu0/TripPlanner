# Receipt Parser — Supabase Edge Function

Claude vision-based receipt parsing via Supabase Edge Functions (Deno).

## What it does

- Accepts an image (multipart or base64 JSON).
- Calls Anthropic API with Claude vision model.
- Returns structured JSON: merchant, date, items, tax, tip, fees, total, confidence.
- All prices in cents (integer).

## Prerequisites

- [Supabase CLI](https://github.com/supabase/cli)
- [Anthropic API key](https://console.anthropic.com/)
- Existing Supabase project

## Deployment

### 1. Set up Anthropic secret

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Optionally set a custom model (defaults to `claude-opus-4-1-vision-20250714`):

```bash
supabase secrets set ANTHROPIC_MODEL=claude-opus-4-1-vision-20250714
```

### 2. Deploy the function

```bash
supabase functions deploy parse-receipt
```

### 3. Test locally (optional)

```bash
supabase functions serve
```

Then POST to `http://localhost:54321/functions/v1/parse-receipt`:

```bash
curl -X POST http://localhost:54321/functions/v1/parse-receipt \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "<base64-encoded-image>",
    "mediaType": "image/jpeg"
  }'
```

## Request formats

### JSON (recommended for web clients)

```json
POST /functions/v1/parse-receipt
Content-Type: application/json

{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "mediaType": "image/jpeg"
}
```

### Multipart form

```bash
curl -X POST https://<project>.supabase.co/functions/v1/parse-receipt \
  -H "Authorization: Bearer <anon_key>" \
  -F "image=@receipt.jpg"
```

## Response

```json
{
  "merchant": "Chipotle",
  "date": "2025-09-20",
  "items": [
    { "name": "Chicken Bowl", "basePrice": 950, "quantity": 1 },
    { "name": "Guacamole", "basePrice": 250, "quantity": 1 }
  ],
  "tax": 130,
  "tip": 200,
  "fees": [],
  "total": 1530,
  "confidence": 0.95
}
```

## Error responses

```json
{
  "error": "ANTHROPIC_API_KEY not set"
}
```

```json
{
  "error": "Could not extract JSON from response"
}
```

## Integration in the app

Call this function from `src/features/receipts/parsers/claude.ts`:

```ts
// parsers/claude.ts
import type { ParsedReceipt } from '../../types';

export async function parseWithClaude(
  file: File,
  apiUrl: string
): Promise<ParsedReceipt> {
  const reader = new FileReader();
  reader.readAsDataURL(file);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

  const base64 = dataUrl.split(',')[1];
  const mediaType = file.type || 'image/jpeg';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mediaType }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Receipt parsing failed');
  }

  return res.json();
}
```

## Environment variables (in `.env`)

```
VITE_RECEIPT_PARSER=claude
VITE_RECEIPT_API_URL=https://<project>.supabase.co/functions/v1/parse-receipt
```

## Cost estimate

- Anthropic API: ~$0.01 USD per receipt with Claude vision.
- For 100 receipts/month: ~$1.

## Debugging

If the function fails:

1. Check logs: `supabase functions list` then `supabase functions fetch-logs parse-receipt`
2. Ensure ANTHROPIC_API_KEY is set: `supabase secrets list`
3. Test locally with `supabase functions serve`.
4. Verify image format (JPEG, PNG, GIF, WebP supported).
