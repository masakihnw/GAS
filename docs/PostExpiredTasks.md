# 期限切れタスク取得機能 要件定義書

## 1. 概要

### 1.1 目的
NotionのタスクDBから期限切れタスクを自動的に取得し、効率的なタスク管理を実現する。

### 1.2 対象システム
- **データベース**: NotionタスクDB
- **データベースID**: `afafabe758044461a3e9e9b4c037e5aa`
- **取得対象**: 期限切れタスク

## 2. 機能要件

### 2.1 基本機能
- **期限切れタスクの取得**: `[Issue/Task]最早[期限/実施日]status`カラムが"0.期限切れ"のタスクをすべて取得
- **MCP連携**: Notion APIを通じてデータベースにアクセス
- **一覧表示**: 取得したタスクの詳細情報を一覧形式で表示
- **Slack投稿**: 期限切れタスクをSlackチャンネルに投稿
- **メンション機能**: 担当者にSlackメンションでアナウンス

### 2.2 取得条件
```
フィルタ条件:
- プロパティ: [Issue/Task]最早[期限/実施日]status
- 値: "0.期限切れ"
- 取得件数: 全件取得（ページネーション対応）
- 1回あたりの取得件数: 最大100件（Notion API制限）
```

### 2.3 取得データ項目
以下のタスク情報を取得する：

| 項目名 | プロパティID | データ型 | 説明 |
|--------|-------------|----------|------|
| タスク名 | title | title | タスクのタイトル |
| タスクID | notion://tasks/auto_increment_id_property | unique_id | タスクの一意識別子 |
| 担当者 | notion://tasks/assign_property | people | タスク担当者 |
| ステータス | notion://tasks/status_property | status | タスクの現在ステータス |
| 期限 | notion://tasks/due_date_property | date | タスクの期限日 |
| 優先度 | 205a0e01-6df0-4fee-9adf-41481b0c10de | select | タスクの優先度 |
| 進捗率 | 3df3f64b-5f30-4c35-8720-4de181e8cef5 | number | タスクの進捗率（%） |
| 作成日時 | YOnk | created_time | タスク作成日時 |
| 最終更新日時 | fDL%5C | last_edited_time | 最終更新日時 |
| 作成者 | c%7C%7CS | created_by | タスク作成者 |
| Issue | notion://tasks/task_to_project_relation | relation | 関連するIssue |

### 2.4 Slack投稿機能
- **投稿チャンネル**: 設定可能なSlackチャンネル
- **メンション対象**: タスク担当者全員
- **投稿形式**: 構造化されたメッセージ（ブロック形式）
- **投稿タイミング**: 定期実行または手動実行
- **重複防止**: 同一タスクの重複投稿を防止

## 3. 技術要件

### 3.1 API仕様
```javascript
// データベースクエリAPI
POST /v1/databases/{database_id}/query

// リクエストパラメータ
{
  "database_id": "afafabe758044461a3e9e9b4c037e5aa",
  "filter": {
    "property": "[Issue/Task]最早[期限/実施日]status",
    "formula": {
      "string": {
        "equals": "0.期限切れ"
      }
    }
  },
  "page_size": 100
}
```

### 3.2 レスポンス形式
```json
{
  "object": "list",
  "results": [
    {
      "object": "page",
      "id": "タスクID",
      "properties": {
        "名前": { "title": [{ "text": { "content": "タスク名" } }] },
        "タスクID": { "unique_id": { "number": 12345 } },
        "担当者": { "people": [{ "name": "担当者名" }] },
        "Taskステータス": { "status": { "name": "ステータス名" } },
        "Task期限": { "date": { "start": "2025-01-01" } },
        // その他のプロパティ...
      }
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

### 3.3 Slack API仕様
```javascript
// Slack Webhook URL投稿
POST {SLACK_WEBHOOK_URL}

// リクエストパラメータ
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 期限切れタスク通知"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "以下のタスクが期限切れです："
      }
    },
    {
      "type": "divider"
    }
  ]
}
```

## 4. 非機能要件

### 4.1 パフォーマンス
- **応答時間**: 10秒以内（大量データ対応）
- **取得件数**: 全件取得（ページネーション対応）
- **1回あたりの取得件数**: 最大100件（Notion API制限）
- **ページネーション**: 自動的に全ページを取得

### 4.2 可用性
- **稼働率**: 99%以上
- **エラーハンドリング**: API接続エラー時の適切なエラーメッセージ表示

### 4.3 セキュリティ
- **認証**: Notion API認証トークン使用
- **権限**: データベース読み取り権限のみ

## 5. 実装仕様

### 5.1 MCP連携
```python
# MCP Notion API使用例（ページネーション対応）
def get_all_expired_tasks():
    all_tasks = []
    start_cursor = None
    
    while True:
        response = mcp_notionApi_API_post_database_query(
            database_id="afafabe758044461a3e9e9b4c037e5aa",
            filter={
                "property": "[Issue/Task]最早[期限/実施日]status",
                "formula": {
                    "string": {
                        "equals": "0.期限切れ"
                    }
                }
            },
            page_size=100,
            start_cursor=start_cursor
        )
        
        # 結果を追加
        all_tasks.extend(response.get("results", []))
        
        # 次のページがあるかチェック
        if not response.get("has_more", False):
            break
            
        # 次のページのカーソルを設定
        start_cursor = response.get("next_cursor")
    
    return all_tasks

# Slack投稿機能
def post_to_slack(expired_tasks):
    webhook_url = get_slack_webhook_url()
    blocks = create_slack_blocks(expired_tasks)
    
    payload = {
        "blocks": blocks
    }
    
    response = requests.post(webhook_url, json=payload)
    return response.status_code == 200
```

### 5.2 データ処理
- **フィルタリング**: 期限切れステータスのタスクのみ抽出
- **ページネーション**: 全ページを自動取得（100件ずつ）
- **ソート**: 期限日順（古い順）
- **データ整形**: 表示用にデータを整形
- **進捗表示**: 大量データ取得時の進捗状況表示
- **Slack用データ整形**: Slack投稿用のデータ構造変換
- **メンション生成**: 担当者のSlackメンション文字列生成

## 6. 出力形式

### 6.1 コンソール出力
```
=== 期限切れタスク取得中 ===
ページ1を取得中... (0-100件)
ページ2を取得中... (100-200件)
...
=== 期限切れタスク一覧 ===
総件数: X件

1. タスク名: [タスク名]
   ID: [タスクID]
   担当者: [担当者名]
   ステータス: [ステータス]
   期限: [期限日]
   優先度: [優先度]
   進捗率: [進捗率]%

2. タスク名: [タスク名]
   ...
```

### 6.2 JSON出力
```json
{
  "expired_tasks": [
    {
      "task_name": "タスク名",
      "task_id": "タスクID",
      "assignee": "担当者名",
      "status": "ステータス",
      "due_date": "期限日",
      "priority": "優先度",
      "progress": "進捗率"
    }
  ],
  "total_count": "総件数",
  "retrieved_at": "取得日時"
}
```

### 6.3 Slack投稿形式
```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 期限切れタスク通知"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "以下のタスクが期限切れです："
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "• <@U1234567890> タスク名 (期限: 2025/01/27)\n• <@U0987654321> タスク名2 (期限: 2025/01/26)"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "総件数: 5件 | 取得日時: 2025/01/27 15:30"
        }
      ]
    }
  ]
}
```

## 7. エラーハンドリング

### 7.1 想定エラー
- **API接続エラー**: ネットワーク接続不可
- **認証エラー**: 無効なAPIトークン
- **権限エラー**: データベースアクセス権限なし
- **データなし**: 期限切れタスクが存在しない
- **Slack投稿エラー**: Webhook URL無効、チャンネル権限なし
- **メンションエラー**: 担当者のSlack ID取得失敗

### 7.2 エラー対応
```python
try:
    all_tasks = get_all_expired_tasks()
    if all_tasks:
        print(f"期限切れタスクを{len(all_tasks)}件取得しました")
        display_tasks(all_tasks)
        
        # Slack投稿
        try:
            post_to_slack(all_tasks)
            print("Slack投稿が完了しました")
        except Exception as slack_error:
            print(f"Slack投稿エラー: {slack_error}")
    else:
        print("期限切れタスクはありません")
except Exception as e:
    print(f"エラーが発生しました: {e}")
    print("ページネーション処理中にエラーが発生した可能性があります")
```

## 8. テスト仕様

### 8.1 単体テスト
- 期限切れタスク取得機能の動作確認
- フィルタ条件の正確性確認
- データ形式の妥当性確認
- ページネーション機能の動作確認
- 大量データ取得時のパフォーマンス確認

### 8.2 統合テスト
- MCP Notion API連携テスト
- エラーハンドリングテスト
- パフォーマンステスト

## 9. 運用要件

### 9.1 監視項目
- API呼び出し回数（ページネーション回数）
- 総取得件数
- 応答時間（ページネーション全体）
- エラー発生率
- ページネーション処理の成功率
- Slack投稿成功率
- メンション対象者数
- 投稿チャンネル別統計

### 9.2 ログ出力
- 実行ログ
- エラーログ
- パフォーマンスログ
- Slack投稿ログ
- メンション対象者ログ

---

**作成日**: 2025年1月27日  
**作成者**: AI Assistant  
**バージョン**: 1.1  
**更新日**: 2025年1月27日  
**更新内容**: Slack投稿機能追加
