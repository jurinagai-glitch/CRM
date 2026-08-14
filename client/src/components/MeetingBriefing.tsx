/**
 * Quiet Operations Desk: meeting-prep briefing assembled from real meeting summaries, deals, and knowledge.
 * Wired to /api/companies/:id/briefing.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, BookOpen, ChevronRight, Search, Send, Sparkles } from "lucide-react";
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

function MiniAvatar({ children }: { children: string }) { return <span className="mini-avatar ochre">{children}</span>; }
function StatusPill({ children }: { children: string }) { return <span className="status-pill ochre">{children}</span>; }

export default function MeetingBriefing() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
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
          <section><h3>今回、確認すること</h3>
            {briefing.to_confirm.length > 0 ? <ol>{briefing.to_confirm.map((item, i) => <li key={i}>{item}</li>)}</ol> : <p>直近の議事録から積み残しの確認事項は見つかりませんでした。</p>}
          </section>
          <section><h3>前回からの変化</h3>
            <p>{briefing.changes_since_last.length > 0 ? briefing.changes_since_last.join(" / ") : "直近2回分の承認済み議事録がまだないため、変化を比較できません。"}</p>
          </section>
          <section><h3>使えるチームの学び</h3>
            {briefing.knowledge[0] ? <div className="knowledge-reference"><BookOpen size={17} /><span><b>{briefing.knowledge[0].title}</b><small>ナレッジ：{briefing.knowledge[0].tags.join(" / ") || "タグなし"}</small></span><ArrowUpRight size={16} /></div> : <p>関連するナレッジはまだ登録されていません。</p>}
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
