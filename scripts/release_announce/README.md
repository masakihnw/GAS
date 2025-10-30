# Slackリリース通知のNotion朝会議事録への自動投稿

## 概要

Slackチャンネルで行われているリリース通知を、毎日の朝会で共有しているNotionの議事録ページに自動で追加するGoogle Apps Script (GAS) スクリプトです。

## 機能

- **Slack投稿取得**: 指定されたチャンネルのリリース通知を期間内で取得
- **Notionページ検索**: 当日の朝会議事録ページ（「@日付 チーム活動予定」）を検索
- **Notionページ更新**: 取得したリリース通知を議事録ページに追加
- **テンプレート処理**: 通知がない場合はテンプレートを削除して「なし」を記載

## 実行タイミング

- **実行日**: 平日のみ（月曜日～金曜日）
- **実行時間帯**: 9:00-10:00の間（GASトリガーで制御）
- **実行頻度**: 1日1回

## 設定

### Script Properties

以下の設定をScript Propertiesに登録してください：

| Key | 説明 |
|---|---|
| `SLACK_BOT_TOKEN` | Slack Bot トークン（xoxb-で始まる） |
| `SLACK_CHANNEL_ID` | リリース通知チャンネルID（デフォルト: C6A3U5WTC） |
| `NOTION_API_TOKEN` | Notion API トークン |
| `NOTION_DB_ID` | 朝会議事録データベースID |

### 必要な権限

#### Slack API
- `channels:history` - チャンネルのメッセージ履歴を取得
- `channels:read` - チャンネル情報を読み取り

#### Notion API
- 対象データベースの読み書き権限

## ディレクトリ構成

```
scripts/release_announce/
├── README.md                           # このファイル
├── release_announce.js                 # メインスクリプト
├── test.js                             # テストスイート
└── docs/
    ├── requirements.md                 # 要件定義書
    └── ErrorLogs.md                    # エラーログ記録
```

## テスト

### テストファイルの追加

1. GASエディタで `test.js` ファイルを追加
2. `release_announce.js` の関数を利用できる状態にする（同じプロジェクト内に配置）

### テスト実行方法

#### 全テスト実行
```javascript
runAllTests()
```

#### クイックテスト（主要機能のみ）
```javascript
runQuickTest()
```

#### 個別テスト実行
以下の関数を個別に実行できます：
- `testExtractProductName()` - プロダクト名抽出のテスト
- `testFormatDateToNotionFormat()` - 日付フォーマット変換のテスト
- `testGetDayOfWeekName()` - 曜日名取得のテスト
- `testIsBusinessDay()` - 営業日判定のテスト
- `testGetPreviousBusinessDayEnd()` - 前営業日計算のテスト
- `testGetJSTDate()` - JST日付取得のテスト
- `testReleaseNotificationStructure()` - リリース通知データ構造のテスト
- `testValidateConfig()` - 設定値検証のテスト
- `testIntegrationProductNameExtraction()` - 統合テスト（プロダクト名抽出）

### テスト内容

1. **プロダクト名抽出テスト**: 様々なリリース通知フォーマットからプロダクト名を正しく抽出できるかテスト
2. **日付処理テスト**: 日付フォーマット変換、曜日名取得、営業日判定などの日付処理をテスト
3. **データ構造テスト**: リリース通知データ構造が正しいかをテスト
4. **設定値テスト**: Script Propertiesの設定が正しいかを確認

## 使用方法

### 初回セットアップ

1. Script Propertiesに必要な設定を登録
2. GASトリガーを設定（平日の9:00-10:00の間）
3. 動作確認のため手動実行

### 手動実行

```javascript
function manualRun() {
  main();
}
```

## ドキュメント

詳細な仕様は以下のドキュメントを参照してください：

- [要件定義書](./docs/requirements.md)
- [エラーログ記録](./docs/ErrorLogs.md)

## 注意事項

- 土日祝日は実行されません
- 同日に2回以上実行された場合は、2回目以降はスキップされます
- 当日の朝会議事録ページが存在しない場合はエラーとなります

## トラブルシューティング

エラーが発生した場合は、[ErrorLogs.md](./docs/ErrorLogs.md)に記録してください。

---

**作成日**: 2025年1月29日  
**バージョン**: 1.0

