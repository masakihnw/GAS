# Slackリリース通知のNotion朝会議事録への自動投稿 要件定義書

## 1. 概要

### 1.1 目的
Slackチャンネルで行われているリリース通知を、毎日の朝会で共有しているNotionの議事録ページに自動で追加し、Slackリンクをプレビュー形式で表示できるようにする。

### 1.2 背景
- 毎朝の朝会でSlackのリリース通知が共有されている
- 朝会の議事録はNotionで毎日自動生成される
- 現在は手動でSlackリンクをコピー&ペーストしている
- これを自動化して作業効率を向上させる

### 1.3 対象システム
- **データソース**: Slackチャンネル（C6A3U5WTC）
- **データベース**: Notionデータベース（`Document (旧Meeting)`、ID: `cd1b1c95bfc34c7d9ec50405a5023cc9`）
- **実行環境**: Google Apps Script（GAS）
- **実行頻度**: 平日の9:00-10:00の間（1日1回）
- **ページ作成**: Notionオートメーションルール「朝会」により、平日ごとに自動生成

## 2. 機能要件

### 2.1 基本機能
- **Slack投稿取得**: 指定されたチャンネルのリリース通知を期間内で取得
- **Notionページ検索**: 当日の朝会議事録ページ（「@日付 チーム活動予定」）を検索
- **Notionページ更新**: 取得したリリース通知を議事録ページに追加
- **テンプレート処理**: 通知がない場合はテンプレートを削除して「なし」を記載

### 2.2 Slack投稿取得条件

#### 2.2.1 対象チャンネル
- **チャンネルID**: `C6A3U5WTC`
- **チャンネルURL**: `https://playground-live.slack.com/archives/C6A3U5WTC`

#### 2.2.2 取得期間
- **開始時刻**: 発表当日の9:00（JST）
- **終了時刻**: 前営業日の8:59（JST）
- **営業日定義**: 土日祝日を除外した平日のみ
- **特別ルール**: 金曜日のSlack投稿は、次の営業日（月曜日、または土日祝日を跨いだ次の営業日）に共有される

**営業日の計算ロジック**:
1. 実行日が営業日であることを確認（土日祝日は除外）
2. 実行日の前日から遡って、最初の営業日を見つける
3. その営業日の8:59までを取得期間の終了時刻とする

**例**: 
- 実行日が2025年1月29日（水）9:00の場合
  - 開始: 2025年1月29日（水）9:00
  - 終了: 2025年1月28日（火）8:59（前日が火曜日で営業日）
- 実行日が2025年1月27日（月）9:00の場合（前日が日曜日）
  - 開始: 2025年1月27日（月）9:00
  - 終了: 2025年1月24日（金）8:59（金曜日が前営業日）
- 実行日が2025年1月30日（木）9:00の場合（前日が水曜日）
  - 開始: 2025年1月30日（木）9:00
  - 終了: 2025年1月29日（水）8:59（前日が水曜日で営業日）

#### 2.2.3 投稿の判定条件
投稿がリリース通知であることを判定する条件：

1. **形式パターン**: `[共有] プロダクト名リリース - 投稿者名`
   - 例: `[共有] Zeamiリリース - 花輪`
   - 例: `[共有] Jukoリリース - 花輪`

2. **必須要素**:
   - `[共有]` で始まる
   - `プロダクト名` の後に「リリース」が続く
   - `-` の後に投稿者名が続く

#### 2.2.4 取得する投稿情報
- **投稿メッセージ**: 投稿のテキスト内容
- **投稿URL**: Slack投稿へのリンク（例: `https://playground-live.slack.com/archives/C6A3U5WTC/p1761215408226919`）
- **投稿日時**: 投稿された日時（タイムスタンプ）
- **投稿者**: SlackユーザーIDから表示名を取得（`users.info` APIを使用）
  - **取得方法**: Slack APIの `users.info` エンドポイントを使用してユーザー情報を取得
  - **表示名**: `user.profile.display_name` または `user.profile.real_name` を使用
  - **フォールバック**: ユーザーIDが見つからない場合は、投稿テキストから抽出した投稿者名を使用

### 2.3 Notionページ処理

#### 2.3.0 ページの作成方法（前提情報）
- **作成方法**: Notionオートメーションルール「朝会」により自動生成
- **実行タイミング**: 平日ごと（毎平日に実行）
- **対象データベース**: `Document (旧Meeting)`（データベースID: `cd1b1c95bfc34c7d9ec50405a5023cc9`）
- **作成プロセス**:
  1. **変数定義**: `翌営業日日付` を計算
     - 計算式: `トリガーされた日付.dateAdd(ifs(day(トリガーされた日付)==5, 3, 1))`
     - 金曜日（day==5）の場合: 3日後（月曜日）を追加
     - それ以外: 1日後を追加
     - **注意**: 祝日の考慮はなし（GAS側で祝日を考慮した検索が必要）
  2. **ページ作成**: `<<日次>> チーム活動予定` をテンプレートとして作成
  3. **件名（タイトル）プロパティの設定**:
     - 計算式: `翌営業日日付 + replace(追加されたページ.件名, "<<日次>>", "")`
     - 結果: `@2025年1月29日 チーム活動予定` のような形式
  4. **日付プロパティの設定**: `翌営業日日付` を設定（このプロパティも検索条件として使用可能）

**重要なポイント**:
- ページは実行日の「翌営業日」を基準に作成される（金曜日は3日後、それ以外は1日後）
- タイトルには `@YYYY年MM月DD日 チーム活動予定` 形式で日付が設定される
- オートメーション側では祝日を考慮していないため、GAS実行時は祝日を考慮した検索が必要

#### 2.3.1 ページ検索
- **データベースID**: `cd1b1c95bfc34c7d9ec50405a5023cc9`
- **検索条件**: タイトルが「[Notionの日付変数] チーム活動予定」形式で、当日の日付に一致するページ

##### Notionの日付変数仕様
Notionでは、タイトルやテキスト内で「@」記号を使用して日付を表現できます。以下のパターンが使用可能です：

**日付変数のパターン**:
- `@今日` - 現在の日付を動的に表示
- `@昨日` - 前日の日付を動的に表示
- `@2025年1月29日` - 特定の日付を直接指定（YYYY年MM月DD日形式）
- `@月曜日` - 特定の曜日を指定（今週の該当曜日）
- `@前の日曜日` - 直前の日曜日の日付を表示
- `@前の月曜日` - 直前の月曜日の日付を表示
- その他の相対日付表現（`@前の◯曜日`、`@次の◯曜日`など）

**検索方法**:
1. **実行日の日付を計算**: JSTで実行日の日付を取得（`YYYY-MM-DD`形式と`YYYY年MM月DD日`形式の両方を用意）
2. **検索方法1: タイトルによる検索**（優先度: 高）
   - **主な検索パターン**: オートメーションで作成されるページは固定日付形式なので、以下を優先
     - `@2025年1月29日 チーム活動予定`（実行日の日付を「YYYY年MM月DD日」形式に変換）
   - **フォールバック検索パターン**: 上記で見つからない場合、以下のパターンも試行
     - `@今日 チーム活動予定`
     - `@[実行日の曜日] チーム活動予定`（例: `@水曜日 チーム活動予定`）
3. **検索方法2: 日付プロパティによる検索**（優先度: 中）
   - タイトル検索で見つからない場合、日付プロパティで検索
   - 実行日の日付（`YYYY-MM-DD`形式）と一致する日付プロパティを持つページを検索
   - Notion APIのフィルタ例: `{ "property": "日付", "date": { "equals": "2025-01-29" } }`
4. **最終フォールバック**（優先度: 低）
   - 上記で見つからない場合、データベース内の全ページを取得し、以下の条件で確認
     - タイトルに実行日の日付が含まれるか
     - 日付プロパティが実行日の日付と一致するか
5. **日付の一致判定**: Notionの日付変数が実際の日付に解決された結果と実行日が一致することを確認

**注意事項**:
- **オートメーションでの作成方法を考慮**: ページは「翌営業日」を基準に作成されるため、実行日の日付と完全に一致するページが存在する想定
- タイトル形式は `@YYYY年MM月DD日 チーム活動予定` の固定日付形式が基本
- 検索の優先順位: 固定日付形式 > 動的変数形式
- **祝日の考慮**: オートメーション側では祝日を考慮していないため、祝日の場合はGAS実行時に適切なページを検索する必要がある

#### 2.3.2 ページの既存コンテンツ
ページ作成時点で以下のテンプレートが記載されている場合がある：

```markdown
### [共有] タイトル - 発表者名

- 内容

### [依頼] タイトル - 発表者名

- 内容
```

#### 2.3.3 追加するコンテンツ形式
取得したリリース通知を以下の形式で追加：

```markdown
### [共有] プロダクト名リリース - 投稿者名

https://playground-live.slack.com/archives/C6A3U5WTC/p1761215408226919
```

**重要**: Slackリンクは**プレビュー形式**で表示される必要がある
- Notionでは、URLをそのまま記載すると自動的にプレビューが生成される仕様
- **実装方法**: Notion APIで `paragraph` ブロックに `rich_text` としてURLを追加すると、自動的にプレビューが生成される
- 専用のプレビューブロックタイプは不要で、通常の `paragraph` ブロックにURLを記載するだけで十分

#### 2.3.4 通知がない場合の処理
- テンプレート（「[共有] タイトル - 発表者名」と「[依頼] タイトル - 発表者名」セクション）を削除
- **削除方法**: Notion APIの `DELETE /v1/blocks/{block_id}` エンドポイントを使用してブロックを削除
- 「なし」と記載（`paragraph` ブロックとして追加）

### 2.4 実行タイミング

#### 2.4.1 スケジュール
- **実行日**: 平日のみ（月曜日～金曜日）
- **実行時間帯**: 9:00-10:00の間（GASトリガーで制御）
- **実行頻度**: 1日1回

#### 2.4.2 除外条件
- 土日祝日は実行しない
- **祝日の判定方法**: 
  - Google Calendar APIを使用して日本の祝日カレンダー（`ja.japanese#holiday@group.v.calendar.google.com`）から取得
  - フォールバック: Google Calendar APIが使用できない場合は、固定祝日リストと計算式を使用
  - 既存コード（`product_project_task-notifier.js`、`private_task-notifier.js`）の `getJapaneseHolidays()` 関数を参考に実装

#### 2.4.3 二重実行防止
- Script Propertiesに `LAST_EXEC_DATE` を記録
- 同日に2回目以降の実行が発生した場合はスキップ

## 3. 技術要件

### 3.1 API仕様

#### 3.1.1 Slack API
```javascript
// チャンネルのメッセージ取得
GET https://slack.com/api/conversations.history

// リクエストパラメータ
{
  "channel": "C6A3U5WTC",
  "oldest": "<最古タイムスタンプ（前営業日8:59）>",
  "latest": "<最新タイムスタンプ（当日9:00）>",
  "limit": 1000
}

// レスポンス
{
  "ok": true,
  "messages": [
    {
      "type": "message",
      "user": "U05HPC0BL3V",
      "text": "[共有] Zeamiリリース - 花輪",
      "ts": "1761215408.226919",
      "permalink": "https://playground-live.slack.com/archives/C6A3U5WTC/p1761215408226919"
    }
  ]
}

// 投稿者名を取得するためのAPI呼び出し
GET https://slack.com/api/users.info

// リクエストパラメータ
{
  "user": "U05HPC0BL3V"
}

// レスポンス
{
  "ok": true,
  "user": {
    "id": "U05HPC0BL3V",
    "name": "masaki.hanawa",
    "profile": {
      "display_name": "花輪",
      "real_name": "花輪 真輝"
    }
  }
}
```

#### 3.1.2 Notion API
```javascript
// データベースからページを検索
POST https://api.notion.com/v1/databases/{database_id}/query

// 検索方法1: タイトルによる検索
// リクエストパラメータ
{
  "filter": {
    "property": "名前", // タイトルプロパティ名
    "title": {
      "contains": "@2025年1月29日 チーム活動予定"
    }
  }
}

// 検索方法2: 日付プロパティによる検索
// リクエストパラメータ
{
  "filter": {
    "property": "日付", // 日付プロパティ名（要確認）
    "date": {
      "equals": "2025-01-29"
    }
  }
}

// 注意: Notionの日付変数の様々なパターンに対応
// - @今日、@昨日（動的変数）
// - @2025年1月29日（固定日付）
// - @月曜日、@前の日曜日（相対的な日付表現）
// 検索時は複数のパターンで試行し、実行日の日付と一致するページを見つける
// 日付プロパティによる検索も併用して、より確実にページを特定する

// ページのコンテンツ取得
GET https://api.notion.com/v1/blocks/{page_id}/children

// ページのコンテンツ更新（ブロック追加）
PATCH https://api.notion.com/v1/blocks/{page_id}/children
{
  "children": [
    {
      "object": "block",
      "type": "heading_3",
      "heading_3": {
        "rich_text": [
          {
            "type": "text",
            "text": {
              "content": "[共有] Zeamiリリース - 花輪"
            }
          }
        ]
      }
    },
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [
          {
            "type": "text",
            "text": {
              "content": "https://playground-live.slack.com/archives/C6A3U5WTC/p1761215408226919",
              "link": {
                "url": "https://playground-live.slack.com/archives/C6A3U5WTC/p1761215408226919"
              }
            }
          }
        ]
      }
    }
  ]
}

// テンプレートブロックの削除
DELETE https://api.notion.com/v1/blocks/{block_id}
```

### 3.2 データモデル

#### 3.2.1 Slack投稿データ構造
```javascript
{
  text: "[共有] Zeamiリリース - 花輪",
  user: "U05HPC0BL3V",
  ts: "1761215408.226919",
  permalink: "https://playground-live.slack.com/archives/C6A3U5WTC/p1761215408226919",
  productName: "Zeami",
  authorName: "花輪"
}
```

#### 3.2.2 Notionページ構造
- **タイトルプロパティ**: 「@日付 チーム活動予定」
- **本文ブロック**: 
  - Heading 3: `[共有] プロダクト名リリース - 投稿者名`
  - Paragraph: Slackリンク（プレビュー表示）

### 3.3 設定管理

#### 3.3.1 Script Properties
| Key | 用途 | 例 |
|---|---|---|
| `SLACK_BOT_TOKEN` | Slack Bot トークン（xoxb-） | `xoxb-xxxxx` |
| `SLACK_CHANNEL_ID` | リリース通知チャンネルID | `C6A3U5WTC` |
| `NOTION_API_TOKEN` | Notion API トークン | `secret_xxxxx` |
| `NOTION_DB_ID` | 朝会議事録データベースID | `cd1b1c95bfc34c7d9ec50405a5023cc9` |
| `LAST_EXEC_DATE` | 最終実行日（YYYYMMDD形式） | `20250129` |

#### 3.3.2 定数定義
```javascript
const CONFIG = {
  SLACK: {
    CHANNEL_ID: 'C6A3U5WTC',
    BASE_URL: 'https://playground-live.slack.com/archives'
  },
  NOTION: {
    DB_ID: 'cd1b1c95bfc34c7d9ec50405a5023cc9',
    TITLE_FORMAT: '@{DATE} チーム活動予定' // 日付フォーマット要確認
  },
  TIME: {
    EXEC_START_HOUR: 9,
    EXEC_END_HOUR: 10,
    TIMEZONE: 'Asia/Tokyo'
  }
};
```

## 4. 処理フロー

### 4.1 メインフロー
1. **実行条件チェック**
   - 平日かどうか
   - 実行時間帯（9:00-10:00）内か
   - 既に実行済みか（同日2回目以降はスキップ）

2. **営業日の計算**
   - 当日の日付を取得
   - 前営業日の8:59までを計算（土日祝日を除外）
   - 前日から遡って最初の営業日を見つける
   - 金曜日のSlack投稿は次の営業日（月曜日または土日祝日を跨いだ次の営業日）に共有されることを考慮

3. **Slack投稿取得**
   - 期間内の投稿を取得
   - リリース通知パターンに一致する投稿を抽出
   - 投稿情報を整形

4. **Notionページ検索**
   - 当日の朝会議事録ページを検索
   - ページが見つからない場合はエラー

5. **既存コンテンツ確認**
   - ページの既存コンテンツを取得
   - テンプレートセクションがあるか確認

6. **コンテンツ更新**
   - 通知がある場合: リリース通知を追加
   - 通知がない場合: テンプレートを削除して「なし」を追加

7. **実行記録**
   - `LAST_EXEC_DATE` を更新

### 4.2 エラーハンドリング
- **ページが見つからない**: エラーログに記録して処理終了
- **Slack APIエラー**: エラーログに記録、リトライ（最大3回）
- **Notion APIエラー**: エラーログに記録、リトライ（最大3回）
- **部分失敗**: 取得できた通知のみ追加、エラーはログに記録

## 5. 非機能要件

### 5.1 パフォーマンス
- **応答時間**: 30秒以内
- **API呼び出し回数**: 最小限に抑制
- **ページネーション対応**: Slack APIの1000件制限に対応

### 5.2 可用性
- **稼働率**: 99%以上
- **エラーハンドリング**: 適切なエラーメッセージとログ出力
- **リトライ機能**: APIエラー時の自動リトライ（最大3回）

### 5.3 セキュリティ
- **認証**: Slack Bot Token、Notion API Token使用
- **権限**: 必要最小限の権限のみ
  - Slack: `channels:history`、`channels:read`
  - Notion: 対象データベースの読み書き権限

## 6. 実装仕様

### 6.1 主要関数

#### 6.1.1 メイン関数
```javascript
/**
 * メイン実行関数
 * GASトリガーから呼び出される
 */
function main() {
  // 実行条件チェック
  // Slack投稿取得
  // Notionページ更新
  // 実行記録
}
```

#### 6.1.2 Slack投稿取得関数
```javascript
/**
 * Slackチャンネルからリリース通知を取得
 * @param {string} oldest - 最古タイムスタンプ
 * @param {string} latest - 最新タイムスタンプ
 * @return {Array} リリース通知の配列
 */
function getSlackReleaseNotifications(oldest, latest) {
  // Slack API呼び出し
  // 投稿のフィルタリング
  // データ整形
}
```

#### 6.1.3 Notionページ検索関数
```javascript
/**
 * 当日の朝会議事録ページを検索
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @return {string} ページID（見つからない場合はnull）
 */
function findNotionPage(date) {
  // 日付を「YYYY年MM月DD日」形式と「YYYY-MM-DD」形式に変換
  const dateStr = formatDateToNotionFormat(date); // "2025年1月29日"
  const dateISO = date; // "2025-01-29" (既にYYYY-MM-DD形式)
  const dayOfWeek = getDayOfWeekName(date); // "水曜日"
  
  // 検索方法1: タイトルによる検索（優先度: 高）
  const searchPatterns = [
    `@今日 チーム活動予定`,
    `@${dateStr} チーム活動予定`,
    `@${dayOfWeek} チーム活動予定`
  ];
  
  // 各パターンで検索を試行
  for (const pattern of searchPatterns) {
    const pageId = searchNotionPageByTitle(pattern);
    if (pageId) {
      return pageId;
    }
  }
  
  // 検索方法2: 日付プロパティによる検索（優先度: 中）
  const pageIdByDate = searchNotionPageByDateProperty(dateISO);
  if (pageIdByDate) {
    return pageIdByDate;
  }
  
  // フォールバック: 全ページを取得してタイトルと日付プロパティを確認
  return findNotionPageByDateFallback(date);
}

/**
 * 日付をNotion形式に変換（YYYY年MM月DD日）
 */
function formatDateToNotionFormat(dateStr) {
  const date = new Date(dateStr + 'T00:00:00+09:00');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * 曜日名を日本語で取得
 */
function getDayOfWeekName(dateStr) {
  const date = new Date(dateStr + 'T00:00:00+09:00');
  const dayOfWeek = date.getDay();
  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return dayNames[dayOfWeek];
}

/**
 * 日付プロパティでページを検索
 * @param {string} dateISO - 日付（YYYY-MM-DD形式）
 * @return {string|null} ページID（見つからない場合はnull）
 */
function searchNotionPageByDateProperty(dateISO) {
  // Notion APIで日付プロパティによる検索を実行
  // プロパティ名は実際のNotionデータベースに合わせて調整が必要
  // const filter = {
  //   filter: {
  //     property: "日付", // 実際のプロパティ名に置き換え
  //     date: {
  //       equals: dateISO
  //     }
  //   }
  // };
  // return notionQueryPage(CONFIG.NOTION_DB_ID, filter);
}
```

#### 6.1.4 Notionページ更新関数
```javascript
/**
 * Notionページにリリース通知を追加
 * @param {string} pageId - ページID
 * @param {Array} notifications - リリース通知の配列
 */
function updateNotionPage(pageId, notifications) {
  // 既存コンテンツ取得
  // テンプレート削除（通知がない場合）
  // 通知追加（通知がある場合）
}
```

### 6.2 営業日計算ロジック
```javascript
/**
 * 前営業日の8:59を計算
 * @param {Date} date - 基準日（実行日）
 * @return {Date} 前営業日の8:59（JST）
 */
function getPreviousBusinessDayEnd(date) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // 前日から遡って最初の営業日を見つける
  while (!isBusinessDay(yesterday)) {
    yesterday.setDate(yesterday.getDate() - 1);
  }
  
  // 8:59のタイムスタンプを返す
  yesterday.setHours(8, 59, 0, 0);
  return yesterday;
}

/**
 * 営業日かどうかを判定（土日祝日を除外）
 * @param {Date} date - 判定する日付
 * @return {boolean} 営業日かどうか
 */
function isBusinessDay(date) {
  const dayOfWeek = date.getDay();
  
  // 土日を除外
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // 祝日を除外
  if (isHoliday(date)) {
    return false;
  }
  
  return true;
}

/**
 * 日本の祝日を取得（Google Calendar API使用）
 * @param {number} year - 年
 * @return {Array<string>} 祝日の日付配列（YYYY-MM-DD形式）
 */
function getJapaneseHolidays(year) {
  const calendarId = 'ja.japanese#holiday@group.v.calendar.google.com';
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  try {
    const events = CalendarApp.getCalendarById(calendarId).getEvents(startDate, endDate);
    const holidays = [];
    events.forEach(event => {
      const eventDate = event.getStartTime();
      const dateStr = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy-MM-dd');
      holidays.push(dateStr);
    });
    return holidays;
  } catch (error) {
    console.warn('祝日取得エラー（固定祝日を使用）:', error);
    return getFixedHolidays(year);
  }
}

/**
 * 日本の祝日を判定
 * @param {Date} date - 判定する日付
 * @return {boolean} 祝日かどうか
 */
function isHoliday(date) {
  const year = date.getFullYear();
  const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
  const holidays = getJapaneseHolidays(year);
  return holidays.includes(dateStr);
}
```

### 6.3 リリース通知パターンマッチング
```javascript
/**
 * 投稿がリリース通知かどうかを判定
 * @param {string} text - 投稿テキスト
 * @return {Object|null} マッチした場合は{productName, authorName}、そうでない場合はnull
 */
function matchReleaseNotification(text) {
  // 正規表現でパターンマッチング
  // プロダクト名と投稿者名を抽出
}
```

## 7. 出力形式

### 7.1 コンソール出力
```
=== Slackリリース通知のNotion追加処理開始 ===
実行日時: 2025-01-29 09:15:00 (JST)
対象期間: 2025-01-28 09:00:00 〜 2025-01-28 08:59:59

[Slack投稿取得]
取得件数: 2件
- [共有] Zeamiリリース - 花輪
- [共有] Jukoリリース - 花輪

[Notionページ検索]
ページID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ページタイトル: @2025年1月29日 チーム活動予定

[Notionページ更新]
通知を2件追加しました

=== 処理完了 ===
```

### 7.2 エラー出力
```
[エラー] Notionページが見つかりませんでした
- 検索条件: @2025年1月29日 チーム活動予定
- データベースID: cd1b1c95bfc34c7d9ec50405a5023cc9

[エラー] Slack API呼び出し失敗
- エラーコード: 403
- エラーメッセージ: access_denied
```

## 8. エラーハンドリング

### 8.1 想定エラー
- **Slack APIエラー**: チャンネルアクセス権限なし、APIレート制限
- **Notion APIエラー**: ページが見つからない、権限エラー
- **ページ作成漏れ**: 当日の朝会議事録ページが作成されていない
- **日付フォーマット不一致**: タイトルの日付フォーマットが想定と異なる

### 8.2 エラー対応
```javascript
try {
  // メイン処理
} catch (error) {
  console.error('エラー発生:', error);
  // エラー通知（必要に応じてSlackに通知）
  // エラーログに記録
}
```

## 9. テスト仕様

### 9.1 単体テスト
- 営業日計算ロジックの動作確認
- リリース通知パターンマッチングの動作確認
- Slack投稿取得機能の動作確認
- Notionページ検索機能の動作確認
  - 各種日付変数パターン（@今日、@昨日、@2025年1月29日、@月曜日など）での検索動作確認
  - 日付フォーマット変換の動作確認
  - タイトル検索の動作確認
  - 日付プロパティ検索の動作確認

### 9.2 統合テスト
- Slack API連携テスト
- Notion API連携テスト
- エンドツーエンドテスト（実際のページ更新）

### 9.3 手動テスト
- 実際のSlackチャンネルから投稿を取得
- 実際のNotionページに通知を追加
- エラーケースの動作確認

## 10. 運用要件

### 10.1 監視項目
- 実行成功率
- API呼び出し回数
- エラー発生率
- 処理時間

### 10.2 ログ出力
- 実行ログ
- エラーログ
- API呼び出しログ
- 処理内容の詳細ログ

## 11. 実装上の注意事項

### 11.1 確定事項
- ✅ Notionページのタイトル形式: `[Notionの日付変数] チーム活動予定`
  - 使用可能な日付変数パターン:
    - `@今日`、`@昨日`（動的変数）
    - `@2025年1月29日`（固定日付、YYYY年MM月DD日形式）
    - `@月曜日`、`@前の日曜日`など（相対的な日付表現）
  - 検索時は複数のパターンで試行し、実行日の日付と一致するページを見つける
- ✅ 祝日の判定方法: Google Calendar APIを使用（既存コードの `getJapaneseHolidays()` 関数を参考）
- ✅ Slackリンクのプレビュー表示: 通常の `paragraph` ブロックにURLを記載すると自動的にプレビューが生成される
- ✅ テンプレートセクションの削除: Notion APIの `DELETE /v1/blocks/{block_id}` エンドポイントを使用
- ✅ 投稿者名の取得方法: Slack APIの `users.info` エンドポイントを使用して `user.profile.display_name` または `user.profile.real_name` を取得

### 11.2 実装時の注意事項
- Notion APIのブロック追加/削除の仕様を確認（エンドポイントとリクエスト形式）
- Slackリンクのプレビュー形式での追加方法（URLを `rich_text` として追加）
- ページネーション対応（大量の通知がある場合）
- 営業日の計算ロジック（前営業日までの期間を正確に計算）
- Slack APIの `users.info` の呼び出し回数に注意（レート制限）
- **日付プロパティ名の確認**: Notionデータベースの日付プロパティの実際の名称を確認（「日付」以外の可能性もある）
- **Text検索の優先順位**: タイトル検索 → 日付プロパティ検索 → フォールバック検索の順で実装

---

**作成日**: 2025年1月29日  
**作成者**: AI Assistant  
**バージョン**: 1.4  
**更新履歴**:
- 2025-01-29: 初版作成
- 2025-01-29: v1.1 更新
  - タイトル形式を明確化（Notionの日付変数を使用）
  - 祝日の判定方法を詳細化（既存コードを参考）
  - Slack投稿者名の取得方法を追加（users.info API）
  - 営業日計算ロジックを詳細化（金曜日の特別ルールを含む）
  - Slackリンクのプレビュー表示方法を明確化
  - テンプレートセクションの削除方法を追加
- 2025-01-29: v1.2 更新
  - Notionの日付変数の詳細仕様を追加（@今日、@昨日、@2025年1月29日、@月曜日、@前の日曜日など）
  - ページ検索ロジックを拡張（複数の日付変数パターンに対応）
  - 日付フォーマット変換関数の実装仕様を追加
- 2025-01-29: v1.3 更新 Final
  - Notionオートメーションルール「朝会」の詳細を追加（ページ作成プロセスの明確化）
  - オートメーションでの「翌営業日」計算ロジックを追加（金曜日は3日後、それ以外は1日後）
  - タイトル生成方法を明確化（`翌営業日日付 + replace(追加されたページ.件名, "<<日次>>", "")`）
  - 祝日が考慮されていないことを明記（GAS側での検索時に考慮が必要）
- 2025-01-29: v1.4 更新
  - 日付プロパティによる検索方法を追加（タイトル検索のフォールバックとして）
  - 検索の優先順位を明確化（タイトル検索 → 日付プロパティ検索 → フォールバック検索）
  - 日付プロパティ検索用のAPI仕様と実装関数を追加

