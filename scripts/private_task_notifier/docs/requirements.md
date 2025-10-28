# 個人タスク通知ボット 要件定義書

## 1. 概要

### 1.1 目的
NotionのタスクDBインターから花輪 真輝が担当するタスク多了取得し、期限切れ・今日期限・今週期限の3種類に分類してSlackに通知することで、個人のタスク管理を効率化する。

### 1.2 対象システム
- **データベース**: Notion Task DB (`afafabe758044461a3e9e9b4c037e5aa`)
- **通知先**: Slack チャンネル `C09NX2B48BV`
- **取得対象**: 花輪 真輝が担当するタスク（期限切れ/今日期限/今週期限）

### 1.3 担当者情報
- **名前**: 花輪 真輝
- **メールアドレス**: masaki.hanawa@playground.live
- **Slack ID**: U05HPC0BL3V
- **Notion User ID**: 889b7bc4-3dcc-46cd-9995-d57d0a3bc81f

---

## 2. 要件定義

### 2.1 タスク抽出条件
- **対象タスク**: 花輪 真輝が担当するタスクのみ
- **ステータス条件**: 未完了のみ（完了・キャンセル・バックログ・実行完了を除外）
- **期限条件**: 以下の3種類
  - **期限切れ**: 昨日までの期限が設定されているタスク
  - **今日期限**: 今日が期限日
  - **今週期限**: 今週中（日曜日～土曜日）が期限日
- **タイムゾーン**: Asia/Tokyo (JST)

### 2.2 タスク分類
- 3種類の期限カテゴリ別に分けて通知
- 各カテゴリ内は期限日順（古い順）でソート
- プロジェクト/プロダクト別のグループ化は不要

### 2.3 通知先Slack設定
- **チャンネルID**: `C09NX2B48BV`
- **メンション対象**: 花輪 真輝 (`<@U05HPC0BL3V>`)
- **通知形式**: Slack Block Kit形式

### 2.4 通知タイミング・頻度
- **通知頻度**: 毎日1回（平日のみ）
- **通知時間帯**: 朝（10:00-11:00の間で1回）
- **土日祝日対応**: スキップ
- **二重送信防止**: 同一日の通知は1回のみ

### 2.5 通知形式・内容
- **ヘッダー**: 3種類のタスク件数サマリー
- **メンション**: 花輪 真輝をメンション
- **3つのセクション**:
  1. ⚠️ 期限切れタスク（昨日までの期限）
  2. 📅 今日期限のタスク
  3. 📆 今週期限のタスク（今日以外）
- **各タスクに表示する情報**:
  - タスク名（Notionリンク付き）
  - 期限日（相対表記：例「今日(1/28(火))」「明日(1/29(水))」）
  - ステータス
  - プロジェクト/プロダクト名（あれば）
- **フッター**: 取得日時（JST）

### 2.6 エラーハンドリング
- **エラー通知先**: 通知先チャンネルと同じ (`C09NX2B48BV`)
- **エラー内容**: 関数名、エラー詳細、発生時刻
- **継続処理**: 一部のエラーが発生しても可能な限り処理を継続

---

## 3. 技術要件

### 3.1 環境
- **開発環境**: Google Apps Script (GAS)
- **連携API**: Notion API、Slack API
- **言語**: JavaScript

### 3.2 Notion API仕様

#### 3.2.1 タスク抽出フィルタ
```javascript
// 期限切れタスク
{
  "and": [
    {
      "property": "担当者",
      "people": { "contains": "889b7bc4-3dcc-46cd-9995-d57d0a3bc81f" }
    },
    { "property": "Taskステータス", "status": { "does_not_equal": "完了" } },
    { "property": "Taskステータス", "status": { "does_not_equal": "キャンセル" } },
    { "property": "Taskステータス", "status": { "does_not_equal": "バックログ" } },
    { "property": "Task期限", "date": { "before": "今日" } },
    { "property": "Task期限", "date": { "is_not_empty": true } }
  ]
}

// 今日期限タスク
{
  "and": [
    {
      "property": "担当者",
      "people": { "contains": "889b7bc4-3dcc-46cd-9995-d57d0a3bc81f" }
    },
    { "property": "Taskステータス", "status": { "does_not_equal": "完了" } },
    { "property": "Task期限", "date": { "equals": "今日" } }
  ]
}

// 今週期限タスク（今日以外）
{
  "and": [
    {
      "property": "担当者",
      "people": { "contains": "889b7bc4-3dcc-46cd-9995-d57d0a3bc81f" }
    },
    { "property": "Taskステータス", "status": { "does_not_equal": "完了" } },
    { "property": "Task期限", "date": { "after": "今日" } },
    { "property": "Task期限", "date": { "on_or_before": "今週末" } }
  ]
}
```

### 3.3 Slack API仕様

#### 3.3.1 通知例
```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 花輪 真輝のタスク通知"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "<@U05HPC0BL3V> 以下のタスクがあります:"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "総件数: 8件（期限切れ: 3／今日期限: 2／今週期限: 3）"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "⚠️ *期限切れのタスク（3件）*\n• <リンク|タスク名1>（1/25(金) +3日超過 実行中）\n• <リンク|タスク名2>（1/26(土) +2日超過 未着手）"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📅 *今日期限のタスク（2件）*\n• <リンク|タスク名3>（今日(1/28(火)) 実行中）"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📆 *今週期限のタスク（3件）*\n• <リンク|タスク名4>（明日(1/29(水)) 未着手）\n• <リンク|タスク名5>（1/30(木) 実行中）"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "取得日時: 2025/01/28 10:15:23（JST）"
        }
      ]
    }
  ]
}
```

### 3.4 設定値（GAS Script Properties）
- `NOTION_API_TOKEN`: Notion APIトークン
- `NOTION_TASK_DB_ID`: `afafabe758044461a3e9e9b4c037e5aa`
- `SLACK_BOT_TOKEN`: Slack Botトークン
- `SLACK_CHANNEL_ID`: `C09NX2B48BV`
- `NOTION_USER_ID`: `889b deducedbc4-3dcc-46cd-9995-d57d0a3bc81f`（花輪 真輝）
- `SLACK_USER_ID`: `U05HPC0BL3V`

### 3.5 処理フロー
1. **ガード**: JST現在が平日か、通知済みかを確認
2. **タスク取得**: 3つのカテゴリ（期限切れ/今日/今週）ごとにNotion APIで取得
3. **データ整形**: 取得したタスクをタスクオブジェクトに変換
4. **分類**: 3つのカテゴリに分けてソート（期限日順）
5. **Slack通知**: Block Kit形式でメッセージ生成し送信
6. **記録**: 成功したら実行日を記録

### 3.6 エラーハンドリング
- Notion API エラー: エラーログを出力し、Slackに通知
- Slack API エラー: リトライ3回まで実行
- チャンネル参加エラー: `conversations.join` を実行してリトライ
- 部分失敗: エラーログは出力するが、成功した部分は処理を継続

---

## 4. 実装計画

### 4.1 優先実装項目
1. Notion APIからタスク取得機能
2. 3種類の期限カテゴリ別取得・分類機能
3. Slack通知機能（Block Kit）
4. 平日判定・二重送信防止
5. エラーハンドリング

### 4.2 テスト項目
1. 平日判定・土日祝日スキップの動作確認
2. 3種類のタスク分類の正確性
3. Slack通知の送信確認
4. 弯曲時の継続処理確認

---

**作成日**: 2025年1月28日  
**作成者**: AI Assistant  
**バージョン**: 1.0（確定版）
