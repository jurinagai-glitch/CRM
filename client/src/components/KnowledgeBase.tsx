/**
 * Quiet Operations Desk: team knowledge, searchable by tag and free text.
 * Wired to /api/knowledge-items.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

type Objection = { objection: string; response: string };

type KnowledgeItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  tags: string[];
  source_company_id: string | null;
  source_company_name: string | null;
  created_at: string;
  business_type: string | null;
  approach: string | null;
  objections: Objection[];
  decision_process: string | null;
  price_expectation: string | null;
  competitors: string | null;
  market_status: string | null;
  source_note_count: number;
  generated_model: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

const TOPIC_FILTERS = ["初回商談", "課題探索", "価格・競合", "提案設計"];

function Playbook({ item, onReviewed }: { item: KnowledgeItem; onReviewed: () => void }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    const ok = await apiRequest(`/api/knowledge-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed: true }),
    });
    setBusy(false);
    if (!ok) return;
    toast.success("確認済みにしました");
    onReviewed();
  };

  return <article className="playbook">
    <header>
      <div>
        <span className="eyebrow">PLAYBOOK</span>
        <h3>{item.title}</h3>
      </div>
      {item.reviewed_at
        ? <span className="status-pill moss">{item.reviewed_by}が確認済み</span>
        : <span className="status-pill ochre">AI下書き・未確認</span>}
    </header>
    {item.body && <p className="playbook-alert">{item.body}</p>}
    {item.approach && <section><h4>刺さる切り口</h4><p>{item.approach}</p></section>}
    {item.objections?.length > 0 && <section>
      <h4>よく言われること と 返し方</h4>
      {item.objections.map((o, i) => <div className="objection" key={i}>
        <p className="objection-said">「{o.objection}」</p>
        {o.response && <p className="objection-reply">→ {o.response}</p>}
      </div>)}
    </section>}
    {item.decision_process && <section><h4>決裁の通り方</h4><p>{item.decision_process}</p></section>}
    {item.price_expectation && <section><h4>相場観</h4><p>{item.price_expectation}</p></section>}
    {item.competitors && <section><h4>競合</h4><p>{item.competitors}</p></section>}
    {item.market_status && <section><h4>この業種の現状</h4><p>{item.market_status}</p></section>}
    <footer>
      <span>商談記録{item.source_note_count}件から作成{item.generated_model ? `（${item.generated_model}）` : ""}</span>
      {!item.reviewed_at && <Button className="ink-button" onClick={confirm} disabled={busy}>{busy ? "確認中..." : "内容を確認した"}</Button>}
    </footer>
  </article>;
}

function StatusPill({ children }: { children: string }) {
  return <span className="status-pill">{children}</span>;
}

export default function KnowledgeBase() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", tags: "" });

  const load = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (activeTag) params.set("tag", activeTag);
    apiRequest<{ items: KnowledgeItem[] }>(`/api/knowledge-items?${params.toString()}`).then((data) => setItems(data?.items ?? []));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [activeTag]);

  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const createItem = async () => {
    if (!form.title.trim()) return toast.error("タイトルを入力してください");
    const tags = form.tags.split(/[、,]/).map((t) => t.trim()).filter(Boolean);
    const result = await apiRequest("/api/knowledge-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, body: form.body || null, tags }),
    });
    if (!result) return;
    setForm({ title: "", body: "", tags: "" });
    setShowForm(false);
    load();
    toast.success("ナレッジを登録しました");
  };

  return <section className="screen-page knowledge-page">
    <div className="page-heading">
      <div><p className="eyebrow">TEAM KNOWLEDGE</p><h1>次の商談で使える、<br />チームの学び。</h1><p>個人の経験を、文脈付きで誰でも使えるナレッジに変えます。</p></div>
      <Button className="ink-button" onClick={() => setShowForm((v) => !v)}><Plus size={16} />ナレッジを登録</Button>
    </div>
    {showForm && <section className="conversion-sheet" style={{ marginBottom: 16 }}>
      <div className="conversion-grid">
        <label>タイトル<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>タグ（読点区切り）<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="価格、切り返し" /></label>
        <label style={{ gridColumn: "1 / -1" }}>内容<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} placeholder="商談の背景、具体的な使いどころ、次の担当者が読んで分かるように書いてください" /></label>
      </div>
      <div className="conversion-footer"><span /><Button className="ink-button" onClick={createItem}>登録する</Button></div>
    </section>}
    <div className="knowledge-top">
      <form className="knowledge-search" onSubmit={submitSearch}>
        <Search size={18} />
        <input aria-label="ナレッジを検索" placeholder="業種、商談場面、課題で検索" value={query} onChange={(e) => setQuery(e.target.value)} />
      </form>
      <div className="topic-strip">
        <button className={activeTag === null ? "active" : ""} onClick={() => setActiveTag(null)}>すべて</button>
        {TOPIC_FILTERS.map((tag) => <button key={tag} className={activeTag === tag ? "active" : ""} onClick={() => setActiveTag(tag)}>{tag}</button>)}
      </div>
    </div>
    <div className="knowledge-layout">
      <div className="knowledge-list">
        {items.filter((i) => i.kind === "業種プレイブック").map((item) => <Playbook key={item.id} item={item} onReviewed={load} />)}
        {items.filter((i) => i.kind !== "業種プレイブック").map((item) => <button className="knowledge-card" key={item.id} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
          <div><span className="paper-dot" /> <small>{item.source_company_name ?? "チーム共通"}・{new Date(item.created_at).toLocaleDateString("ja-JP")}</small></div>
          <h3>{item.title}</h3>
          <p>{expandedId === item.id ? (item.body || "詳細は登録されていません。") : (item.body ? `${item.body.slice(0, 60)}${item.body.length > 60 ? "…" : ""}` : "詳細は登録されていません。")}</p>
          <div>{item.tags.map((tag) => <StatusPill key={tag}>{tag}</StatusPill>)}</div>
        </button>)}
        {items.length === 0 && <p className="queue-empty">該当するナレッジはまだありません。</p>}
      </div>
      <aside className="knowledge-aside">
        {items.length === 0 ? <>
          <img src="/manus-storage/relay-knowledge-stack_7b1a6485.jpg" alt="ナレッジの蓄積を表すフォルダとカード" />
          <div><span className="eyebrow">ONBOARDING</span><h3>まず読む、<br />営業の基本線。</h3><p>新しいメンバー向けに、商談フェーズごとの必読ナレッジをまとめています。</p><button onClick={() => toast.info("オンボーディングガイドは今後の機能です")}>ガイドを開く <ArrowUpRight size={15} /></button></div>
        </> : <div>
          <span className="eyebrow">CONTEXT</span><h3>表示中のナレッジ</h3>
          <p>{items.length}件を表示中{activeTag ? `（タグ「${activeTag}」で絞り込み中）` : ""}</p>
          <p>最終更新：{new Date(items[0].created_at).toLocaleDateString("ja-JP")}</p>
        </div>}
      </aside>
    </div>
  </section>;
}
