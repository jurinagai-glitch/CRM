/**
 * LLM-backed meeting note extraction.
 *
 * The rule-based extractor in ./extraction.ts only fires on a fixed notation
 * (課題:/予算:/決裁:/時期: lines, ➡/checkbox action items). Real notes arrive in
 * arbitrary prose, where it returns nothing. This module reads the note the way
 * a person would and returns the same ExtractionResult shape, so callers do not
 * change.
 *
 * Provider-agnostic on purpose: it speaks the OpenAI-compatible chat-completions
 * protocol, which every realistic option here supports — the free tiers (Groq,
 * Cerebras, OpenRouter) and a local Ollama alike. Switching provider is a change
 * of two env vars, not a change of code, so a free tier can be swapped for
 * another (or for a fully local model) without touching this file.
 *
 * It is optional: with no EXTRACTION_API_KEY (and no local base URL) set,
 * isLlmExtractionAvailable() is false and callers keep using the rule-based
 * path, so the app stays fully working at zero cost without any account.
 */
import "dotenv/config";
import OpenAI from "openai";
import type { ExtractionResult } from "./extraction";

const SYSTEM_PROMPT = `あなたはB2B営業の議事録を読み、CRMに登録する項目を抽出する担当者です。

抽出のルール:
- 議事録に書かれていないことは絶対に補完・推測しないこと。読み取れない項目は空文字("")または空配列にする。
- 「予算」は金額そのものだけでなく、単価・上限・予算枠の有無なども含めて記述する。
- 「決裁」は決裁者の役職・氏名だけでなく、稟議の必要性や判断材料も含めて記述する。
- 「時期」は導入希望日だけでなく、逆算した締切（提案書の期限など）も含めて記述する。
- 次アクションは、誰が読んでも実行できる具体的な行動として書く。

出力は必ず次のキーを持つJSONオブジェクトのみとし、前後に説明文を付けないこと:
{"summary": "3〜5行の箇条書き要約（各行は「・」で始める）", "decisions": ["決まったこと"], "issue": "課題", "budget": "予算", "decision_maker": "決裁", "timeline": "時期", "actions": ["次アクション"]}`;

// JSON Schema for providers that support response_format json_schema. Providers
// that only support basic JSON mode fall back to that automatically below.
const JSON_SCHEMA = {
  name: "meeting_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      decisions: { type: "array", items: { type: "string" } },
      issue: { type: "string" },
      budget: { type: "string" },
      decision_maker: { type: "string" },
      timeline: { type: "string" },
      actions: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "decisions", "issue", "budget", "decision_maker", "timeline", "actions"],
    additionalProperties: false,
  },
} as const;

export function isLlmExtractionAvailable(): boolean {
  // A key is required for hosted providers; a local Ollama needs only a base URL.
  return Boolean(process.env.EXTRACTION_API_KEY || process.env.EXTRACTION_BASE_URL);
}

type RawExtraction = {
  summary?: unknown;
  decisions?: unknown;
  issue?: unknown;
  budget?: unknown;
  decision_maker?: unknown;
  timeline?: unknown;
  actions?: unknown;
};

const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];

export async function extractWithLlm(raw: string): Promise<ExtractionResult> {
  const client = new OpenAI({
    apiKey: process.env.EXTRACTION_API_KEY || "not-needed-for-local",
    baseURL: process.env.EXTRACTION_BASE_URL || "https://api.groq.com/openai/v1",
  });
  // Groq's free tier hosts this; the Qwen line is the strongest Japanese
  // performer available there and supports strict json_schema. Production (not
  // Beta) model, so Groq's no-training terms cover it.
  const model = process.env.EXTRACTION_MODEL || "qwen/qwen3.8-27b";

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: `次の議事録から項目を抽出してください。\n\n---\n${raw}\n---` },
  ];

  // Prefer schema-constrained output; retry with plain JSON mode for providers
  // or models that reject json_schema, so one env var change can't break this.
  let content: string | null | undefined;
  try {
    const res = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 2000,
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
    });
    content = res.choices[0]?.message?.content;
  } catch {
    const res = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });
    content = res.choices[0]?.message?.content;
  }

  if (!content) throw new Error("LLM extraction returned an empty response");

  // Some models still wrap JSON in a ```json fence despite JSON mode.
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as RawExtraction;

  const issue = asText(parsed.issue);
  const budget = asText(parsed.budget);
  const decisionMaker = asText(parsed.decision_maker);
  const timeline = asText(parsed.timeline);

  const missing: string[] = [];
  if (!issue) missing.push("課題");
  if (!budget) missing.push("予算");
  if (!decisionMaker) missing.push("決裁");
  if (!timeline) missing.push("導入時期");

  return {
    summary: asText(parsed.summary) || "(内容の要約はまだ生成されていません)",
    decisions: asList(parsed.decisions),
    issue: issue || null,
    budget: budget || null,
    decision_maker: decisionMaker || null,
    timeline: timeline || null,
    unresolved: missing.length ? `${missing.join("・")}が議事録から確認できませんでした。手動で埋めてください。` : null,
    actions: asList(parsed.actions).map((description) => ({ description })),
  };
}
