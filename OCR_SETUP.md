# AI image reader: setup and testing

Image upload (the purple "Scan Image" buttons) on Stock (raw material + coal), Item Transfers, Production, Production 2,
Sauda Sale and Sauda Purchase goes to `POST /api/ocr` (`server/ocrHandler.js`), which calls OpenAI with a per-page JSON schema
(`server/schemas.js`). The OpenAI key is only ever on the server, never in the browser bundle.

## Environment variables (server side, never `VITE_`-prefixed)
Put them in `.env.local` (git-ignored). `.env` is committed, so do not put the key there.

| Name | Default | Meaning |
|---|---|---|
| `OPENAI_API_KEY` | required | OpenAI key |
| `OCR_MODEL` | `gpt-5.6-sol` | model that reads the image |
| `OCR_EFFORT` | unset | optional `reasoning_effort` (e.g. `low`) if calls are too slow |
| `OCR_VERIFY` | off | `on` adds a second AI pass (`OCR_VERIFY_MODEL`, default `gpt-5.6-terra`) that re-checks every value against the image |

## Running
- Local: `npm run dev` (the Vite dev server serves `/api/ocr`; restart after changing `.env.local`).
- Vercel: `api/ocr.js` + `vercel.json` (`maxDuration` 60 s; the AI call takes 10-25 s, longer on poor photos).
  Set `OPENAI_API_KEY` (and optionally `OCR_MODEL`, `OCR_VERIFY`) in the Vercel project's environment variables and redeploy.
  The browser downsizes uploads to stay under the ~4.5 MB request limit.
- Other hosting: `node server/index.js` (port 8787) and proxy `/api/ocr` to it.

## How a scan flows
1. Browser checks blur / resolution / contrast (`src/utils/imageQuality.js`) and downsizes the image (`src/utils/aiOcr.js`).
2. `/api/ocr` reads the image with the page's schema, then `sanitize()` cleans the output (numbers only, dates -> `YYYY-MM-DD`,
   look-alike letters -> Latin) and `crossChecks()` warns when figures do not add up.
3. `AiResultModal` shows the result, quality warnings and arithmetic warnings; nothing is changed until the user clicks "Apply to page".
4. The page then fills its normal preview / form (same rows the CSV import builds); the user reviews and saves as before.

The Sauda Sale / Sauda Purchase schemas here carry this app's extra columns (Size, Consignee, Broker, Terms of Delivery,
Payment Condition, Reference Name, Remark). The sheets' "Expire Date" column is not captured because the app has no field for it.

## Testing
1. Offline (no key): `npm run test:ocr:offline` (cleaning, cross-checks, schema shape).
2. With a key: `npm run test:ocr:images` runs every image in `Testing_Images/` through the real handler, prints the rows it read
   plus warnings, and writes JSON to `tools/ocr-test/out/` (git-ignored). Compare the printed rows with the images.
3. Always try a few real photos from the plant, not only screenshots. Digits read from a blurry photo can look right and be wrong,
   which is why the review modal only ever says "Read by AI - please review".
