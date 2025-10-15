# GAS タスク通知ボット - GitHub管理

## 概要
Google Apps Script (GAS) を使用したタスク通知ボットの開発・管理リポジトリ

## ディレクトリ構成
```
gas/
├── code/
│   └── Code.js              # 開発中のメインファイル（開発完了後は空にする）
├── scripts/                 # 完成したスクリプト（機能別）
│   └── task-notifier/      # タスク通知ボット
│       ├── task_notifier.js # メインスクリプト
│       ├── ARCHIVES_RULES.md # アーカイブルール
│       └── README.md       # 機能説明
├── docs/                    # ドキュメント
├── .gitignore              # Git除外設定
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

### 3. GitHub管理
- 完成したスクリプトはGitHubでバージョン管理
- タグ付けでリリース管理
- 変更履歴をコミットメッセージで追跡

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
