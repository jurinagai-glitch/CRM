/**
 * Rule-based meeting note extraction (free-tier MVP, no external AI call).
 * Real historical notes already used this pattern (課題:/予算:/決裁:/時期: lines,
 * and "➡"-prefixed next steps), so this is not an artificial format — it matches
 * how the team already writes notes. Swap this module out for a real LLM call
 * once an API key is available; callers only depend on ExtractionResult's shape.
 */

export type ExtractedAction = { description: string };

export type ExtractionResult = {
  summary: string;
  decisions: string[];
  issue: string | null;
  budget: string | null;
  decision_maker: string | null;
  timeline: string | null;
  unresolved: string | null;
  actions: ExtractedAction[];
};

const HEARING_PATTERNS: Record<"issue" | "budget" | "decision_maker" | "timeline", RegExp> = {
  issue: /^[・\s]*課題[:：](.+)$/,
  budget: /^[・\s]*予算[:：](.+)$/,
  decision_maker: /^[・\s]*決裁[:：](.+)$/,
  timeline: /^[・\s]*時期[:：](.+)$/,
};

const ACTION_PREFIX = /^[・\s]*[➡→]\s*(.+)$/;
const DECISION_PREFIX = /^[・\s]*決定[:：](.+)$/;

export function extractFromText(raw: string): ExtractionResult {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const result: ExtractionResult = {
    summary: "",
    decisions: [],
    issue: null,
    budget: null,
    decision_maker: null,
    timeline: null,
    unresolved: null,
    actions: [],
  };

  const bodyLines: string[] = [];

  for (const line of lines) {
    let matched = false;
    for (const [key, pattern] of Object.entries(HEARING_PATTERNS) as [keyof typeof HEARING_PATTERNS, RegExp][]) {
      const m = line.match(pattern);
      if (m) {
        result[key] = m[1].trim();
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const actionMatch = line.match(ACTION_PREFIX);
    if (actionMatch) {
      result.actions.push({ description: actionMatch[1].trim() });
      continue;
    }

    const decisionMatch = line.match(DECISION_PREFIX);
    if (decisionMatch) {
      result.decisions.push(decisionMatch[1].trim());
      continue;
    }

    bodyLines.push(line);
  }

  // summary: first two body lines (that aren't hearing items/actions), truncated
  result.summary = bodyLines.slice(0, 2).join(" ").slice(0, 200) || "(内容の要約はまだ生成されていません)";

  const missing: string[] = [];
  if (!result.issue) missing.push("課題");
  if (!result.budget) missing.push("予算");
  if (!result.decision_maker) missing.push("決裁");
  if (!result.timeline) missing.push("導入時期");
  result.unresolved = missing.length ? `${missing.join("・")}が議事録から確認できませんでした。手動で埋めてください。` : null;

  return result;
}
