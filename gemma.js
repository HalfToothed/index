// gemma.js
// Builds a compact, dated timeline for an ongoing story using Google's Gemma
// model via the Gemini API (@google/genai).
//
// The model is given ONLY the earlier Wikipedia entries for a topic and is
// asked to return one short dated point per line. The UI stitches these points
// together with arrows so the reader sees the story's progression at a glance.
// The model must not add outside knowledge, so the timeline stays grounded in
// what Wikipedia editors actually wrote.

import { GoogleGenAI } from '@google/genai';

const MODEL = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';

let client = null;

/**
 * Lazily create the GoogleGenAI client. Throws a clear error if the key is
 * missing so misconfiguration is obvious during setup rather than mid-demo.
 * @returns {GoogleGenAI}
 */
function getClient() {
  const apiKey = process.env.GEMMA_API_KEY;
  if (!apiKey) {
    throw new Error('GEMMA_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Build the prompt. We ask for a strict, line-per-date format so the output is
 * easy to parse and render as an arrow-joined timeline. Each point is a short
 * phrase (not a full sentence), labelled with its date.
 * @param {string} topic
 * @param {Array<{date: string, description: string}>} history - oldest first
 * @returns {string}
 */
function buildPrompt(topic, seedDescription, history) {
  const lines = [
    `- ${seedDescription}`,
    ...history.map((h) => `- ${h.date}: ${h.description}`),
  ].join('\n');

  return [
    `You are helping a reader understand an ongoing story: "${topic}".`,
    'Below are dated entries for this story, oldest first, ending with today.',
    '',
    'Write exactly three parts:',
    '1. WHAT: 1-2 plain sentences summarizing the pattern across all entries (not just today).',
    '2. WHY: 1 sentence on why this matters or what it signals, grounded only in the entries',
    '   (e.g. frequency, scale, who is affected) — no speculation, no new facts.',
    '3. BACKGROUND: 1-2 sentences of general context on why this conflict/situation exists,',
    '   using your own knowledge, not the entries above. Keep it neutral and factual.',
    '   If you are not confident in the historical accuracy, write exactly:',
    '   "Background context unavailable."',
    '',
    'Keep all parts neutral and factual, matching a calm, non-sensational tone.',
    'Output format exactly:',
    'WHAT: <text>',
    'WHY: <text>',
    'BACKGROUND: <text>',
    '',
    lines,
  ].join('\n');
}

/**
 * Parse the model output into WHAT/WHY/BACKGROUND parts.
 * @param {string} text
 * @returns {{what: string, why: string, background: string} | null}
 */
function parseContext(text) {
  const what = text.match(/WHAT:\s*(.+?)(?=\n(?:WHY|BACKGROUND):|$)/s);
  const why = text.match(/WHY:\s*(.+?)(?=\n(?:WHAT|BACKGROUND):|$)/s);
  const background = text.match(/BACKGROUND:\s*(.+?)(?=\n(?:WHAT|WHY):|$)/s);

  if (!what && !why && !background) return null;

  return {
    what: what ? what[1].trim() : '',
    why: why ? why[1].trim() : '',
    background: background ? background[1].trim() : '',
  };
}

/**
 * Generate a timeline for an ongoing story.
 * @param {string} topic
 * @param {Array<{date: string, description: string}>} history - oldest first
 * @returns {Promise<Array<{date: string, text: string}>>}
 */
export async function generateContext(topic, seedDescription, history) {
  if (!history || history.length === 0) return null;

  const ai = getClient();
  const prompt = buildPrompt(topic, seedDescription, history);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  });

  const text = (response.text || '').trim();
  const parsed = parseContext(text);

  if (!parsed) {
    return { what: '', why: '', background: 'Context unavailable for this story.' };
  }

  return parsed;
}
