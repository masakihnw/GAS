# 統一リポジトリ移行ガイド

## 移行の目的
scripts配下の各機能を個別リポジトリで管理していた構成から、上位GASフォルダ全体を一元管理する統一リポジトリ構成に移行します。

## 移行手順

### 1. GitHub上で統一リポジトリを作成
推奨リポジトリ名: `gas` または `gas-development`

### 2. リモート設定を変更

```bash
# 現在のリモートを確認
git remote -v

# 新しい統一リポジトリをリモートに設定
git remote set-url origin https://github.com/masakihnw/gas.git
# または
git remote set-url origin https://github.com/masakihnw/gas-development.git

# 変更を確認
git remote -v
```

### 3. 統一リポジトリへプッシュ

```bash
# 初回プッシュ（新規リポジトリの場合）
git push -u origin main

# 以降の通常プッシュ
git push
```

## 移行後の構成

```
gas/                          ← 統一リポジトリ
├── scripts/                  ← 全ての機能スクリプト
│   ├── release_announce/
│   ├── product_project_task-notifier/
│   ├── private_task_notifier/
│   └── release_calendar_invite/
├── docs/                     ← 共通ドキュメント
│   ├── notion/
│   ├── slack/
│   └── rules/
├── "../code/Code.js"
└── README.md
```

## メリット

1. **共通リソースの一元管理**: `docs/`配下のドキュメントが全機能で共有
2. **変更履歴の追跡**: プロジェクト全体の履歴を一括確認可能
3. **開発フローとの整合**: `code/Code.js` から `scripts/` への移動が1リポジトリで完結
4. **設定ファイルの統一管理**: `.gitignore`, `.claspignore` など

## 既存の個別リポジトリについて

移行完了後、以下の対応を検討してください：

- **アーカイブ**: 個別リポジトリをアーカイブ状態にする
- **README更新**: 統一リポジトリへのリンクを追加
- **通知**: チームメンバーに統一リポジトリの存在を周知

## 注意事項

- 統一リポジトリは `release_announce` リポジトリとは別の新しいリポジトリとして作成してください
- 既存の `release_announce` リポジトリの履歴は保持されますが、今後は統一リポジトリにプッシュします

