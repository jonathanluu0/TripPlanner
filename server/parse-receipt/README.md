# parse-receipt — AI receipt reading (optional)

A Supabase Edge Function that reads a receipt photo with a vision model and
returns structured JSON. Two providers ship with it (Claude and OpenAI); the
prompt, JSON shape and validation are shared, so swapping models is a setting,
not a rewrite — see `providers.ts`. The app works without it: uploads use the free in-browser
reader, and this only runs when someone presses **Improve with AI** in the
review window.

**Cost per receipt** (~1,900 input + 400 output tokens):

| Provider | Model | ≈ per receipt | 30-receipt trip |
|---|---|---|---|
| `anthropic` | claude-haiku-4-5 | $0.004 | ~12¢ |
| `openai` | gpt-4.1-mini | $0.0015 | ~5¢ |

Which reads *your* receipts better is an open question — compare them below.
API credit is prepaid on both, so with auto-reload off you cannot be billed
beyond what you add.

**Who can call it:** only users signed in to your Supabase project (guests
count). The function verifies the caller's token before spending credit, so a
stranger who finds the URL gets a 401.

## Deploy

1. **Get an Anthropic API key** at console.anthropic.com, and add a small
   amount of credit ($5 goes a long way). Leave auto-reload off.

2. **Set it as a secret** (never in `.env`, never in git):

   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # or OpenAI, or both if you want to compare them:
   npx supabase secrets set OPENAI_API_KEY=sk-...
   # which one to use by default (optional; defaults to whichever key exists)
   npx supabase secrets set RECEIPT_PROVIDER=anthropic
   # override the model (optional)
   npx supabase secrets set ANTHROPIC_MODEL=claude-haiku-4-5
   npx supabase secrets set OPENAI_MODEL=gpt-4.1-mini
   ```

3. **Deploy the function:**

   ```bash
   npx supabase functions deploy parse-receipt
   ```

   No Docker needed for recent CLI versions. If yours insists on it, create the
   function in the dashboard instead (Edge Functions → Deploy a new function)
   and paste in `index.ts`.

   `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically; the
   function uses them to check the caller is signed in.

4. **Point the app at it.** In `.env` and in Vercel's environment variables:

   ```
   VITE_RECEIPT_API_URL=https://<your ref>.supabase.co/functions/v1/parse-receipt
   ```

   Restart `npm run dev` (or redeploy) and the **Improve with AI** button appears
   in the receipt review window.

## Check it works

Upload a receipt, press **Improve with AI**, and confirm the numbers improve.
Then watch your spend at console.anthropic.com → Usage. Logs are under
Supabase → Edge Functions → parse-receipt → Logs.

## Comparing the two on your own receipts

With both keys set, the same photo can be sent to either provider — the
request takes an optional `provider` field. From the app's browser console:

```js
const { getSupabase } = await import('/src/backend/supabase/client.ts');
const sb = getSupabase();
const { data: { session } } = await sb.auth.getSession();
const { data } = await sb.storage.from('receipts').createSignedUrl('<trip id>/<receipt id>.jpg', 600);
const blob = await (await fetch(data.signedUrl)).blob();
const imageBase64 = await new Promise((res) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.readAsDataURL(blob);
});

for (const provider of ['anthropic', 'openai']) {
  const res = await fetch(import.meta.env.VITE_RECEIPT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ imageBase64, mediaType: 'image/jpeg', provider }),
  });
  const out = await res.json();
  console.log(provider, out.model, 'total', out.total / 100, 'items', out.items.length, 'confidence', out.confidence);
}
```

Compare each `total` against what the receipt actually says, on 5–10 of your
own receipts. That beats any published benchmark for this decision.

## Keeping the cost near zero

- Uploads stay on the free reader; AI is opt-in per receipt.
- The photo is already shrunk to ~1600px before upload, which is most of the
  token cost.
- Spend is capped by your prepaid balance.
- If you ever want it automatic, set `VITE_RECEIPT_PARSER=claude` — then every
  upload uses Claude and falls back to the free reader if the call fails.
