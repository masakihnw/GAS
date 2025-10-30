# リリース日カレンダー招待自動化ツール 要件定義書

## 1. 概要

### 1.1 目的
NotionのリリースDBでリリース日プロパティに日付が入力されたら、そのリリースに紐づく全社共通Issueと全社共通Taskの担当者を取得し、プロダクトのスクラムマスター、実装タスクの担当者をGoogleカレンダーに招待する。また、リリース日が変更になった場合は、作成したイベントの日付を更新する。

### 1.2 背景
- リリース日が決まった際に、関連する全員にカレンダー招待を送る必要がある
- 手動での招待送信は漏れや時間がかかるため、自動化が必要
- リリース日の変更時にイベント日付も連動して更新したい

### 1.3 対象システム
- **データソース**: NotionリリースDB（ID: `0cc4931427714c6bafe5f05bdc66ac22`）
- **関連DB**: 
  - 全社共通Issue DB
  - 全社共通Task DB
  - プロダクト DB
- **連携先**: Google Calendar API
- **実行環境**: Google Apps Script (GAS)
- **実行方法**: トリガー設定または手動実行

## 2. 機能要件

### 2.1 基本機能

#### 2.1.1 リリース日が入力されたときの処理
1. **リリースDBの監視**: リリース日プロパティに日付が入力されたリリースを検出
2. **関連データ取得**:
   - リリースに紐づく全社共通Issueを取得
   - 全社共通Issueに紐づく全社共通Taskを取得
   - プロダクト情報を取得（スクラムマスター情報を含む）
3. **担当者抽出**:
   - プロダクトのスクラムマスター
   - 全社共通Taskの担当者
4. **Googleカレンダーイベント作成**:
   - リリース日（日中適当な時間、例: 14:00）でイベントを作成
   - 抽出した担当者をゲストとして招待
   - イベントIDをNotionのリリースDBに保存（後で更新するため）

#### 2.1.2 リリース日が変更されたときの処理
1. **変更検出**: リリース日プロパティが変更されたリリースを検出
2. **イベント更新**: 保存されたイベントIDを使用してGoogleカレンダーイベントの日付を更新
3. **時間の維持**: イベント時間は変更せず、日付のみを更新

### 2.2 詳細仕様

#### 2.2.1 リリースDBの構造（想定）
- **リリース日プロパティ**: Date型（日付のみ、時間なし）
- **全社共通Issueプロパティ**: Relation型（全社共通Issue DBへのリレーション）
- **プロダクトプロパティ**: Relation型（プロダクト DBへのリレーション）
- **カレンダーイベントIDプロパティ**: Text型またはTitle型（作成したイベントIDを保存）

#### 2.2.2 全社共通Issue DBの構造（想定）
- **全社共通Taskプロパティ**: Relation型（全社共通Task DBへのリレーション）

#### 2.2.3 全社共通Task DBの構造（想定）
- **担当者プロパティ**: People型（担当者のNotionユーザー情報）
- **タスク名プロパティ**: Title型またはText型

#### 2.2.4 プロダクト DBの構造（想定）
- **スクラムマスタープロパティ**: People型（スクラムマスターのNotionユーザー情報）
- **プロダクト名プロパティ**: Title型またはText型

#### 2.2.5 Notionユーザー情報からメールアドレスへの変換
- NotionユーザーIDは取得できるが、Googleカレンダーに招待するにはメールアドレスが必要
- ユーザー情報マッピングファイル（`docs/slack&notion_user_room_filtered.md`）を参照して、NotionユーザーIDからメールアドレスに変換
- メールアドレスが見つからない場合は、スキップしてログに記録

#### 2.2.6 イベント時間の設定
- リリースDBには時間が入力されないため、**日中適当な時間に設定**（例: 14:00）
- 後でスクラムマスターが手動で適切な時間に変更する想定
- 推奨デフォルト時間: 14:00 JST

#### 2.2.7 イベント内容
- **タイトル**: リリース名または「[プロダクト名] リリース」
- **説明**: 
  - リリース情報へのNotionリンク
  - 関連する全社共通Issueへのリンク
  - 関連する全社共通Taskへのリンク（オプション）
- **場所**: 必要に応じて設定可能（デフォルトは空欄）
- **時間**: リリース日の14:00（JST）
- **ゲスト**: 
  - プロダクトのスクラムマスター
  - 全社共通Taskの担当者（重複排除）

### 2.3 実行タイミング

#### 2.3.1 実行方法
1. **定期実行**: GASトリガーで定期的（例: 1時間ごと、または30分ごと）に実行
2. **手動実行**: 必要に応じて手動で実行
3. **Notion Webhook**: 将来的にNotion Webhookに対応できれば、リアルタイム実行が可能（現時点では定期実行）

#### 2.3.2 実行頻度
- 推奨: 30分〜1時間ごと
- リリース日の入力や変更が即座に反映される必要はないが、遅延は最小限にする

### 2.4 重複処理の防止
- 同一リリースに対して複数回イベントが作成されないようにする
- カレンダーイベントIDプロパティが既に設定されている場合は、新規作成せずに更新のみ実行
- リリース日が未設定の場合は処理をスキップ

### 2.5 エラーハンドリング
- Notion API エラー: エラーログを出力し、処理をスキップ
- Google Calendar API エラー: エラーログを出力し、リトライ（最大3回）
- メールアドレスが見つからない場合: ログに記録し、そのユーザーはスキップして処理続行
- イベントIDが見つからない場合（更新時）: 新規作成にフォールバック

## 3. 技術要件

### 3.1 API仕様

#### 3.1.1 Notion API

##### 3.1.1.1 リリースDBクエリ（リリース日が設定されているリリースを取得）
```javascript
POST https://api.notion.com/v1/databases/{database_id}/query

// リクエストボディ
{
  "filter": {
    "and": [
      {
        "property": "リリース日",
        "date": {
          "is_not_empty": true
        }
      }
    ]
  }
}
```

##### 3.1.1.2 全社共通Issue取得（リリースに紐づくIssue）
```javascript
// リリースの「全社共通Issue」プロパティから取得（リレーション）
// リリースページのプロパティから直接取得
const issueRelation = releasePage.properties['全社共通Issue']?.relation || [];
const issueIds = issueRelation.map(rel => rel.id);

// 各Issueページを取得
for (const issueId of issueIds) {
  const issuePage = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${issueId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${NOTION_API_TOKEN}`,
      'Notion-Version': '2022-06-28'
    }
  });
  const issueData = JSON.parse(issuePage.getContentText());
  // Issueページから全社共通Taskを取得（Issueのプロパティから取得）
}
```

##### 3.1.1.3 全社共通Task取得（全社共通Issueに紐づくTask）
```javascript
POST https://api.notion.com/v1/databases/{全社共通Task_DB_ID}/query

// リクエストボディ
{
  "filter": {
    "property": "全社共通Issue",
    "relation": {
      "contains": "{Issue_ID}"
    }
  }
}
```

##### 3.1.1.4 プロダクト情報取得
```javascript
// リリースの「プロダクト」プロパティから取得（リレーション）
const productRelation = releasePage.properties['プロダクト']?.relation || [];
const productIds = productRelation.map(rel => rel.id);

// 各プロダクトページを取得
for (const productId of productIds) {
  const productPage = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${productId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${NOTION_API_TOKEN}`,
      'Notion-Version': '2022-06-28'
    }
  });
  const productData = JSON.parse(productPage.getContentText());
  
  // スクラムマスターを取得
  const scrumMaster = productData.properties['スクラムマスター']?.people || [];
  // ...
}
```

##### 3.1.1.5 リリースページの更新（イベントIDを保存）
```javascript
PATCH https://api.notion.com/v1/pages/{page_id}

// リクエストボディ
{
  "properties": {
    "カレンダーイベントID": {
      "rich_text": [
        {
          "text": {
            "content": "{event_id}"
          }
        }
      ]
    }
  }
}
```

#### 3.1.2 Google Calendar API

##### 3.1.2.1 イベント作成
```javascript
// GASのCalendarAppサービスを使用
const calendar = CalendarApp.getDefaultCalendar(); // または特定のカレンダーID
const event = calendar.createEvent(
  title,
  startDate,
  endDate,
  {
    description: description,
    guests: emailAddresses.join(','),
    sendInvites: true
  }
);
const eventId = event.getId();
```

##### 3.1.2.2 イベント更新（日付変更）
```javascript
// イベントIDからイベントを取得
const event = calendar.getEventById(eventId);
// 新しい日付で更新
const newStartTime = new Date(newReleaseDate);
newStartTime.setHours(14, 0, 0, 0); // 14:00に設定
const newEndTime = new Date(newStartTime);
newEndTime.setHours(15, 0, 0, 0); // 1時間後（デフォルト）

event.setTime(newStartTime, newEndTime);
```

##### 3.1.2.3 必要な権限
- Google Calendar APIの読み書き権限
- カレンダーイベントの作成・更新権限
- イベントへの招待送信権限

### 3.2 ユーザー情報マッピング

#### 3.2.1 マッピングファイル
- ファイルパス: `docs/slack&notion_user_room_filtered.md`
- 形式: Markdownテーブル
- 含まれる情報:
  - Notionユーザー名
  - NotionユーザーID
  - メールアドレス

#### 3.2.2 マッピング処理
1. NotionユーザーIDを取得
2. マッピングファイルから対応するメールアドレスを検索
3. 見つからない場合は、Notion APIでユーザー情報を取得してメールアドレスを抽出（可能な場合）
4. それでも見つからない場合は、ログに記録してスキップ

### 3.3 設定値（GAS Script Properties）
- `NOTION_API_TOKEN`: Notion APIトークン
- `NOTION_RELEASE_DB_ID`: `0cc4931427714c6bafe5f05bdc66ac22`
- `NOTION_ISSUE_DB_ID`: `61b50f425ae14687b44ba250869f09ae`（全社共通Issue DB）
- `NOTION_TASK_DB_ID`: `afafabe758044461a3e9e9b4c037e5aa`（全社共通Task DB）
- `NOTION_PRODUCT_DB_ID`: `0d0b0f9639454862af2b2c401f229ca6`（プロダクト DB）
- `CALENDAR_ID`: GoogleカレンダーのID（デフォルトカレンダーの場合は空欄でも可）

### 3.4 処理フロー

#### 3.4.1 リリース日が入力されたときのフロー
1. リリースDBからリリース日が設定されているリリースを取得
2. 各リリースについて以下を実行:
   - カレンダーイベントIDプロパティが未設定かチェック
   - 未設定の場合:
     - リリースに紐づく全社共通Issueを取得
     - 各全社共通Issueに紐づく全社共通Taskを取得
     - リリースに紐づくプロダクトを取得
     - スクラムマスターとTask担当者を抽出
     - NotionユーザーIDからメールアドレスに変換
     - Googleカレンダーイベントを作成
     - イベントIDをリリースDBに保存
   - 設定済みの場合:
     - スキップ（既に処理済み）

#### 3.4.2 リリース日が変更されたときのフロー
1. リリースDBからリリース日が設定されているリリースを取得
2. 各リリースについて以下を実行:
   - カレンダーイベントIDプロパティが設定されているかチェック
   - 設定済みの場合:
     - 現在のイベントIDを取得
     - Google Calendarからイベントを取得
     - 現在のイベント日付とDBのリリース日を比較
     - 異なる場合:
       - イベントの日付を新しいリリース日に更新（時間は維持）
       - ログに記録

### 3.5 データ構造

#### 3.5.1 リリースデータ
```javascript
{
  id: "リリースページID",
  title: "リリース名",
  releaseDate: "2025-02-01", // Date型（日付のみ）
  calendarEventId: "event_id@google.com", // Text型（イベントID）
  productIds: ["プロダクトID1", "プロダクトID2"], // Relation型
  issueIds: ["IssueID1", "IssueID2"] // Relation型
}
```

#### 3.5.2 担当者データ
```javascript
{
  notionUserId: "NotionユーザーID",
  notionUserName: "ユーザー名",
  emailAddress: "user@playground.live"
}
```

## 4. 実装計画

### 4.1 実装フェーズ

#### Phase 1: 基礎機能の実装
1. Notion APIからリリース情報取得
2. 関連するIssue・Task取得
3. 担当者抽出（スクラムマスター、Task担当者）
4. ユーザー情報マッピング機能

#### Phase 2: カレンダー連携
1. Googleカレンダーイベント作成機能
2. イベントIDのNotion DB保存
3. 重複作成防止

#### Phase 3: 更新機能
1. リリース日変更の検出
2. イベント日付更新機能

#### Phase 4: エラーハンドリング・テスト
1. エラーハンドリングの強化
2. ログ出力機能
3. テストコード作成

### 4.2 確認事項（実装前に確認が必要）
1. **プロダクト DBのID**: ✅ 確認済み（`0d0b0f9639454862af2b2c401f229ca6`）
2. **Notion DBのプロパティ名**: ⚠️ **自動取得可能**（下記のヘルパー関数を使用）
   - リリースDBの「リリース日」プロパティの正確な名前
   - 「全社共通Issue」プロパティの正確な名前
   - 「プロダクト」プロパティの正確な名前
   - 「カレンダーイベントID」プロパティの正確な名前（新規作成が必要かも）
   - プロダクト DBの「スクラムマスター」プロパティ名
   - 全社共通Task DBの「担当者」プロパティ名
3. **全社共通Issue DBのID**: ✅ 確認済み（`61b50f425ae14687b44ba250869f09ae`）
4. **全社共通Task DBのID**: ✅ 確認済み（`afafabe758044461a3e9e9b4c037e5aa`）
5. **プロダクト DBのID**: ✅ 確認済み（`0d0b0f9639454862af2b2c401f229ca6`）

#### 4.2.1 プロパティ名の自動取得方法

Notion APIの`GET /v1/databases/{database_id}`エンドポイントを使用して、データベースのスキーマ（プロパティ名とタイプ）を自動取得できます。

**実装例**:
```javascript
/**
 * Notionデータベースのスキーマ（プロパティ情報）を取得
 * @param {string} databaseId - データベースID
 * @returns {Object} データベース情報（プロパティを含む）
 */
function getNotionDatabaseSchema(databaseId) {
  try {
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    const statusCode = response.getResponseCode();
    if (!statusCode.toString().startsWith('2')) {
      console.error(`Notion DB取得エラー: ${statusCode} - ${response.getContentText()}`);
      throw new Error(`Notion API エラー: ${statusCode}`);
    }
    
    const data = JSON.parse(response.getContentText());
    return data;
  } catch (error) {
    console.error('Notion DB取得エラー:', error);
    throw error;
  }
}

/**
 * データベースの全プロパティ名とタイプを表示（デバッグ用）
 */
function debugDatabaseProperties(databaseId, dbName) {
  console.log(`=== ${dbName} プロパティ構造確認 ===`);
  
  try {
    const dbSchema = getNotionDatabaseSchema(databaseId);
    console.log(`データベース名: ${dbSchema.title?.[0]?.plain_text || 'N/A'}`);
    console.log('\n--- プロパティ一覧 ---');
    
    Object.keys(dbSchema.properties).forEach(propName => {
      const prop = dbSchema.properties[propName];
      console.log(`プロパティ名: "${propName}"`);
      console.log(`  タイプ: ${prop.type}`);
      
      // タイプ別の詳細情報
      if (prop.type === 'relation') {
        console.log(`  関連DB: ${prop.relation?.database_id || 'N/A'}`);
      } else if (prop.type === 'select') {
        console.log(`  選択肢: ${JSON.stringify(prop.select?.options || [])}`);
      } else if (prop.type === 'people') {
        console.log(`  タイプ: People（担当者など）`);
      }
      console.log('---');
    });
    
    console.log('\n=== プロパティ構造確認完了 ===');
    
  } catch (error) {
    console.error('プロパティ構造確認エラー:', error);
  }
}

// 使用例
// debugDatabaseProperties('0cc4931427714c6bafe5f05bdc66ac22', 'リリースDB');
// debugDatabaseProperties('61b50f425ae14687b44ba250869f09ae', '全社共通Issue DB');
// debugDatabaseProperties('afafabe758044461a3e9e9b4c037e5aa', '全社共通Task DB');
```

この関数を使用することで、実装前に実際のプロパティ名を確認できます。

### 4.3 テスト項目
1. リリース日が入力されたときのイベント作成
2. リリース日が変更されたときのイベント更新
3. 複数のIssue・Taskがある場合の担当者抽出
4. メールアドレスが見つからない場合の処理
5. 重複作成防止の動作
6. エラー発生時の処理

## 5. 注意事項

### 5.1 実行頻度
- 定期的な実行により、リリース日の入力や変更を検出
- 実行頻度はAPIレート制限を考慮して設定（Notion API、Google Calendar API）

### 5.2 ユーザー情報管理
- ユーザー情報マッピングファイルの更新が必要な場合がある
- NotionユーザーIDとメールアドレスの対応が正確でない場合、招待が送信されない可能性がある

### 5.3 イベント時間
- デフォルトで14:00に設定するが、後でスクラムマスターが手動で変更する想定
- 時間の変更は本ツールでは対応しない（日付変更のみ）

### 5.4 権限
- Google Calendar APIの権限設定が必要
- カレンダーイベントの作成・更新権限を確認

---

**作成日**: 2025年1月29日  
**作成者**: AI Assistant  
**バージョン**: 1.0（要件確定前、実装前に確認事項を解決する必要あり）

