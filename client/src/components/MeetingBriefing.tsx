/**
 * Quiet Operations Desk: meeting-prep briefing assembled from real meeting summaries, deals, and knowledge.
 * Wired to /api/companies/:id/briefing.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, BookOpen, ChevronRight, ExternalLink, Search, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Company = { id: string; name: string; category: string };

type BriefingData = {
  company: Company;
  deal: { name: string; stage: string; amount: number | null; expected_close_date: string | null } | null;
  latest_summary: { issue: string | null; timeline: string | null } | null;
  to_confirm: string[];
  changes_since_last: string[];
  knowledge: { id: string; title: string; tags: string[] }[];
  reference_counts: { meetings: number; proposals: number; knowledge: number };
};

type ValueCount = { value: string; count: number };

type ApproachData = {
  category: string;
  sample_size: number;
  common_issues: ValueCount[];
  common_budgets: ValueCount[];
  common_decision_makers: ValueCount[];
  common_timelines: ValueCount[];
  deal_outcomes: { stage: string; status: string; count: number }[];
};

function MiniAvatar({ children }: { children: string }) { return <span className="mini-avatar ochre">{children}</span>; }
function StatusPill({ children }: { children: string }) { return <span className="status-pill ochre">{children}</span>; }

// 会社名から候補となる検索リンクを組み立てるだけで、実際の検索・取得はブラウザ側で行う。
// 外部APIの契約や費用は一切発生しない。
function companyResearchLinks(companyName: string) {
  const searchUrl = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  return [
    { label: "コーポレートサイトを探す", href: searchUrl(`${companyName} 公式サイト`) },
    { label: "直近のプレスリリースを探す", href: searchUrl(`${companyName} プレスリリース`) },
    { label: "直近のニュースを探す", href: searchUrl(`${companyName} ニュース`) },
  ];
}

export default function MeetingBriefing() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [approach, setApproach] = useState<ApproachData | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/companies?q=${encodeURIComponent(search)}&limit=8`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies ?? []);
        if (!companyId && data.companies?.[0]) setCompanyId(data.companies[0].id);
      })
      .catch(() => toast.error("取引先の取得に失敗しました"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const loadBriefing = () => {
    if (!companyId) return;
    fetch(`/api/companies/${companyId}/briefing`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setBriefing(data))
      .catch(() => toast.error("ブリーフィングの取得に失敗しました"));
    fetch(`/api/companies/${companyId}/similar-approach`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setApproach(data))
      .catch(() => toast.error("同区分の傾向の取得に失敗しました"));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadBriefing, [companyId]);

  return <section className="screen-page briefing-page">
    <div className="page-heading">
      <div><p className="eyebrow">MEETING BRIEFING</p><h1>打ち合わせ前の、<br />迷いをなくす。</h1><p>過去の議事録、提案、チームの学びから、準備の骨子を組み立てます。</p></div>
      <Button className="ink-button" onClick={() => { loadBriefing(); toast.success("ブリーフィングを更新しました"); }}><Sparkles size={16} />更新する</Button>
    </div>
    <div className="briefing-layout">
      {briefing ? <section className="brief-document">
        <div className="brief-doc-top"><div><span className="eyebrow">PRE-MEETING NOTE</span><h2>{briefing.company.name} との打ち合わせ準備</h2></div><span>{new Date().toLocaleDateString("ja-JP")} 作成</span></div>
        {briefing.deal && <div className="brief-context">
          <MiniAvatar>{briefing.company.name.slice(0, 1)}</MiniAvatar>
          <span><b>{briefing.deal.name}</b><small>{briefing.deal.stage}ステージ{briefing.deal.expected_close_date ? `　・　受注予定 ${new Date(briefing.deal.expected_close_date).toLocaleDateString("ja-JP")}` : ""}</small></span>
          {briefing.deal.amount && <StatusPill>{`¥${Number(briefing.deal.amount).toLocaleString()}`}</StatusPill>}
        </div>}
        <div className="brief-sections">
          <section><h3>企業情報を調べる</h3>
            <p style={{ marginBottom: 8 }}>会社名から検索候補を用意しています。完全一致は保証されないため、内容は目視で確認してください。</p>
            <div className="knowledge-reference-list">
              {companyResearchLinks(briefing.company.name).map((link) => <a key={link.href} className="knowledge-reference" href={link.href} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} /><span><b>{link.label}</b></span></a>)}
            </div>
          </section>
          <section><h3>今回、確認すること</h3>
            {briefing.to_confirm.length > 0 ? <ol>{briefing.to_confirm.map((item, i) => <li key={i}>{item}</li>)}</ol> : <p>直近の議事録から積み残しの確認事項は見つかりませんでした。</p>}
          </section>
          <section><h3>前回からの変化</h3>
            <p>{briefing.changes_since_last.length > 0 ? briefing.changes_since_last.join(" / ") : "直近2回分の承認済み議事録がまだないため、変化を比較できません。"}</p>
          </section>
          <section><h3>使えるチームの学び</h3>
            {briefing.knowledge[0] ? <div className="knowledge-reference"><BookOpen size={17} /><span><b>{briefing.knowledge[0].title}</b><small>ナレッジ：{briefing.knowledge[0].tags.join(" / ") || "タグなし"}</small></span><ArrowUpRight size={16} /></div> : <p>関連するナレッジはまだ登録されていません。</p>}
          </section>
          <section><h3>同区分（{approach?.category ?? briefing.company.category}）の商談傾向</h3>
            {!approach || approach.sample_size === 0 ? <p>同区分の承認済み議事録がまだ十分にないため、傾向を示せません。</p> : <>
              <p style={{ marginBottom: 8 }}>過去 {approach.sample_size} 件の承認済み議事録から集計した、ルールベースの傾向です（AIによる生成ではありません）。</p>
              {approach.common_issues.length > 0 && <p><b>よくある課題：</b>{approach.common_issues.map((v) => `${v.value}（${v.count}件）`).join("、")}</p>}
              {approach.common_budgets.length > 0 && <p><b>予算感：</b>{approach.common_budgets.map((v) => `${v.value}（${v.count}件）`).join("、")}</p>}
              {approach.common_decision_makers.length > 0 && <p><b>決裁パターン：</b>{approach.common_decision_makers.map((v) => `${v.value}（${v.count}件）`).join("、")}</p>}
              {approach.common_timelines.length > 0 && <p><b>導入時期：</b>{approach.common_timelines.map((v) => `${v.value}（${v.count}件）`).join("、")}</p>}
              {approach.deal_outcomes.length > 0 && <p><b>商談の状況：</b>{approach.deal_outcomes.map((o) => `${o.stage}/${o.status}（${o.count}件）`).join("、")}</p>}
            </>}
          </section>
        </div>
        <div className="brief-footer">
          <span><Sparkles size={15} />参照：議事録 {briefing.reference_counts.meetings}件・提案書 {briefing.reference_counts.proposals}件・ナレッジ {briefing.reference_counts.knowledge}件</span>
          <button onClick={() => toast.info("共有機能は今後の機能です")}>共有する <Send size={15} /></button>
        </div>
      </section> : <section className="brief-document"><p className="queue-empty">取引先を選択してください。</p></section>}
      <aside className="brief-aside">
        <img src="/manus-storage/relay-briefing-collage_f67c4c69.jpg" alt="打ち合わせ準備のための紙のコラージュ" />
        <div>
          <span className="eyebrow">SELECT ACCOUNT</span><h3>準備する取引先</h3>
          <div className="knowledge-search" style={{ marginBottom: 8 }}><Search size={16} /><input aria-label="取引先を検索" placeholder="取引先名で検索" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {companies.map((c) => <button className={companyId === c.id ? "selected" : ""} onClick={() => setCompanyId(c.id)} key={c.id}>{c.name}<ChevronRight size={15} /></button>)}
          {companies.length === 0 && <p className="queue-empty">該当する取引先がありません。</p>}
        </div>
      </aside>
    </div>
  </section>;
}
