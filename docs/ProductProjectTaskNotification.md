# プロダクト・プロジェクト別タスク通知システム 要件定義書

## 1. 概要

### 1.1 目的
NotionのタスクDBから特定のプロダクト・プロジェクトに紐づくタスクを取得し、プロダクト・プロジェクトごとの責任者（スクラムマスター・PjM）に個別通知することで、効率的なタスク管理を実現する。

### 1.2 対象システム
- **データベース**: NotionタスクDB
- **データベースID**: `afafabe758044461a3e9e9b4c037e5aa`
- **取得対象**: 特定プロダクト・プロジェクトの今日期限・期限切れタスク

## 2. 機能要件

### 2.1 基本機能
- **プロダクト別タスク取得**: Notionのプロダクトプロパティに対象プロダクトが入力されているタスクを取得
- **プロジェクト別タスク取得**: Notionのプロジェクトプロパティに対象プロジェクトが入力されているタスクを取得
- **期限条件**: 今日期限のタスクと期限切れのタスクを対象
- **プロダクト別通知**: プロダクトごとにスクラムマスターをメンションして各チャンネルに通知
- **プロジェクト別通知**: プロジェクトごとにPjMをメンションして各チャンネルに通知（チャンネル情報収集中のため実装は後回し）

### 2.2 取得条件

#### 2.2.1 プロダクト別タスク取得
```
フィルタ条件:
- プロパティ: プロダクト（プロパティ名要確認）
- 値: 対象プロダクト名（product_scrum_master_mapping.md参照）
- 期限条件: 今日期限 OR 期限切れ
- 取得件数: 全件取得（ページネーション対応）
```

#### 2.2.2 プロジェクト別タスク取得
```
フィルタ条件:
- プロパティ: プロジェクト（プロパティ名要確認）
- 値: 対象プロジェクト名（product_project_mapping.md参照）
- 期限条件: 今日期限 OR 期限切れ
- 取得件数: 全件取得（ページネーション対応）
```

### 2.3 対象プロダクト・プロジェクト

#### 2.3.1 対象プロダクト（product_scrum_master_mapping.md参照）
| プロダクト名 | スクラムマスター | メールアドレス | プロダクト開発チャンネルID | スクラムマスターSlackユーザーID |
|-------------|-----------------|----------------|---------------------------|-----------------------------|
| Sakuden | 居原田 崇史 | takashi.iharada@playground.live | C4TU3K80K | U08TLQTUJ21 |
| Eitoku(MOALA認証) | 渡部 愛菜 | aina.watanabe@playground.live | C01EGQMSZKL | U048M5NP6M6 |
| Tanyu(MOALA認証+ ) | 渡部 愛菜 | aina.watanabe@playground.live | C08DJQCDY4F | U048M5NP6M6 |
| Zeami (BioQR) | 花輪 真輝 | masaki.hanawa@playground.live | C07G1TDVDS5 | U05HPC0BL3V |
| Hokushin(MLS) | 井口 新一郎 | shinichiro.inokuchi@playground.live | 未設定 | U04HB81EUTS |
| Karaku | 井口 新一郎 | shinichiro.inokuchi@playground.live | C06RCNLQXPE | U04HB81EUTS |
| Karaku Web | 渡部 愛菜 | aina.watanabe@playground.live | C07ENRL7EAF | U048M5NP6M6 |
| Karaku Admin | 渡部 愛菜 | aina.watanabe@playground.live | C05UTQG55GR | U048M5NP6M6 |
| Juko (MA) | 花輪 真輝 | masaki.hanawa@playground.live | C055TBXD3PC | U05HPC0BL3V |
| Duchamp(MP) | 渡部 愛菜 | aina.watanabe@playground.live | C03K2GKH2P9 | U048M5NP6M6 |
| Pollock(MP2) | 渡部 愛菜 | aina.watanabe@playground.live | C08TSQCTEUT | U048M5NP6M6 |
| Rick (MS) | 花輪 真輝 | masaki.hanawa@playground.live | C0685K9KVH9 | U05HPC0BL3V |
| 抽選プロダクト | 花輪 真輝 | masaki.hanawa@playground.live | C07EN5VTL94 | U05HPC0BL3V |

#### 2.3.2 対象プロジェクト（product_project_mapping.md参照）
| プロジェクト名 | PjM | メールアドレス | プロジェクトチャンネルID | PjM SlackユーザーID |
|---------------|-----|----------------|---------------------------|--------------------|
| Sakura | 花輪 真輝 | masaki.hanawa@playground.live |  | U05HPC0BL3V |
| Mukuge Phase 1 | 鈴木 遼 | ryo.suzuki@playground.live | C097UBAK886 | U9ZFLRRG9 |
| HIROMITSU KITAYAMA LIVE TOUR 2025「波紋-HAMON-」 | 鈴木 遼 | ryo.suzuki@playground.live | C08Q0V8UKMH | U9ZFLRRG9 |
| BE:FIRST 2nd Fan Meeting -Hello My "BESTY" vol.2- | 鈴木 遼 | ryo.suzuki@playground.live | C08NGHKS1B4 | U9ZFLRRG9 |
| Animate Girls Festival 2025 karaku/MA連携 | 井口 新一郎 | shinichiro.inokuchi@playground.live |  | U04HB81EUTS |
| MLS保守 | 井口 新一郎 | shinichiro.inokuchi@playground.live | C01BLD36T6K | U04HB81EUTS |
| UpfrontID連携 | 井口 新一郎 | shinichiro.inokuchi@playground.live |  | U04HB81EUTS |
| 東京ドーム | 井口 新一郎 | shinichiro.inokuchi@playground.live | C03MHJR5RSR | U04HB81EUTS |

### 2.4 取得データ項目
以下のタスク情報を取得する：

| 項目名 | プロパティID | データ型 | 説明 |
|--------|-------------|----------|------|
| タスク名 | title | title | タスクのタイトル |
| タスクID | notion://tasks/auto_increment_id_property | unique_id | タスクの一意識別子 |
| 担当者 | notion://tasks/assign_property | people | タスク担当者 |
| ステータス | notion://tasks/status_property | status | タスクの現在ステータス |
| 期限 | notion://tasks/due_date_property | date | タスクの期限日 |
| プロダクト | Product | rollup | タスクの所属プロダクト（rollup型） |
| プロジェクト | プロジェクトプロパティ | select/relation | タスクの所属プロジェクト |
| 最終更新日時 | fDL%5C | last_edited_time | 最終更新日時 |
| 作成者 | c%7C%7CS | created_by | タスク作成者 |
| Issue | notion://tasks/task_to_project_relation | relation | 関連するIssue |

### 2.5 Slack通知機能

#### 2.5.1 プロダクト別通知
- **投稿チャンネル**: 各プロダクトの開発チャンネル（product_scrum_master_mapping.md参照）
- **メンション対象**: 該当プロダクトのスクラムマスター
- **投稿形式**: 構造化されたメッセージ（ブロック形式）
  - **期限切れタスク**: 昨日までの期限切れタスクを「🔔 未完了タスク一覧」として表示
  - **今日期限タスク**: 今日期限のタスクを「📅 今日期限のタスク一覧」として表示
- **投稿タイミング**: 定期実行または手動実行

#### 2.5.2 プロジェクト別通知
- **投稿チャンネル**: 各プロジェクトのチャンネル（情報収集中のため実装は後回し）
- **メンション対象**: 該当プロジェクトのPjM
- **投稿形式**: 構造化されたメッセージ（ブロック形式）
- **投稿タイミング**: 定期実行または手動実行

## 3. 技術要件

### 3.1 API仕様

#### 3.1.1 プロダクト別タスク取得API
```javascript
// データベースクエリAPI
POST /v1/databases/{database_id}/query

    // リクエストパラメータ（プロダクト別）
    {
      "database_id": "afafabe758044461a3e9e9b4c037e5aa",
      "filter": {
        "and": [
          // 期限条件: 最古期限以降 かつ (昨日まで OR 今日)
          {
            "and": [
              {
                "property": "Task期限",
                "date": {
                  "on_or_after": "2025-01-01" // 全体の最古期限
                }
              },
              {
                "or": [
                  {
                    "property": "Task期限",
                    "date": {
                      "on_or_before": "昨日の日付"
                    }
                  },
                  {
                    "property": "Task期限",
                    "date": {
                      "equals": "今日の日付"
                    }
                  }
                ]
              }
            ]
          },
          {
            "property": "Task期限",
            "date": { "is_not_empty": true }
          },
          // ステータス条件: Taskステータス が「未着手」または「実行中」
          {
            "or": [
              { "property": "Taskステータス", "status": { "equals": "未着手" } },
              { "property": "Taskステータス", "status": { "equals": "実行中" } }
            ]
          }
        ]
      },
      "page_size": 100
    }
    
    // 最適化: 13プロダクト条件をフィルターに追加して処理効率を向上
    // プロダクト条件: 13プロダクトのいずれかに該当するタスクのみを取得
```

#### 3.1.2 プロジェクト別タスク取得API
```javascript
// データベースクエリAPI
POST /v1/databases/{database_id}/query

// リクエストパラメータ（プロジェクト別）
{
  "database_id": "afafabe758044461a3e9e9b4c037e5aa",
  "filter": {
    "and": [
      {
        "property": "プロジェクトプロパティ名",
        "select": {
          "equals": "プロジェクト名"
        }
      },
      {
        "or": [
          {
            "property": "[Issue/Task]最早[期限/実施日]status",
            "formula": {
              "string": {
                "equals": "0.期限切れ"
              }
            }
          },
          {
            "property": "[Issue/Task]最早[期限/実施日]status",
            "formula": {
              "string": {
                "equals": "1.今日期限"
              }
            }
          }
        ]
      }
    ]
  },
  "page_size": 100
}
```

### 3.2 Slack API仕様

#### 3.2.1 プロダクト別通知
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
        "text": "🚨 [プロダクト名] タスク通知"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "<@スクラムマスターSlackID> 以下のタスクが期限切れ・今日期限です："
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

#### 3.2.2 プロジェクト別通知（実装は後回し）
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
        "text": "🚨 [プロジェクト名] タスク通知"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "<@PjMSlackID> 以下のタスクが期限切れ・今日期限です："
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

## 4. 非機能要件

### 4.1 パフォーマンス
- **応答時間**: 15秒以内（プロダクト・プロジェクト別処理対応）
- **取得件数**: 全件取得（ページネーション対応）
- **1回あたりの取得件数**: 最大100件（Notion API制限）
- **ページネーション**: 自動的に全ページを取得

### 4.2 可用性
- **稼働率**: 99%以上
- **エラーハンドリング**: API接続エラー時の適切なエラーメッセージ表示
- **部分失敗対応**: 一部プロダクト・プロジェクトでエラーが発生しても他は継続処理

### 4.3 セキュリティ
- **認証**: Notion API認証トークン使用
- **権限**: データベース読み取り権限のみ
- **Slack認証**: 適切なWebhook URL使用

## 5. 実装仕様

### 5.1 処理フロー
1. **プロダクト別タスク取得**: 各プロダクトごとにタスクを取得
2. **プロジェクト別タスク取得**: 各プロジェクトごとにタスクを取得
3. **プロダクト別通知**: 各プロダクトのスクラムマスターにメンションして通知
4. **プロジェクト別通知**: 各プロジェクトのPjMにメンションして通知（実装は後回し）

### 5.2 データ処理
- **フィルタリング**: 期限・ステータス条件でタスクを抽出後、JavaScriptレベルでプロダクト別に分類
- **プロダクト情報取得**: Issueプロパティからプロダクト情報を抽出
- **ページネーション**: 全ページを自動取得（100件ずつ）
- **ソート**: 期限日順（古い順）
- **データ整形**: 表示用にデータを整形
- **Slack用データ整形**: Slack投稿用のデータ構造変換
- **メンション生成**: スクラムマスター・PjMのSlackメンション文字列生成

### 5.3 設定管理
- **プロダクト設定**: product_scrum_master_mapping.mdから読み込み
- **プロジェクト設定**: product_project_mapping.mdから読み込み
- **Slack設定**: 各チャンネルのWebhook URL設定

## 6. 出力形式

### 6.1 コンソール出力
```
=== プロダクト・プロジェクト別タスク通知開始 ===

=== プロダクト別タスク取得 ===
Sakuden: 3件のタスクを取得
Kano-Eitoku: 5件のタスクを取得
...

=== プロジェクト別タスク取得 ===
Sakura: 2件のタスクを取得
Mukuge: 4件のタスクを取得
...

=== プロダクト別通知 ===
Sakuden: スクラムマスター（居原田 崇史）に通知完了
Kano-Eitoku: スクラムマスター（渡部 愛菜）に通知完了
...

=== プロジェクト別通知 ===
Sakura: PjM（花輪 真輝）に通知完了
Mukuge: PjM（渡部 愛菜）に通知完了
...

=== 通知完了 ===
```

### 6.2 JSON出力
```json
{
  "product_notifications": [
    {
      "product_name": "Sakuden",
      "scrum_master": "居原田 崇史",
      "channel_id": "C4TU3K80K",
      "tasks": [
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
      "total_count": 3,
      "notification_status": "success"
    }
  ],
  "project_notifications": [
    {
      "project_name": "Sakura",
      "pjm": "花輪 真輝",
      "channel_id": "",
      "tasks": [
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
      "total_count": 2,
      "notification_status": "success"
    }
  ],
  "retrieved_at": "2025-01-27T15:30:00Z"
}
```

## 7. エラーハンドリング

### 7.1 想定エラー
- **API接続エラー**: ネットワーク接続不可
- **認証エラー**: 無効なAPIトークン
- **権限エラー**: データベースアクセス権限なし
- **データなし**: 対象プロダクト・プロジェクトのタスクが存在しない
- **Slack投稿エラー**: Webhook URL無効、チャンネル権限なし
- **メンションエラー**: スクラムマスター・PjMのSlack ID取得失敗
- **プロパティ名エラー**: プロダクト・プロジェクトプロパティ名が存在しない

### 7.2 エラー対応
```javascript
try {
  // プロダクト別処理
  for (const product of products) {
    try {
      const tasks = await getProductTasks(product.name);
      if (tasks.length > 0) {
        await sendProductNotification(product, tasks);
        console.log(`${product.name}: 通知完了`);
      } else {
        console.log(`${product.name}: 対象タスクなし`);
      }
    } catch (productError) {
      console.error(`${product.name}: エラー - ${productError.message}`);
      // 他のプロダクトの処理は継続
    }
  }
  
  // プロジェクト別処理
  for (const project of projects) {
    try {
      const tasks = await getProjectTasks(project.name);
      if (tasks.length > 0) {
        await sendProjectNotification(project, tasks);
        console.log(`${project.name}: 通知完了`);
      } else {
        console.log(`${project.name}: 対象タスクなし`);
      }
    } catch (projectError) {
      console.error(`${project.name}: エラー - ${projectError.message}`);
      // 他のプロジェクトの処理は継続
    }
  }
} catch (globalError) {
  console.error(`全体エラー: ${globalError.message}`);
}
```

## 8. テスト仕様

### 8.1 単体テスト
- プロダクト別タスク取得機能の動作確認
- プロジェクト別タスク取得機能の動作確認
- フィルタ条件の正確性確認
- データ形式の妥当性確認
- ページネーション機能の動作確認
- Slack通知機能の動作確認

### 8.2 統合テスト
- Notion API連携テスト
- Slack API連携テスト
- エラーハンドリングテスト
- パフォーマンステスト
- 部分失敗時の継続処理テスト

## 9. 運用要件

### 9.1 監視項目
- プロダクト別取得件数
- プロジェクト別取得件数
- 通知成功率（プロダクト別・プロジェクト別）
- API呼び出し回数
- 応答時間
- エラー発生率
- メンション対象者数

### 9.2 ログ出力
- 実行ログ
- エラーログ
- パフォーマンスログ
- Slack投稿ログ
- メンション対象者ログ

## 10. 実装優先度

### 10.1 Phase 1（優先実装）
- プロダクト別タスク取得機能
- プロダクト別Slack通知機能
- 基本的なエラーハンドリング

### 10.2 Phase 2（後回し実装）
- プロジェクト別タスク取得機能
- プロジェクト別Slack通知機能
- プロジェクトチャンネル情報の収集・設定

## 11. 未確定事項

### 11.1 要確認項目
- ~~Notionのプロダクトプロパティ名~~ ✅ **確認済み: "Product"**
- Notionのプロジェクトプロパティ名
- 期限切れ・今日期限のステータス値
- プロジェクトチャンネルID（product_project_mapping.mdで未設定）

### 11.2 実装時の修正履歴

#### 2025年1月27日 19:30 - プロダクト条件フィルターの追加と通知形式の改善
- **問題**: 13プロダクト以外のタスクも取得して処理時間が長い
- **修正内容**: Notion APIフィルターに13プロダクト条件を追加、通知形式を期限別に分離
- **修正前**: 期限・ステータスのみでフィルタ後、JavaScriptでプロダクト分類
- **修正後**: 期限・ステータス・プロダクト条件でフィルタ、期限切れと今日期限を分けて表示
- **期待効果**: 処理時間を30-70%短縮、通知の可読性向上

#### 2025年1月27日 19:15 - プロダクト名の修正
- **問題**: CSVの実際のプロダクト名とコードの設定が一致しない
- **修正内容**: 13プロダクトの名前をCSVの実際の名前に合わせて修正
- **修正前**: Kano-Eitoku, Kano-Tanyu, Zeami, Hokushin, Karaku-Admin, Juko, Duchamp, Pollock, Rick, Raffle
- **修正後**: Eitoku(MOALA認証), Tanyu(MOALA認証+ ), Zeami (BioQR), Hokushin(MLS), Karaku Admin, Juko (MA), Duchamp(MP), Pollock(MP2), Rick (MS), 抽選プロダクト

#### 2025年1月27日 18:45 - タスク取得の最適化
- **問題**: 全タスク取得で処理時間が長い（433件）
- **修正内容**: 全体の最古期限（2025-08-01）以降のタスクのみ取得
- **修正前**: 無制限の期限条件で全タスク取得
- **修正後**: 最古期限以降 + 期限切れ・今日期限の条件で絞り込み
- **期待効果**: 処理時間を1/5〜1/10程度に短縮、API呼び出し回数削減

#### 2025年1月27日 18:19 - 実装方法の根本的変更
- **問題**: Product rollupプロパティが空（Issueリレーション未設定）
- **修正内容**: フィルタベースからJavaScriptレベルでのフィルタリングに変更
- **修正前**: Notion APIレベルでProductプロパティをフィルタ
- **修正後**: 期限・ステータスでフィルタ後、JavaScriptでIssueプロパティからプロダクト情報を抽出

#### 2025年1月27日 18:04 - プロダクトプロパティ型の修正
- **問題**: Productプロパティがrollup型であることが判明
- **修正内容**: フィルタ条件をselect型からrollup型に対応
- **修正前**:
  ```javascript
  "property": "Product",
  "select": { "equals": productName }
  ```
- **修正後**:
  ```javascript
  "property": "Product",
  "rollup": {
    "any": {
      "rich_text": { "equals": productName }
    }
  }
  ```

#### 2025年1月27日 18:01 - プロダクトプロパティ名の修正
- **問題**: プロパティ名「プロダクト」が存在しない
- **修正内容**: 正しいプロパティ名「Product」に変更
- **修正前**: `"property": "プロダクト"`
- **修正後**: `"property": "Product"`

### 11.2 後回し実装項目
- プロジェクト別通知機能（チャンネル情報収集中のため）

---

**作成日**: 2025年9月1日  
**作成者**: AI Assistant  
**バージョン**: 1.3  
**更新日**: 2025年1月27日  
**更新内容**: プロダクト名修正、プロダクト条件フィルター追加、通知形式改善
