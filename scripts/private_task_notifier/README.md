# 個人タスク通知ボット

## 概要
NotionとSlackを連携した個人タスク期限通知システム

## 機能
- Notionから花輪 真輝が担当するタスクを取得
- 期限切れ・今日期限・今週期限の3種類に分類
- Slackに通知を送信

## ファイル構成
```
private_task_notifier/
├── private_task-notifier.js  # メインスクリプト
├── docs/
│   └── requirements.md       # 要件定義書
└── README.md                 # このファイル
```

## 設定項目
- `NOTION_API_TOKEN`: Notion APIトークン
- `NOTION_TASK_DB_ID`: `afafabe758044461a3e9e9b4c037e5aa`
- `SLACK_BOT_TOKEN`: Slack Botトークン
- `SLACK_CHANNEL_ID`: `C09NX2B48BV`
- `NOTION_USER_ID`: `889b7bc4-3dcc-46cd-9995-d57d0a3bc81f`（花輪 真輝）
- `SLACK_USER_ID`: `U05HPC0BL3V`

## 主要機能
- `runPersonalTaskNotifier()` - メイン処理
- 3種類のタスク取得（期限切れ/今日/今週）
- 平日判定・二重送信防止
- エラーハンドリング

## 使用方法
1. GAS環境でScript Propertiesを設定
2. `runPersonalTaskNotifier()` を実行
3. トリガー設定で定期実行（平日10:00-11:00）

## 更新履歴
- 2025-01-28: 初回要件定義完了

