# NotionメンバーDB同期スクリプト

NotionメンバーDBから情報を取得して、`docs/slack/user_room_mapping.md`のNotionユーザーIDを更新するスクリプトです。

## 使い方

### 1. 環境変数の設定

Notion APIトークンを設定します：

```bash
export NOTION_TOKEN="secret_xxx"
```

### 2. 依存パッケージのインストール

```bash
cd scripts/notion_member_sync
pip install -r requirements.txt
```

### 3. スクリプトの実行

```bash
python3 crawl_notion_members.py
```

## 動作概要

1. NotionメンバーDB（ID: `b8552ccda446461da12c46fcd6c0d68b`）から全レコードを取得
2. データベースのプロパティ構造を表示
3. アカウント名とNotionユーザーIDを抽出
4. `user_room_mapping.md`の「名前」列または「Notionユーザー名」列と照合
5. 一致する行の「NotionユーザーID」列を更新

## マッチングロジック

以下の順序でマッチングを試みます：

1. **完全一致**: マッピングファイルの「名前」列とNotionのアカウント名が完全一致
2. **Notionユーザー名で検索**: Notionユーザー名が完全一致
3. **部分一致**: 名前列またはNotionユーザー名の部分一致（大文字小文字無視）

## 注意事項

- Notion APIのレート制限（3リクエスト/秒）を考慮して、リクエスト間に0.3秒の待機時間を設けています
- 既存のNotionユーザーIDがある場合でも更新されます（コメントアウトで変更可能）

## トラブルシューティング

### プロパティ名が見つからない場合

スクリプト実行時に表示される「データベースのプロパティ」を確認し、以下のプロパティ名が実際のDBと一致しているか確認してください：

- アカウント名: `["アカウント名", "Account", "アカウント", "ユーザー名", "名前", "Name"]`
- NotionユーザーID: `["Notionユーザー", "User", "ユーザー", "People"]`
- 表示名: `["名前", "Name", "表示名", "Display Name"]`
- メールアドレス: `["メール", "Email", "メールアドレス"]`

一致しない場合は、`crawl_notion_members.py`の該当部分を修正してください。

