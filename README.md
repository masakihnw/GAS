# GAS開発環境 - 統一リポジトリ

## 概要
Google Apps Script (GAS) を使用した各種スクリプトの開発・管理統一リポジトリ
- **統一管理**: 複数のGASスクリプトを1つのリポジトリで管理
- **リソース共有**: 共通ドキュメントや設定ファイルを一元管理

## ディレクトリ構成
```
gas/
├── code/
│   └── Code.js              # 開発中のメインファイル（開発完了後は空にする）
├── scripts/                 # 完成したスクリプト（機能別）
│   ├── release_announce/           # リリース通知機能
│   ├── product_project_task-notifier/  # タスク通知ボット
│   ├── private_task_notifier/      # プライベートタスク通知
│   └── release_calendar_invite/    # カレンダー招待機能
├── docs/                    # 共通ドキュメント
│   ├── notion/              # Notion関連ドキュメント
│   ├── slack/               # Slack関連ドキュメント
│   └── rules/               # 運用ルール
├── .gitignore              # Git除外設定
├── MIGRATION_GUIDE.md      # 統一リポジトリ移行ガイド
└── README.md               # このファイル
```

## 開発フロー

### 1. 開発フェーズ
- `code/Code.js` で開発・テスト
- clasp push でGAS環境にデプロイ
- 動作確認

### 2. 完成フェーズ
- 開発完了後、`code/Code.js` の内容を `scripts/機能名/` に移動
- ファイル名は機能を表す名前に変更（例：`task_notifier.js`）
- 機能別READMEファイルを作成
- `code/Code.js` を空の状態に戻す
- archivesルールに従って変更日時を記載

### 3. GitHub管理（統一リポジトリ）
- 全てのスクリプトを1つのリポジトリで統一管理
- タグ付けで機能別リリース管理（例: `v1.0.0-release_announce`）
- 変更履歴をコミットメッセージで追跡
- 共通ドキュメントの一元管理

## セキュリティ

### 機密情報の管理
- API トークンやDB IDはScript Propertiesで管理
- `.gitignore` で機密情報を除外
- 環境変数はGAS環境でのみ設定

### 除外されるファイル
- `.clasp.json` (clasp設定)
- Script Propertiesの値
- ログファイル
- 一時ファイル

## 使用方法

### 初回セットアップ
1. このリポジトリをクローン
2. GAS環境でScript Propertiesを設定
3. clasp login でGAS環境に接続

### 開発時
1. `code/Code.js` で開発
2. clasp push でデプロイ
3. 動作確認

### 完成時
1. `code/Code.js` を `scripts/機能名/` に移動
2. ファイル名を適切に変更
3. 機能別READMEファイルを作成
4. archivesルールに従って変更日時記載
5. Git でコミット・プッシュ

## アーカイブルール
- scriptsフォルダ内のファイル変更時は必ず変更日時を記載
- フォーマット: `// Last Modified: YYYY-MM-DD HH:MM:SS`
- 変更理由も併記: `// Change: 変更内容の簡潔な説明`

## ライセンス
内部使用のみ
