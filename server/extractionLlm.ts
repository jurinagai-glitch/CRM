/**
 * LLM-backed meeting note extraction.
 *
 * The rule-based extractor in ./extraction.ts only fires on a fixed notation
 * (課題:/予算:/決裁:/時期: lines, ➡/checkbox action items). Real notes arrive in
 * arbitrary prose, where it returns nothing. This module reads the note the way
 * a person would and returns the same ExtractionResult shape, so callers do not
 * change.
 *
 * It is optional: with no ANTHROPIC_API_KEY set, isLlmExtractionAvailable() is
 * false and callers keep using the rule-based path. That keeps the app fully
 * working (and free) without a key.
 */
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ExtractionResult } from "./extraction";

// Small, fast, and empirically sufficient for this extraction: a free-prose
// Japanese sales note with no field labels still yielded correct 課題/予算/決裁/
// 時期 and every action item. Override with EXTRACTION_MODEL if needed.
const DEFAULT_MODEL = "claude-haiku-4-5";

const ExtractionSchema = z.object({
  summary: z.string().describe("商談内容の要約。3〜5行の箇条書き（各行は「・」で始める）"),
  decisions: z.array(z.string()).describe("この商談で決まったこと。決定事項がなければ空配列"),
  issue: z.string().describe("顧客が抱えている課題。読み取れなければ空文字"),
  budget: z.string().describe("予算・金額の情報。読み取れなければ空文字"),
  decision_maker: z.string().describe("決裁者・決裁プロセス。読み取れなければ空文字"),
  timeline: z.string().describe("導入時期・スケジュール。読み取れなければ空文字"),
  actions: z.array(z.string()).describe("次にやるべきアクション。担当や期限は文中に含めてよい"),
});

const SYSTEM_PROMPT = `あなたはB2B営業の議事録を読み、CRMに登録する項目を抽出する担当者です。

抽出のルール:
- 議事録に書かれていないことは絶対に補完・推測しないこと。読み取れない項目は空文字または空配列にする。
- 「予算」は金額そのものだけでなく、単価・上限・予算枠の有無なども含めて記述する。
- 「決裁」は決裁者の役職・氏名だけでなく、稟議の必要性や判断材料も含めて記述する。
- 「時期」は導入希望日だけでなく、逆算した締切（提案書の期限など）も含めて記述する。
- 次アクションは、誰が読んでも実行できる具体的な行動として書く。`;

export function isLlmExtractionAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractWithLlm(raw: string): Promise<ExtractionResult> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: process.env.EXTRACTION_MODEL || DEFAULT_MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `次の議事録から項目を抽出してください。\n\n---\n${raw}\n---` }],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("LLM extraction returned no parsable output");

  const blank = (v: string) => (v.trim() ? v.trim() : null);
  const missing: string[] = [];
  if (!blank(parsed.issue)) missing.push("課題");
  if (!blank(parsed.budget)) missing.push("予算");
  if (!blank(parsed.decision_maker)) missing.push("決裁");
  if (!blank(parsed.timeline)) missing.push("導入時期");

  return {
    summary: parsed.summary.trim() || "(内容の要約はまだ生成されていません)",
    decisions: parsed.decisions.filter((d) => d.trim()),
    issue: blank(parsed.issue),
    budget: blank(parsed.budget),
    decision_maker: blank(parsed.decision_maker),
    timeline: blank(parsed.timeline),
    unresolved: missing.length ? `${missing.join("・")}が議事録から確認できませんでした。手動で埋めてください。` : null,
    actions: parsed.actions.filter((a) => a.trim()).map((description) => ({ description: description.trim() })),
  };
}
