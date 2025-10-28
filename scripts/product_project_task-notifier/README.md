# タスク通知ボット

## 概要
NotionとSlackを連携したタスク期限通知システム

## 機能
- Notionから期限切れ・今日期限のタスクを取得
- Slackに通知を送信
- プロダクトとプロジェクトの両方に対応
- Issue別にタスクをグループ化

## ファイル構成
```
task-notifier/
├── task_notifier.js        # メインスクリプト
├── ARCHIVES_RULES.md       # アーカイブルール
└── README.md              # このファイル
```

## 設定項目
- NOTION_API_TOKEN
- NOTION_TASK_DB_ID
- NOTION_PRODUCT_DB_ID
- NOTION_PROJECT_DB_ID
- SLACK_BOT_TOKEN

## 主要関数
- `runProductTaskNotifier()` - プロダクト向けメイン処理
- `runProjectTaskNotifier()` - プロジェクト向けメイン処理
- `testAllProductsTaskNotification()` - 全プロダクトテスト
- `testAllProjectsTaskNotification()` - 全プロジェクトテスト

## 使用方法
1. GAS環境でScript Propertiesを設定
2. `runProductTaskNotifier()` または `runProjectTaskNotifier()` を実行
3. トリガー設定で定期実行

## 更新履歴
- 2025-10-14: 初回リリース
