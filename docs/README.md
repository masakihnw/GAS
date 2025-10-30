# docs ディレクトリ

このディレクトリには、GASスクリプト開発に必要なマスタ情報やドキュメントを配置しています。

## ディレクトリ構成

```
docs/
├── README.md                       # このファイル
├── notion/                         # Notion関連のマスタ情報
│   ├── databases.md               # NotionデータベースID一覧
│   └── erd/                       # Notionデータベース構造のERD出力
│       ├── README.md              # ERD生成・使用方法
│       ├── notion_erd.mmd         # Mermaid ER図（自動生成）
│       └── notion_schema.dbml     # DBMLスキーマ（自動生成）
├── slack/                        # Slack関連のマスタ情報
│   ├── channels.md               # SlackチャンネルID一覧
│   └── user_room_mapping.md      # Slack/Notionユーザーマッピング表
└── rules/                        # ドキュメント管理ルールなど
    └── DOCUMENTATION_MANAGEMENT_RULES.md  # ドキュメント配置ルール
```

## マスタ情報の使い方

### Notion DB ID
- **ファイル**: `notion/databases.md`
- **内容**: 各スクリプトで使用するNotionデータベースのID一覧
- **更新頻度**: DB追加・変更時

### Notion ERD（データベース構造図）
- **ディレクトリ**: `notion/erd/`
- **ファイル**: 
  - `notion_erd.mmd` - Mermaid ER図形式
  - `notion_schema.dbml` - DBML形式
- **内容**: Notionデータベースの構造（プロパティ定義・Relation/Rollupの結合関係）を可視化
- **生成方法**: `scripts/notion_erd_exporter/` のスクリプトを使用して自動生成
- **更新頻度**: データベース構造変更時、または定期的に再生成
- **参照**: Cursorやその他のエージェントがいつでも `docs/notion/erd/` 配下のファイルを参照可能

### Slack Channel ID
- **ファイル**: `slack/channels.md`
- **内容**: 各スクリプトで使用するSlackチャンネルのID一覧
- **更新頻度**: チャンネル追加・変更時

### ユーザーマッピング
- **ファイル**: `slack/user_room_mapping.md`
- **内容**: SlackユーザーID、NotionユーザーID、メールアドレスの対応表
- **更新頻度**: メンバー追加・変更時

## 各スクリプトでの参照方法

### Script Propertiesからの取得
多くのIDはScript Propertiesで管理されています：

```javascript
const CONFIG = {
  NOTION_TASK_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_TASK_DB_ID') || '',
  SLACK_CHANNEL_ID: PropertiesService.getScriptProperties().getProperty('SLACK_CHANNEL_ID') || '',
  // ...
};
```

### コード内での直接参照
一部のIDはコード内で定数として定義されています。マスタ情報ファイルを参照して最新のIDを使用してください。

## 注意事項

- IDは機密情報として管理してください
- IDが変更された場合は、関連するすべてのファイルとScript Propertiesを更新してください
- マスタ情報を更新した場合は、影響を受けるスクリプトを確認し、必要に応じてコードも更新してください

