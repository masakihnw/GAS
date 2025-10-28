# Slack投稿例 - 期限切れタスク通知

## 概要
このドキュメントは、Notionデータベースから取得した期限切れタスクをSlackに投稿する際の実例を示します。

## 取得データ（2025年1月27日時点）

### 期限切れタスク一覧
現在、期限切れタスクは **0件** です。

```
期限切れタスク: 0件
取得日時: 2025年1月27日
データベース: Notion Tasks Database
フィルター: [Issue/Task]最早[期限/実施日]status = "0.期限切れ"
```

## Slack投稿例

### 1. 期限切れタスクがある場合

#### 投稿メッセージ形式
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
        "text": "以下のタスクが期限切れとなっています。\n\n*<@U1234567890> タスク名1*\n期限: 2025/01/25 | 優先度: 高 | 進捗: 30%\n\n*<@U0987654321> タスク名2*\n期限: 2025/01/26 | 優先度: 中 | 進捗: 60%"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "📊 総件数: 2件 | 📅 取得日時: 2025/01/27 15:30"
        }
      ]
    }
  ]
}
```

#### 実際のSlack投稿例（リマインド形式）
```
🚨 期限切れタスク通知

以下のタスクが期限切れとなっています。

<@U1234567890> タスク名1
期限: 2025/01/25 | 優先度: 高 | 進捗: 30%

<@U0987654321> タスク名2  
期限: 2025/01/26 | 優先度: 中 | 進捗: 60%

─────────────────────────
📊 総件数: 2件 | 📅 取得日時: 2025/01/27 15:30
```

#### 投稿結果（Slack表示）
```
🚨 期限切れタスク通知

以下のタスクが期限切れとなっています。

@田中太郎 タスク名1
期限: 2025/01/25 | 優先度: 高 | 進捗: 30%

@佐藤花子 タスク名2
期限: 2025/01/26 | 優先度: 中 | 進捗: 60%

─────────────────

📊 総件数: 2件 | 📅 取得日時: 2025/01/27 15:30
```

#### リマインド投稿の特徴
- **メンション機能**: 担当者全員に`@ユーザー名`でメンション
- **視覚的アラート**: 🚨 アイコンで緊急性を表現
- **構造化情報**: 期限、優先度、進捗を一目で確認
- **統計情報**: 総件数と取得日時で状況把握

### 2. 期限切れタスクがない場合

#### 投稿メッセージ形式
```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "✅ 期限切れタスク確認"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "現在、期限切れのタスクはありません。\n\n素晴らしい進捗です！ 🎉"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "📅 確認日時: 2025/01/27 15:30"
        }
      ]
    }
  ]
}
```

#### 投稿結果（Slack表示）
```
✅ 期限切れタスク確認

現在、期限切れのタスクはありません。

素晴らしい進捗です！ 🎉

─────────────────

📅 確認日時: 2025/01/27 15:30
```

#### 確認完了投稿の特徴
- **ポジティブメッセージ**: ✅ アイコンで良好な状況を表現
- **励ましの言葉**: チームの努力を認めるメッセージ
- **定期確認**: システムが正常に動作していることを確認
- **透明性**: 確認日時を明記して信頼性を向上

## 実装コード例

### リマインド機能の実装ポイント

#### 1. メンション生成
```python
def generate_mentions(assignees):
    """担当者のSlackメンション文字列を生成"""
    mentions = []
    for assignee in assignees:
        slack_id = get_slack_id_from_notion_user(assignee)
        if slack_id:
            mentions.append(f"<@{slack_id}>")
        else:
            mentions.append(f"@{assignee['name']}")  # フォールバック
    return mentions
```

#### 2. リマインドメッセージ作成
```python
def create_reminder_message(tasks):
    """リマインド用メッセージを作成"""
    if not tasks:
        return create_no_expired_message()
    
    task_blocks = []
    for task in tasks:
        assignee_mention = f"<@{task['slack_id']}>" if task.get('slack_id') else f"@{task['assignee']}"
        task_block = f"*{assignee_mention} {task['name']}*\n期限: {task['due_date']} | 優先度: {task['priority']} | 進捗: {task['progress']}%"
        task_blocks.append(task_block)
    
    return {
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
                    "text": f"以下のタスクが期限切れとなっています。\n\n" + "\n\n".join(task_blocks)
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"📊 総件数: {len(tasks)}件 | 📅 取得日時: {datetime.now().strftime('%Y/%m/%d %H:%M')}"
                    }
                ]
            }
        ]
    }
```

### Python実装例
```python
import json
import requests
from datetime import datetime

def create_slack_message(expired_tasks):
    """期限切れタスクをSlackメッセージ形式に変換"""
    
    if not expired_tasks:
        # 期限切れタスクがない場合
        return {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "✅ 期限切れタスク確認"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "現在、期限切れのタスクはありません。\n\n素晴らしい進捗です！ 🎉"
                    }
                },
                {
                    "type": "divider"
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": f"📅 確認日時: {datetime.now().strftime('%Y/%m/%d %H:%M')}"
                        }
                    ]
                }
            ]
        }
    
    # 期限切れタスクがある場合
    task_texts = []
    for task in expired_tasks:
        assignee = task.get('assignee', '未設定')
        task_name = task.get('task_name', 'タスク名なし')
        due_date = task.get('due_date', '期限なし')
        priority = task.get('priority', '未設定')
        progress = task.get('progress', '0%')
        
        task_text = f"*<@{assignee}> {task_name}*\n期限: {due_date} | 優先度: {priority} | 進捗: {progress}"
        task_texts.append(task_text)
    
    return {
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
                    "text": f"以下のタスクが期限切れとなっています。\n\n" + "\n\n".join(task_texts)
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"📊 総件数: {len(expired_tasks)}件 | 📅 取得日時: {datetime.now().strftime('%Y/%m/%d %H:%M')}"
                    }
                ]
            }
        ]
    }

def post_to_slack(webhook_url, message):
    """Slackにメッセージを投稿"""
    try:
        response = requests.post(
            webhook_url,
            json=message,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Slack投稿エラー: {e}")
        return False

# 使用例
def main():
    # 期限切れタスクを取得（MCP使用）
    expired_tasks = get_expired_tasks_from_notion()
    
    # Slackメッセージを作成
    slack_message = create_slack_message(expired_tasks)
    
    # Slackに投稿
    webhook_url = "YOUR_SLACK_WEBHOOK_URL"
    success = post_to_slack(webhook_url, slack_message)
    
    if success:
        print("Slack投稿が完了しました")
    else:
        print("Slack投稿に失敗しました")
```

### Google Apps Script実装例
```javascript
function postExpiredTasksToSlack() {
  // 期限切れタスクを取得
  const expiredTasks = getExpiredTasksFromNotion();
  
  // Slackメッセージを作成
  const slackMessage = createSlackMessage(expiredTasks);
  
  // Slackに投稿
  const webhookUrl = "YOUR_SLACK_WEBHOOK_URL";
  const success = postToSlack(webhookUrl, slackMessage);
  
  if (success) {
    console.log("Slack投稿が完了しました");
  } else {
    console.log("Slack投稿に失敗しました");
  }
}

function createSlackMessage(expiredTasks) {
  const now = new Date();
  const timestamp = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm");
  
  if (!expiredTasks || expiredTasks.length === 0) {
    // 期限切れタスクがない場合
    return {
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "✅ 期限切れタスク確認"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "現在、期限切れのタスクはありません。\n\n素晴らしい進捗です！ 🎉"
          }
        },
        {
          "type": "divider"
        },
        {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": `📅 確認日時: ${timestamp}`
            }
          ]
        }
      ]
    };
  }
  
  // 期限切れタスクがある場合
  const taskTexts = expiredTasks.map(task => {
    const assignee = task.assignee || '未設定';
    const taskName = task.task_name || 'タスク名なし';
    const dueDate = task.due_date || '期限なし';
    const priority = task.priority || '未設定';
    const progress = task.progress || '0%';
    
    return `*<@${assignee}> ${taskName}*\n期限: ${dueDate} | 優先度: ${priority} | 進捗: ${progress}`;
  });
  
  return {
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
          "text": `以下のタスクが期限切れとなっています。\n\n${taskTexts.join('\n\n')}`
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": `📊 総件数: ${expiredTasks.length}件 | 📅 取得日時: ${timestamp}`
          }
        ]
      }
    ]
  };
}

function postToSlack(webhookUrl, message) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(message)
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, options);
    return response.getResponseCode() === 200;
  } catch (error) {
    console.error(`Slack投稿エラー: ${error}`);
    return false;
  }
}
```

## 設定項目

### 必須設定
1. **Slack Webhook URL**: SlackアプリのIncoming Webhook URL
2. **投稿チャンネル**: 通知を投稿するSlackチャンネル
3. **メンション対象**: タスク担当者のSlack ID
4. **Notion-Slack連携**: ユーザーIDのマッピング設定

### オプション設定
1. **投稿頻度**: 日次、週次、手動実行
2. **通知時間**: 営業時間内のみ、24時間対応
3. **重複防止**: 同一タスクの重複投稿防止
4. **エラー通知**: 投稿失敗時の管理者通知
5. **リマインド間隔**: 1日後、3日後、週次リマインド
6. **優先度別通知**: 高優先度タスクの優先通知

## 注意事項

### セキュリティ
- Webhook URLは機密情報として管理
- 必要最小限の権限でSlackアプリを設定
- 投稿内容に機密情報が含まれないよう注意
- Notion-Slack間のユーザーIDマッピングの安全な管理

### 運用
- 投稿頻度の調整（スパム防止）
- エラー時の再試行機能
- ログの適切な管理
- 担当者のSlack ID管理
- リマインド間隔の適切な設定
- チームメンバーの負担を考慮した通知頻度

### リマインド機能の注意点
- **適切な頻度**: 過度なリマインドは逆効果
- **メンション対象**: 実際に担当している人のみ
- **緊急性の表現**: 優先度に応じたアイコン・表現
- **フォローアップ**: リマインド後の進捗確認

---

**作成日**: 2025年1月27日  
**作成者**: AI Assistant  
**バージョン**: 1.0  
**対象**: 期限切れタスク通知システム 