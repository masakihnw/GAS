# タスク通知ボット 要件定義（GAS × Notion × Slack）
*for Cursor pair-programming — 改訂版（カテゴリ条件を明示反映）*

---

## 0. 目的（What/Why）
- **What**：Notion のタスクから **「未完了」かつ「期限切れ / 今日期限」** を抽出し、**プロジェクト／プロダクト単位**で Slack に毎日 1 回通知。  
- **Why**：PjM / SM が朝イチに対応必須タスクを把握し、抜け漏れを防止。

---

## 1. スコープ（対象・非対象）
### 1.1 通知対象（2 系統）
- **プロジェクト関連**
  - 対象DB：**Project DB**
  - 取得対象：**カテゴリ = 「プロダクト開発」 または 「プロジェクト管理」**
  - 通知先：各 **プロジェクトの Slack チャンネル**
  - メンション：**担当 PjM**
- **プロダクト関連**
  - 対象DB：**Product DB**
  - 取得対象：**カテゴリ = 「プロダクト開発」**
  - 通知先：各 **プロダクトの Slack チャンネル**
  - メンション：**スクラムマスター（SM）**

### 1.2 タスク抽出条件（共通）
- 対象タスク：**未完了** かつ **（期限切れ or 今日期限）**
- 除外：**完了 / キャンセル /（必要なら）バックログ**
- タイムゾーン：**Asia/Tokyo**（Notion の日時が UTC でも **JST に正規化**して判定）

### 1.3 非対象
- **個人room（DM / 個人チャンネル）** への通知は除外（AIX仕組みと重複回避）

---

## 2. 実行タイミング（When）
- スケジュール：**平日（Mon–Fri）** のみ
- 実行時間帯：**JST 10:00–11:00 の間に 1 回**（GAS の時間主導トリガー）
- 二重送信防止：Script Properties などに **`LAST_NOTIFY_YYYYMMDD`** を持ち、**同日 2 回目以降はスキップ**

---

## 3. Notion データモデル（前提）
### 3.1 Task DB（タスクのソース）
必須（例）
- `title`（Title）
- `Taskステータス`（Status：未着手 / 実行中 / バックログ / 完了 / キャンセル）
- `Task期限`（Date）
- **所属リンク**
  - `Project`（Relation または Rollup）
  - `Product`（**Rollup（Relation 集約）** で返る想定）

> **重要**：`Product` が **Rollup** の場合、**API フィルタは名前ではなく page_id で比較**する  
> → `rollup.any.relation.contains: <product_page_id>` を使用（*select* / *rich_text* 比較は不可）

（オプション）将来：Formula `[Issue/Task]最早[期限/実施日]status`（"0.期限切れ"/"1.今日期限"）運用も可。

### 3.2 Product / Project DB（通知対象一覧とメタ）
- `名前`（Title）
- `カテゴリ`（Select）
- **通知メタ**（どちらかの設計）
  - **A）DB に保持**：Slack チャンネル ID、SM / PjM の Slack ユーザー ID
  - **B）GAS 側でマッピング**：`PRODUCT_MAPPING` / `PROJECT_MAPPING`（page_id → {channelId, mentionUserId}）

---

## 4. 対象列挙（カテゴリ条件の明示）
> ここで **カテゴリプロパティ** による絞り込みを行い、「どのプロジェクト／プロダクトに通知するか」を確定します。

### 4.1 Product DB からの列挙（カテゴリ＝「プロダクト開発」）
**Notion Databases Query（例）**
```json
{
  "filter": {
    "property": "カテゴリ",
    "select": { "equals": "プロダクト開発" }
  },
  "page_size": 100
}
```
- 返ってきた各 Product の **page_id / 名前 / 通知メタ** を保持。
- 通知メタが DB に無い場合は GAS の `PRODUCT_MAPPING` で補完。

### 4.2 Project DB からの列挙（カテゴリ＝「プロダクト開発」「プロジェクト管理」）
**Notion Databases Query（例）**
```json
{
  "filter": {
    "or": [
      { "property": "カテゴリ", "select": { "equals": "プロダクト開発" } },
      { "property": "カテゴリ", "select": { "equals": "プロジェクト管理" } }
    ]
  },
  "page_size": 100
}
```
- 返ってきた各 Project の **page_id / 名前 / 通知メタ** を保持。
- 通知メタが DB に無い場合は GAS の `PROJECT_MAPPING` で補完。

---

## 5. タスク抽出ロジック（How: Notion API フィルタ）
### 5.1 共通フィルタ設計（まずは **API 日付フィルタ** で実装）
- **未完了**：`Taskステータス` が **完了 / キャンセル / バックログ 以外**
- **期限切れ**：JST で **昨日まで**
- **今日期限**：JST で **当日一致**

### 5.2 プロダクト別（1 件の例：期限切れ／今日期限）
**期限切れ（JST 昨日まで）**
```json
{
  "filter": {
    "and": [
      {
        "property": "Product",
        "rollup": {
          "any": {
            "relation": { "contains": "<PRODUCT_PAGE_ID>" }
          }
        }
      },
      { "property": "Taskステータス", "status": { "does_not_equal": "完了" } },
      { "property": "Taskステータス", "status": { "does_not_equal": "キャンセル" } },
      { "property": "Taskステータス", "status": { "does_not_equal": "バックログ" } },
      { "property": "Task期限", "date": { "on_or_before": "<YYYY-MM-DD (JST 昨日)>" } }
    ]
  },
  "page_size": 100
}
```
**今日期限（JST 本日）**
```json
{
  "filter": {
    "and": [
      {
        "property": "Product",
        "rollup": {
          "any": {
            "relation": { "contains": "<PRODUCT_PAGE_ID>" }
          }
        }
      },
      { "property": "Taskステータス", "status": { "does_not_equal": "完了" } },
      { "property": "Taskステータス", "status": { "does_not_equal": "キャンセル" } },
      { "property": "Taskステータス", "status": { "does_not_equal": "バックログ" } },
      {
        "property": "Task期限",
        "date": {
          "on_or_after": "<YYYY-MM-DD (JST 今日)>",
          "on_or_before": "<YYYY-MM-DD (JST 今日)>"
        }
      }
    ]
  },
  "page_size": 100
}
```

### 5.3 プロジェクト別（1 件の例：Relation or Rollup）
- `Project` が **Relation**：
```json
{ "property": "Project", "relation": { "contains": "<PROJECT_PAGE_ID>" } }
```
- `Project` が **Rollup**：
```json
{
  "property": "Project",
  "rollup": { "any": { "relation": { "contains": "<PROJECT_PAGE_ID>" } } }
}
```
> ほかの条件（未完了、期限切れ／今日期限、page_size）は **5.2** と同様。

### 5.4 ページネーション
- `page_size: 100`、`has_more` / `next_cursor` を見てループして全件取得。

---

## 6. Slack 通知仕様（What to send）
### 6.1 テキスト例
```
@PjM or @SM

🔔 未完了タスク（期限切れ）
- タスクA（期限: MM/DD 担当: XXX）<Notionリンク>
- タスクB（期限: MM/DD 担当: YYY）<Notionリンク>

📅 今日期限のタスク
- タスクC（期限: MM/DD 担当: ZZZ）<Notionリンク>
- タスクD（期限: MM/DD 担当: AAA）<Notionリンク>
```
- **Notion リンク**：ページ ID から Deep Link（UUID のダッシュ除去）を生成。
- 長文対策：**上位 N 件 + 残件数** に自動短縮可（任意）。

### 6.2 推奨ブロック構成
- `header`：`🚨 [プロダクト/プロジェクト名] タスク通知`
- `section`：`<@UserID> 以下のタスクが期限切れ・今日期限です：`
- `divider`
- `section`（リスト）×2（期限切れ／今日期限）
- `context`：`総件数: n件 | 取得日時: YYYY/MM/DD HH:mm（JST）`

### 6.3 投稿の堅牢化
- `chat.postMessage` が **not_in_channel** の場合：`conversations.join` → **再試行**
- エラーでも **他ターゲット処理は継続**、詳細はログ出力。

---

## 7. 環境変数（GAS Script Properties）
| Key | 用途 |
|---|---|
| `NOTION_API_TOKEN` | Notion API トークン |
| `NOTION_TASK_DB_ID` | Task DB の database_id |
| `NOTION_PRODUCT_DB_ID` | Product DB（page_id 解決 or 列挙） |
| `NOTION_PROJECT_DB_ID` | Project DB（page_id 解決 or 列挙） |
| `SLACK_BOT_TOKEN` | Slack Bot トークン（xoxb-） |
| `PRODUCT_MAPPING` | `{ product_page_id: { channelId, mentionUserId } }`（A 設計時） |
| `PROJECT_MAPPING` | `{ project_page_id: { channelId, mentionUserId } }`（A 設計時） |
| `LAST_NOTIFY_YYYYMMDD` | 当日実行済みフラグ |

> **page_id 解決方式**  
> - **A）静的マップ**（`*_MAPPING` に登録）  
> - **B）DB 検索**（`*_DB_ID` でタイトル → page_id 解決）※運用は **B 推奨**

---

## 8. 処理フロー（擬似）
1. **ガード**：JST 現在が 10:00–11:00 か／平日か／同日未通知かを確認。  
2. **対象列挙**：  
   - **Product DB** を **カテゴリ＝「プロダクト開発」** でクエリ → page_id と通知メタ取得。  
   - **Project DB** を **カテゴリ∈{「プロダクト開発」「プロジェクト管理」}** でクエリ → page_id と通知メタ取得。  
3. **タスク取得**（各対象ごと）  
   - **期限切れ**（JST 昨日まで）と **今日期限**（JST 本日）の **2 クエリ**。  
   - **未完了ステータス**のみ（完了/キャンセル/バックログ除外）。  
   - ページネーションで全件取得。  
4. **整形**：2 セクション（期限切れ／今日期限）に分けて Slack ブロック生成。  
5. **投稿**：`safePostToSlack`（not_in_channel → join → 再試行）。  
6. **記録**：成功したら `LAST_NOTIFY_YYYYMMDD` を更新、各対象の件数・成否をログ。

---

## 9. 例外処理・品質
- **Notion 400（validation_error）**：Rollup を **select/rich_text** で比較しない（**relation.contains** を使用）。
- **Slack**：`ok:false` はエラーログ、他対象は続行。
- **JST 正規化**：Notion の Date は UTC 前提として **JST の「今日/昨日」** を算出して比較。

---

## 10. セキュリティ / 権限
- Notion：対象 DB を **統合（Integration）に共有**（読み取り権限）。
- Slack：Bot に対象チャンネルへの **参加権限**（`conversations.join`）。
- Secrets：**Script Properties** に保存（コミットしない）。

---

## 11. パフォーマンス
- **API フィルタで件数を削減**（未完了＋期限条件で絞る）。
- `page_size: 100`、`has_more` 対応のループ。
- **1 対象 1 投稿**（チャネル別にまとめて送信）。

---

## 12. Cursor 実装チェックリスト
- [ ] Script Properties（上記キー）を登録。  
- [ ] **カテゴリ列挙のクエリ**（4.1 / 4.2 のフィルタ JSON を実装）。  
- [ ] **page_id 解決**：A＝マップ、B＝DB 検索（B 推奨）。  
- [ ] **JST ユーティリティ**：今日/昨日の ISO 文字列を返す。  
- [ ] **Notion クエリ**（期限切れ / 今日期限、未完了のみ、relation.contains）。  
- [ ] **ページネーション**処理。  
- [ ] **Slack 送信関数**（join→再試行、ブロック生成）。  
- [ ] **ガード & 重複防止**（10:00–11:00、平日、同日未通知）。  
- [ ] Dry-run（特定 1 プロダクト / 1 プロジェクトのみ）。  
- [ ] 本番トリガー（平日 10:00–11:00 のどこかで 1 回）。
