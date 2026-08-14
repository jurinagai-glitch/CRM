# Claudeレビュー v2：技術評価メモ

**対象**：営業事務ゼロCRM 設計まとめ v2  
**評価日**：2026年8月13日

## 結論

v2で追加された「取引先を長期的な顧客ハブにする」「契約更新を追う」「データ品質を担保する」という方向は、継続課金型の営業CRMとして妥当である。一方、Gmail自動連携、メールの全量タイムライン化、ベクトル検索、契約管理、レポートを同時にMVPへ入れると、少人数で保守するという初期方針と衝突する。

MVPの正本は、**取引先・商談・議事録・確認済み次アクション・活動タイムライン**とする。メール同期、類似商談、契約更新、分析は、正本と監査・権限モデルが安定した後に追加する。

## 採用する改善

| 領域 | 採用する改善 | 判断理由 |
|---|---|---|
| 取引先 | 取引先を、メール・議事録・提案・契約を横断して見る「ハブ」として扱う | 商談の文脈が一画面で追え、継続利用の情報も分断しない。 |
| データ品質 | 新規登録時に重複候補を提示し、統合ではなくまず確認・除外できるUIにする | 自動統合による誤結合は、顧客履歴を壊すリスクが高い。 |
| 類似商談 | 類似候補と一致根拠をブリーフィングに表示するUIを追加する | AIを結論の自動化ではなく、過去事例の探索補助として使える。 |
| 更新管理 | 契約更新の期限と健全性を先に見る管理画面を追加する | 継続課金の見落としを抑えるため、実務上の優先度が高い。 |
| インバウンド | Gmailラベル由来であること、同期対象と除外状態を可視化する | 自動取込の誤登録を後から説明・訂正できる。 |

## 設計を変更するべき点

| 領域 | v2の案 | 推奨する変更 |
|---|---|---|
| `company_embeddings` | 会社ごとに1件の埋め込みを保存する | `semantic_documents` を新設し、`entity_type`、`entity_id`、`company_id`、`deal_id`、`source_hash`、`embedding_model`、`embedding_version`、`embedded_at`、`status` を持つ。会社・商談・議事録要約・ナレッジを別々の検索文書として扱う。 |
| 埋め込み | 更新の方法が未定義 | 原文・要約が確定後にキューへ積み、非同期生成する。失敗・再試行・モデル切替を `embedding_jobs` または `ai_runs` に記録する。比較対象は同一モデル・同一バージョンに限定する。 |
| `activities` | 本文を直接保持する汎用活動テーブル | `activities` は不変のイベント・エンベロープに寄せ、議事録・メール本文・提案書の詳細は元テーブルを正本にする。`source` + `external_id` の一意制約で重複取込を防ぐ。タイムラインはビューで統合する。 |
| Gmail同期 | ラベルのメールを定期取得する | mailboxごとに `gmail_connections`（暗号化refresh token、history_id、watch_expires_at、consent状態）を持つ。Push通知→`history.list`差分取得→冪等なメッセージ登録を使い、定期処理はwatch更新と欠損補完に限定する。 |
| Gmailの削除 | 誤登録を手動削除する | Gmail原本を消さず、CRM側で `sync_disposition=excluded`、除外理由、実行者、時刻を保存する。再取り込みを防ぐ。 |
| 重複統合 | `merged_into_company_id`へ集約する | 自動統合はしない。正規化名・メールドメイン・住所等の決定的候補と、意味類似候補を分ける。統合はトランザクションと `company_merge_events` による監査を必須にし、統合先チェーンを禁止する。 |
| 契約管理 | 1社1契約に近い `subscriptions` | 複数サービス・複数契約期間を想定し、`contracts`、必要なら`contract_items`、`renewal_events`へ分ける。商談は新規・更新を識別する `deal_type` として契約に紐付ける。 |
| チーム権限 | `team_members.visibility_scope`のみ | `organizations`、`organization_members`、`teams`、`team_members` を区別する。RLSは組織境界を第一条件にし、次に全件閲覧・担当閲覧・明示共有で判定する。 |
| 見込み金額 | `amount`と月額が混在する | `amount_value`、`currency`、`amount_type`（MRR/ARR/one_off）、`probability`、`probability_updated_at`を分離する。予測は集計値であり、確定売上とは区別する。 |

## Gmail連携に関する判断

Gmail APIは、ラベルでフィルタした `users.watch` とCloud Pub/SubによるPush通知を提供している。通知後は、新しい`historyId`を用いて`history.list`で差分を取得する方式であり、毎回メール全量をポーリングするより適切である。watchは少なくとも7日ごとに更新が必要で、公式は日次更新を勧めている。通知は遅延・欠損し得るため、差分同期のフォールバックが必要である。[1] [2]

ただし、`gmail.readonly`は「読み取り専用」でも**restricted scope**である。サーバーでデータを保存または送信する場合は、OAuth verificationに加えてセキュリティ評価が必要となり得る。よって、Gmail連携を「無料で簡単に導入できるMVP」とは扱わない。初期段階では、手動入力と、ユーザーが選択した限定ラベルの試験同期に絞るべきである。[3]

## 類似検索に関する判断

2,000社程度では、ベクトル検索は規模そのものよりも、**何を埋め込むか、いつ再生成するか、どの条件で候補を表示しないか** が品質を左右する。会社単位の一つの埋め込みでは、過去の商談課題と会社属性が混ざり、推薦理由を説明しにくい。商談、確定済み議事録要約、公開済みナレッジを独立した検索文書にするべきである。

Supabaseは、埋め込み比較で同一モデルを使うこと、検索のフィルタをSQL関数内へ押し込むことを勧めている。HNSWは近似検索の既定候補で、新規データを追加しても索引構造が最適なまま維持される。一方、選択性の高いメタデータフィルタを後段で適用すると候補数が不足し得るため、組織・公開状態・文書種別のフィルタは検索関数の中で適用する。[4] [5] [6]

本件では、まずキーワード＋メタデータ検索を基礎にし、候補表示の評価データが貯まってから、埋め込み検索を追加する。推薦UIには、類似スコアだけでなく「同じ業種」「同じ導入課題」「同じ決裁構造」など人が理解できる一致理由を表示し、低信頼の候補は表示しない。

## デザインに関する判断

Linear、Notion、Attio、SmartHR、freeeを「正確に踏襲する」方針は採らない。複数の既存プロダクトの色・余白・角丸をそのまま混在させると、固有性を失い、かえって既視感の強い画面になるためである。

既存の **Quiet Operations Desk** を維持し、参考サイトは以下の粒度でのみ使う。Linearは操作の速さと密度、Notionは文書とデータベースの行き来、Attioは顧客ハブの情報構造、SmartHR/freeeは日本語業務画面の説明責任を参考にする。英字も含め、既存のNoto Serif JP + Noto Sans JPを基本とし、単にSaaSらしく見せる目的でInterへ統一しない。

## MVPの優先順位

| 優先度 | 範囲 | MVPへの扱い |
|---:|---|---|
| P0 | 組織・RLS、取引先、担当者、商談、議事録、確認後の次アクション、統合タイムライン | 必須 |
| P1 | インバウンドの手動登録、重複候補、提案書メタデータ、契約更新の手動管理、ナレッジ承認 | P0の後 |
| P2 | AI下書き、出典付きブリーフィング、キーワード・メタデータ検索 | データ品質確認後 |
| P3 | Gmail Push同期、類似商談のベクトル推薦、レポート自動集計 | OAuth・監査・運用設計の後 |

## 参考資料

[1]: https://developers.google.com/workspace/gmail/api/guides/push "Gmail API: Configure push notifications"
[2]: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch "Gmail API: users.watch"
[3]: https://developers.google.com/workspace/gmail/api/auth/scopes "Gmail API: Choose scopes"
[4]: https://supabase.com/docs/guides/ai/semantic-search "Supabase: Semantic search"
[5]: https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes "Supabase: HNSW indexes"
[6]: https://supabase.com/docs/guides/database/extensions/pgvector "Supabase: pgvector"
