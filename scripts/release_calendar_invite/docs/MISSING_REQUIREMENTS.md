# 要件定義書の考慮漏れ・追加確認事項

## ⚠️ 重要な要件変更（決定済み）

### 実行方式の変更
**決定事項**: 各スクラムマスターが個別にGASを実行し、自分が担当しているプロダクトのリリースのみを処理する

**変更内容**:
- **従来**: 1つのGASで全リリースを処理し、全スクラムマスターを招待
- **新方式**: 各スクラムマスターが個別にGASを実行し、自分の担当プロダクトのリリースのみ処理
- **メリット**: 
  - 各スクラムマスターが自分のカレンダーに直接イベントを作成できる
  - イベントの主催者が実行者自身になるため、削除権限も自分が持つ
  - 他のスクラムマスターに不要な通知を送らない

**実装上の注意**:
- GAS実行者のメールアドレスからNotionユーザーIDを逆引きする処理が必要
- プロダクトDBから、実行者のNotionユーザーIDが「スクラムマスター」プロパティに設定されているプロダクトを特定
- 対象プロダクトに紐づくリリースのみをフィルタリングして処理

## 🔴 重要な考慮漏れ

### 1. ユーザーマッピングファイルの読み込み方法
**問題**: 
- 要件では`docs/slack&notion_user_room_filtered.md`を参照と記載されているが、実際のファイルは`docs/slack/user_room_mapping.md`
- GAS環境でMarkdownファイルを直接読み込む方法が不明確

**確認事項**:
- [ ] マッピングデータをコード内にハードコードするか、外部ファイルとして読み込むか
- [ ] 既存スクリプト（`product_project_task-notifier`）ではコード内に直接マッピングを定義している
- [ ] メールアドレスの取得方法を明確化（Notion APIから直接取得可能か）

**決定事項（✅ 決定済み）**:
- **Google Drive内にユーザーマッピングファイルを配置し、毎回参照する方式を採用**
- GASのDriveAppサービスを使用してGoogle Driveからファイルを読み込む
- ファイルIDはScript Propertiesで管理（`USER_MAPPING_FILE_ID`）

**ファイル情報**:
- Google Drive URL: https://drive.google.com/file/d/1HjSu0MogpG38GqlHwxLOmNCJrAiRC_iG/view?usp=drive_link
- ファイルID: `1HjSu0MogpG38GqlHwxLOmNCJrAiRC_iG`
- ファイル名: `user_room_mapping.md`

**実装方法**:
```javascript
/**
 * Google Driveからユーザーマッピングファイルを読み込み
 * @param {string} fileId - Google DriveファイルID
 * @returns {Object} NotionユーザーID → メールアドレスのマッピングオブジェクト
 */
function loadUserMappingFromDrive(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const content = file.getBlob().getDataAsString();
    
    // マークダウンテーブルをパース
    const lines = content.split('\n');
    const mapping = {};
    
    // ヘッダー行をスキップしてデータ行を処理
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('|--')) continue;
      
      const columns = line.split('|').map(col => col.trim()).filter(col => col);
      if (columns.length >= 6) {
        const notionUserId = columns[5]; // NotionユーザーID列
        const email = columns[3]; // メールアドレス列
        
        if (notionUserId && email) {
          mapping[notionUserId] = email;
        }
      }
    }
    
    console.log(`ユーザーマッピング読み込み完了: ${Object.keys(mapping).length}件`);
    return mapping;
  } catch (error) {
    console.error('ユーザーマッピングファイル読み込みエラー:', error);
    throw new Error(`ユーザーマッピングファイルの読み込みに失敗しました: ${error.message}`);
  }
}
```

**メリット**:
- マッピングデータの更新が容易（Google Drive上のファイルを編集するだけ）
- コードの再デプロイが不要
- 複数のスクリプトで同じマッピングファイルを共有可能

**デメリット**:
- 毎回ファイル読み込みのオーバーヘッド（キャッシュ機能の実装を検討）
- エラーハンドリングが必要（ファイルが見つからない場合等）

**推奨改善**:
- キャッシュ機能を実装（Script Propertiesにキャッシュを保存し、一定時間内は再利用）
- ファイルが読み込めない場合のフォールバック（コード内のデフォルトマッピング）を用意

---

### 2. Notion APIのページネーション処理
**問題**: 
- リリースDB、Issue DB、Task DBのクエリでページネーション処理が必要
- 要件にページネーション処理の記載がない

**確認事項**:
- [ ] `notionQueryAll()`関数の実装が必要（既存スクリプトを参考）
- [ ] ページサイズの設定（通常100件）
- [ ] レート制限対策（各ページ取得後の待機時間）

**推奨対応**:
- 既存の`product_project_task-notifier.js`の`notionQueryAll()`関数を参考に実装
- `PAGE_SIZE: 100`、ページ間で`Utilities.sleep(100)`を追加

---

### 3. 日付比較の実装詳細
**問題**: 
- 日付のみの比較方法が不明確
- JST変換の実装方法が不明確

**確認事項**:
- [ ] 日付のみの比較（時間部分を無視）の実装方法
- [ ] JST時間への変換方法（`Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd')`等）
- [ ] NotionのDate型から日付文字列への変換方法

**推奨対応**:
```javascript
// 日付のみ比較する関数
function compareDateOnly(date1, date2) {
  const d1 = Utilities.formatDate(new Date(date1), 'Asia/Tokyo', 'yyyy-MM-dd');
  const d2 = Utilities.formatDate(new Date(date2), 'Asia/Tokyo', 'yyyy-MM-dd');
  return d1 === d2;
}
```

---

### 4. イベント説明文の生成方法
**問題**: 
- NotionリンクのURLフォーマットが不明確
- 説明文の具体的なフォーマットが不明確

**決定事項（✅ 決定済み）**:
- **該当リリースのURLを記載する**
- リリース情報へのNotionリンクを必須として含める
- 関連Issueへのリンクも含める（オプション）

**説明文のフォーマット**:
```
リリース情報: {リリースのNotion URL}

関連Issue:
- {Issue 1のNotion URL}
- {Issue 2のNotion URL}
```

**実装例**:
```javascript
/**
 * イベント説明文を生成
 * @param {string} releasePageId - リリースページID
 * @param {Array<string>} issuePageIds - IssueページIDの配列（オプション）
 * @returns {string} イベント説明文
 */
function generateEventDescription(releasePageId, issuePageIds = []) {
  // NotionページURL生成（ハイフンを削除）
  const releaseUrl = `https://www.notion.so/${releasePageId.replace(/-/g, '')}`;
  
  let description = `リリース情報: ${releaseUrl}\n\n`;
  
  if (issuePageIds && issuePageIds.length > 0) {
    description += '関連Issue:\n';
    issuePageIds.forEach(issueId => {
      const issueUrl = `https://www.notion.so/${issueId.replace(/-/g, '')}`;
      description += `- ${issueUrl}\n`;
    });
  }
  
  return description;
}
```

**NotionページURL形式**:
- 形式: `https://www.notion.so/{page_id}`（ハイフンなし）
- 例: ページIDが`0cc49314-2771-4c6b-afe5-f05bdc66ac22`の場合
- URL: `https://www.notion.so/0cc4931427714c6bafe5f05bdc66ac22`

---

### 5. リリースタイトルの取得方法
**問題**: 
- リリースDBのタイトルプロパティの正確な名前が不明
- タイトル/formula/title等のプロパティタイプが不明

**確認事項**:
- [ ] リリースDBのタイトルプロパティ名（「名前」「タイトル」等）
- [ ] Title型かFormula型か
- [ ] Title型の場合の取得方法（`properties['名前'].title[0].plain_text`等）

**推奨対応**:
- 実装前に`debugDatabaseProperties()`関数でプロパティ構造を確認

---

### 6. カレンダーイベントIDの管理方法
**問題**: 
- リリースDBに「カレンダーイベントID」プロパティを追加する予定だったが、各スクラムマスターが個別にGASを実行する方針に変更
- 1つのリリースに複数のプロダクトが紐づく場合、各スクラムマスターが個別にイベントを作成するため、1つのプロパティでは管理できない

**決定事項（✅ 決定済み）**:
- **カレンダーイベントIDプロパティは使用しない**
- **各実行者のScript Propertiesに保存**（キー: `EVENT_CACHE_{リリースID}`, 値: イベントID）
- Notion DBのプロパティ追加は不要

**実装方法**:
```javascript
// イベントIDを保存
const eventCacheKey = `EVENT_CACHE_${releaseId}`;
PropertiesService.getScriptProperties().setProperty(eventCacheKey, eventId);

// イベントIDを取得
const cachedEventId = PropertiesService.getScriptProperties().getProperty(eventCacheKey);

// イベントIDを削除
PropertiesService.getScriptProperties().deleteProperty(eventCacheKey);
```

**メリット**:
- 各実行者が個別にイベントIDを管理できる
- 複数のスクラムマスターが同じリリースに対して個別にイベントを作成しても問題ない
- Notion DBの変更が不要

**デメリット**:
- GASスクリプトを削除・再作成すると、イベントIDの情報が失われる
- 他の実行者のイベントIDは参照できない（ただし、各実行者が自分で管理するので問題なし）

---

### 7. エラーハンドリングとログ出力の詳細
**問題**: 
- ログ出力の詳細レベルが不明確
- エラー通知の方法が不明確（Slack通知等）

**確認事項**:
- [ ] ログ出力のレベル（INFO/WARN/ERROR）
- [ ] エラー発生時の通知方法（Slack通知等）
- [ ] ログの保存場所（GAS実行ログのみか、外部ログファイルか）

**推奨対応**:
- 重要なエラーは既存スクリプトと同様にSlackに通知する機能を検討
- ログフォーマットを統一（`[INFO/WARN/ERROR] [時刻] メッセージ`）

---

### 8. APIレート制限への対応
**問題**: 
- Notion APIとGoogle Calendar APIのレート制限への対応が不明確
- 複数リリース処理時のAPI呼び出し回数の最適化が不明

**確認事項**:
- [ ] Notion APIのレート制限（3リクエスト/秒）
- [ ] Google Calendar APIのレート制限
- [ ] 処理間の待機時間設定

**推奨対応**:
- API呼び出し間で適切な待機時間を設定（`Utilities.sleep(500)`等）
- バッチ処理時のレート制限対策を実装

---

### 9. GAS実行時間制限への対応
**問題**: 
- GASの実行時間制限（6分）を超える可能性
- 大量のリリース処理時の対応方法が不明

**確認事項**:
- [ ] 1回の実行で処理するリリース数の上限
- [ ] 処理時間の見積もり
- [ ] タイムアウト時の処理方法

**推奨対応**:
- 処理開始時に開始時刻を記録し、残り時間を監視
- 時間が不足する場合は次回実行に委譲するロジックを追加

---

### 10. Notion APIエラーの詳細な分類
**問題**: 
- エラーの種類による処理分岐が不明確（400, 401, 403, 404, 429, 500, 502等）

**確認事項**:
- [ ] 401エラー（認証エラー）の処理
- [ ] 403エラー（権限エラー）の処理
- [ ] 429エラー（レート制限）の処理
- [ ] 500/502エラー（サーバーエラー）のリトライ戦略

**推奨対応**:
- エラーコード別の処理を実装
- 429エラーの場合はExponential Backoffでリトライ

---

## 🟡 追加検討事項

### 11. イベント説明文へのタスクリスト
**問題**: 
- 要件では「関連する全社共通Taskへのリンク（オプション）」と記載
- 実際に含めるかどうかの判断基準が不明

**確認事項**:
- [ ] タスクリンクを含めるか
- [ ] 含める場合、全てのタスクか、特定の条件のタスクのみか

---

### 12. カレンダー選択とイベント主催者
**問題**: 
- デフォルトカレンダーか特定カレンダーかの選択基準が不明
- イベントの主催者と削除権限が不明確

**決定事項（✅ 決定済み）**:
- **イベントの主催者**: GASスクリプトを実行するGoogleアカウントが自動的に主催者となる
- **削除権限**: 主催者のみがイベントを削除可能（ゲストは削除不可）
- **カレンダー**: Script Propertiesの`CALENDAR_ID`で指定（デフォルトカレンダーの場合は空欄）

**確認事項**:
- [x] 主催者はGAS実行アカウントとなる
- [x] 削除権限は主催者のみ
- [x] ゲスト（スクラムマスター等）は編集・削除不可
- [ ] どのカレンダーにイベントを作成するか（デフォルトカレンダー推奨）

**運用上の推奨**:
- GASスクリプトは適切な担当者（管理者等）のGoogleアカウントで実行
- 主催者アカウントのメールアドレスをチーム内で共有し、削除が必要な場合に連絡できるようにする

---

### 13. イベントへの説明文の更新
**問題**: 
- リリース日変更時に説明文も更新するかが不明確

**確認事項**:
- [ ] 説明文も更新するか（IssueやTaskの変更を反映）

---

### 14. 実装前の確認項目の完全性
**問題**: 
- 実装前に実際のDB構造を確認する必要がある

**確認事項**:
- [ ] 実際のプロパティ名を確認する手順の明確化
- [ ] テストデータの準備方法

---

## ✅ 実装チェックリスト

実装前に以下を確認すること：

### Notion DB構造の確認
- [ ] リリースDBのプロパティ構造を`debugDatabaseProperties()`で確認
- [ ] 全社共通Issue DBのプロパティ構造を確認
- [ ] 全社共通Task DBのプロパティ構造を確認
- [ ] プロダクトDBのプロパティ構造を確認

### ユーザーマッピング
- [ ] `docs/slack/user_room_mapping.md`からNotionユーザーID → メールアドレスのマッピングを抽出
- [ ] コード内にマッピングを定義

### 設定値
- [ ] Script Propertiesの設定手順を確認
- [ ] カレンダーIDの設定方法を確認

### テスト準備
- [ ] テスト用のリリースデータを準備
- [ ] テスト用のGoogleカレンダーを準備

---

## 📝 実装時の推奨パターン

既存スクリプト（`product_project_task-notifier.js`、`release_announce.js`）のパターンを参考に実装することを推奨：

1. **定数定義**: API設定、プロパティ名、設定値
2. **設定検証**: `validateConfig()`関数
3. **Notion API呼び出し**: `notionQueryAll()`、`callNotionAPI()`（リトライ機能付き）
4. **エラーハンドリング**: try-catch、ログ出力、エラー通知
5. **日付処理**: JST変換、日付比較ユーティリティ
6. **ユーザーマッピング**: NotionユーザーID → メールアドレスの変換関数

