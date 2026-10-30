import { handleOcr } from '../server/ocrHandler.js'

// Vercel Serverless Function handler for /api/ocr
export default async function handler(req, res) {
  // Pass process.env which includes OPENAI_API_KEY, OCR_MODEL, etc.
  return handleOcr(req, res, process.env)
}
