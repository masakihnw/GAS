# Notion ERD 出力ファイル

このディレクトリには、Notionデータベース構造から自動生成されたERDファイルを格納します。

## ファイル説明

- `notion_erd.mmd` - Mermaid ER図形式のファイル
- `notion_schema.dbml` - DBML形式のファイル（dbdiagram.io等で可視化可能）

## 生成方法

詳細は `scripts/notion_erd_exporter/README.md` を参照してください。

### クイックスタート

```bash
# スクリプトディレクトリに移動
cd scripts/notion_erd_exporter

# 環境変数を設定（必要に応じて）
export NOTION_TOKEN="secret_xxx"

# 依存関係をインストール（初回のみ）
pip install -r requirements.txt

# ワークスペース全体をスキャンしてERDを生成（デフォルトの出力先を使用）
python notion_erd_exporter.py --workspace-scan

# または、出力先を明示的に指定する場合
python notion_erd_exporter.py \
  --workspace-scan \
  --out-mermaid ../../docs/notion/erd/notion_erd.mmd \
  --out-dbml ../../docs/notion/erd/notion_schema.dbml
```

## 使用方法

### Mermaid ER図の閲覧

1. **Cursorでの閲覧**:
   - `.mmd` ファイルを開くと、Mermaidプレビューが表示されます
   - Markdownファイルに埋め込むことも可能です

2. **オンラインでの閲覧**:
   - [Mermaid Live Editor](https://mermaid.live/) にファイル内容を貼り付けて可視化

3. **GitHub/GitLabでの閲覧**:
   - Markdownファイル内に ```mermaid コードブロックとして埋め込むと自動レンダリングされます

### DBMLの閲覧

1. **dbdiagram.io**:
   - [dbdiagram.io](https://dbdiagram.io/) にアクセス
   - ファイル内容を貼り付けるか、ファイルをインポートして可視化

## 更新頻度

- データベース構造が変更された際に再生成してください
- 定期的な更新を推奨（例：週次または月次）

## 注意事項

- 生成されたファイルは自動的にGit管理されます
- 機密情報（API Token等）は含まれていませんが、データベース構造は含まれます
- 大規模なワークスペースでは生成に時間がかかることがあります

