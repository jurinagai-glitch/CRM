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
  issue: /^[#・\s]*課題[:：](.+)$/,
  budget: /^[#・\s]*予算[:：](.+)$/,
  decision_maker: /^[#・\s]*決裁[:：](.+)$/,
  timeline: /^[#・\s]*(?:時期|導入時期)[:：](.+)$/,
};

// A markdown-style header line naming a field with no value on the same line
// (e.g. "### 課題" followed by the content on the next line(s)) — common in
// notes exported from other note-taking tools.
const HEARING_HEADER: Record<"issue" | "budget" | "decision_maker" | "timeline", RegExp> = {
  issue: /^#{1,6}\s*課題\s*$/,
  budget: /^#{1,6}\s*予算\s*$/,
  decision_maker: /^#{1,6}\s*決裁(?:者)?\s*$/,
  timeline: /^#{1,6}\s*(?:時期|導入時期)\s*$/,
};

const ACTION_PREFIX = /^[・\s]*[➡→]\s*(.+)$/;
// Markdown checkbox list items ("- [ ] " / "-[x] " / "* [ ] "), open or checked.
const CHECKBOX_ACTION_PREFIX = /^[-*]\s*\[[ xX]\]\s*(.+)$/;
const DECISION_PREFIX = /^[・\s]*決定[:：](.+)$/;
// A bare markdown header not naming a hearing field — used to detect the end
// of a header-triggered field's content block.
const ANY_HEADER = /^#{1,6}\s*(.+)$/;

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
  let pendingHeaderField: keyof typeof HEARING_HEADER | null = null;
  let pendingHeaderContent: string[] = [];

  const flushPendingHeader = () => {
    if (pendingHeaderField && pendingHeaderContent.length) {
      result[pendingHeaderField] = pendingHeaderContent.join(" ").trim();
    }
    pendingHeaderField = null;
    pendingHeaderContent = [];
  };

  for (const line of lines) {
    let matched = false;
    for (const [key, pattern] of Object.entries(HEARING_PATTERNS) as [keyof typeof HEARING_PATTERNS, RegExp][]) {
      const m = line.match(pattern);
      if (m) {
        flushPendingHeader();
        result[key] = m[1].trim();
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const headerFieldMatch = (Object.entries(HEARING_HEADER) as [keyof typeof HEARING_HEADER, RegExp][]).find(([, pattern]) => pattern.test(line));
    if (headerFieldMatch) {
      flushPendingHeader();
      pendingHeaderField = headerFieldMatch[0];
      continue;
    }

    const actionMatch = line.match(ACTION_PREFIX) ?? line.match(CHECKBOX_ACTION_PREFIX);
    if (actionMatch) {
      flushPendingHeader();
      result.actions.push({ description: actionMatch[1].trim() });
      continue;
    }

    const decisionMatch = line.match(DECISION_PREFIX);
    if (decisionMatch) {
      flushPendingHeader();
      result.decisions.push(decisionMatch[1].trim());
      continue;
    }

    if (pendingHeaderField) {
      if (ANY_HEADER.test(line)) {
        flushPendingHeader();
      } else {
        pendingHeaderContent.push(line);
        continue;
      }
    }

    bodyLines.push(line);
  }
  flushPendingHeader();

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
