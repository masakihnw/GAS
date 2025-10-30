# イベントIDログ

このフォルダには、カレンダーイベントIDのログファイルの説明を記載します。

## 重要な注意

**GASスクリプトはGoogle Driveのフォルダにログファイルを保存します。**
このローカルフォルダは参考用のドキュメントのみです。

## 設定方法

1. **Google Driveにフォルダを作成**
   - Google Drive上に「release_calendar_invite_logs」などのフォルダを作成
   - フォルダのIDを取得（フォルダを開いたURLから `/folders/` 以降の部分）

2. **Script Propertiesに設定**
   - GASプロジェクトの「プロジェクトの設定」→「スクリプト プロパティ」
   - プロパティ名: `EVENT_LOG_FOLDER_ID`
   - 値: Google DriveフォルダID（例: `1abc123def456...`）

3. **ログファイルの自動作成**
   -GOASスクリプトが初回実行時に、指定フォルダ内に `event_ids.jsonl` を作成します

## ファイル形式

- **ファイル名**: `event_ids.jsonl`
- **保存先**: Google Drive（`EVENT_LOG_FOLDER_ID`で指定したフォルダ）
- **形式**: JSON Lines（1行1JSONレコード）

## レコード形式

```json
{
  "releaseId": "リリースID",
  "executorNotionUserId": "実行者のNotionユーザーID",
  "eventId": "Google Calendar イベントID",
  "timestamp": "2025-01-15T16:37:36+09:00"
}
```

## 使用方法

1. GASスクリプトが自動的にGoogle Driveの指定フォルダ内に`event_ids.jsonl`を作成・更新します
2. 手動で編集する場合は、Google Driveでファイルを開き、JSON Lines形式を維持してください
3. ファイルが大きくなりすぎた場合は、バックアップを取ってから古いレコードを削除できます

## 注意事項

- このファイルはGASスクリプトが自動管理します
- 不要なレコードを削除する場合は、該当するJSONオブジェクトの行を削除してください
- ファイルを完全に削除すると、既存のイベントIDが参照できなくなります
- `EVENT_LOG_FOLDER_ID`が設定されていない場合、スクリプト実行時にエラーになります
