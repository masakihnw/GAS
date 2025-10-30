# リリース日カレンダー招待自動化ツール 要件定義書

## 1. 概要

### 1.1 目的
各スクラムマスターがこのGASを実行し、**自分が担当しているプロダクトのリリースのみ**を対象に、リリース日プロパティに日付が入力されたら、そのリリースに紐づく全社共通Issueと全社共通Taskの担当者を取得し、自分（実行者のスクラムマスター）とTask担当者をGoogleカレンダーに招待する。また、リリース日が変更になった場合は、作成したイベントの日付を更新する。

### 1.2 背景
- 各スクラムマスターが自分の担当プロダクトのリリースに関して、カレンダー招待を管理したい
- リリース日が決まった際に、自分と関連するタスク担当者にカレンダー招待を送る必要がある
- 手動での招待送信は漏れや時間がかかるため、自動化が必要
- リリース日の変更時にイベント日付も連動して更新したい
- **各スクラムマスターが個別にGASを実行するため、自分が担当しているプロダクトのリリースのみを処理する**

### 1.3 対象システム
- **データソース**: NotionリリースDB（ID: `0cc4931427714c6bafe5f05bdc66ac22`）
- **関連DB**: 
  - 全社共通Issue DB
  - 全社共通Task DB
  - プロダクト DB
- **連携先**: Google Calendar API
- **実行環境**: Google Apps Script (GAS)
- **実行方法**: **各スクラムマスターが個別にトリガー設定または手動実行**

## 2. 機能要件

### 2.1 基本機能

#### 2.1.1 リリース日が入力されたときの処理
1. **実行者の識別**: 
   - GAS実行者のメールアドレスを取得（`Session.getActiveUser().getEmail()`または`Session.getEffectiveUser().getEmail()`）
   - ユーザーマッピングファイル（Google Drive）を使用して、メールアドレス → NotionユーザーIDを逆引き
2. **対象プロダクトの特定**:
   - NotionプロダクトDBから、実行者のNotionユーザーIDが「スクラムマスター」プロパティに設定されているプロダクトを取得
   - 複数のプロダクトを担当している場合は、すべてのプロダクトを対象とする
3. **対象リリースの抽出**:
   - リリースDBからリリース日が設定されているリリースを取得
   - そのリリースに紐づく「プロダクト」プロパティ（Relation型）を確認
   - **実行者が担当しているプロダクトに紐づくリリースのみを処理対象とする**
4. **関連データ取得**（対象リリースについて）:
   - リリースに紐づく全社共通Issueを取得
   - 全社共通Issueに紐づく全社共通Taskを取得
5. **担当者抽出**:
   - **実行者のスクラムマスター**（GAS実行者本人）: 
     - 実行者のメールアドレスをそのまま使用（追加の変換不要）
   - **全社共通Taskの担当者**:
     - 各Issueに紐づくTaskから「担当者」プロパティ（People型）を取得
     - NotionユーザーIDを抽出
     - ユーザーマッピングファイル（Google Drive）を使用してメールアドレスに変換
     - 重複を排除（実行者と重複している場合は除外）
6. **Googleカレンダーイベント作成**:
   - リリース日の12:00-13:00でイベントを作成
   - **実行者のスクラムマスターとTask担当者のみ**をゲストとして招待（他のスクラムマスターは招待しない）
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
- **カレンダーイベントIDプロパティ**: **使用しない**（各実行者がScript Propertiesで個別管理）

**イベントID管理の方針変更**:
- 従来案: Notion DBのカレンダーイベントIDプロパティに保存
- **新方針**: 各実行者のScript Propertiesに保存（キー: `EVENT_CACHE_{リリースID}`）
- **理由**: 1つのリリースに複数のプロダクトが紐づく場合、各スクラムマスターが個別にイベントを作成するため、1つのプロパティでは管理できない

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
- ユーザー情報マッピングファイル（`docs/slack/user_room_mapping.md`）のデータを参考に、コード内にNotionユーザーID → メールアドレスのマッピングを定義
- 既存スクリプト（`product_project_task-notifier.js`）のパターンに合わせて実装
- メールアドレスが見つからない場合は、スキップしてログに記録

#### 2.2.6 イベント時間の設定
- リリースDBには時間が入力されないため、**一律で12:00-13:00に設定**
- 後でスクラムマスターが手動で適切な時間に変更する想定
- **デフォルト時間: 12:00-13:00 JST**（開始時刻: 12:00、終了時刻: 13:00）

#### 2.2.7 イベント内容
- **タイトル**: 「[リリース]リリース名」（リリースDBのタイトル/名前プロパティを使用）
- **説明**: 
  - **該当リリースのNotion URL**（必須）
  - 関連する全社共通IssueへのNotionリンク（オプション）
  - 関連する全社共通Taskへのリンクは含めない（説明文が長くなりすぎるため）
- **場所**: 必要に応じて設定可能（デフォルトは空欄）
- **時間**: リリース日の12:00-13:00（JST）
- **主催者**: **GASスクリプトを実行するスクラムマスター自身**（イベントの作成者として自動設定）
- **ゲスト**: 
  - **実行者のスクラムマスター自身**（主催者と同一のため、基本的に主催者のみ。ただし、他のカレンダーに招待する場合はゲストとして追加）
  - 全社共通Taskの担当者（重複排除）
  - **注意**: 他のプロダクトのスクラムマスターは招待しない（実行者が担当しているプロダクトのリリースのみ処理するため）

**説明文のフォーマット例**:
```
リリース情報: https://www.notion.so/0cc4931427714c6bafe5f05bdc66ac22

関連Issue:
- https://www.notion.so/61b50f425ae14687b44ba250869f09ae
- https://www.notion.so/xxx
```

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
- Notion API エラー: エラーログを出力し、リトライ（最大3回）後に処理をスキップ
- Google Calendar API エラー: エラーログを出力し、リトライ（最大3回）
- メールアドレスが見つからない場合: ログに記録し、そのユーザーはスキップして処理続行
- イベントIDが見つからない場合（更新時）: 新規作成にフォールバックし、新しいイベントIDを保存
- イベントが手動で削除された場合（更新時）: エラーを検出し、新規作成にフォールバック

#### 2.5.1 リリース日が削除（空/null）になった場合の処理
- カレンダーイベントIDが設定されている場合、対応するイベントを削除
- リリースDBのカレンダーイベントIDプロパティをクリア
- ログに記録

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

##### 3.1.1.4 実行者の識別と対象プロダクト取得
```javascript
// 1. GAS実行者のメールアドレスを取得
const executorEmail = Session.getActiveUser().getEmail(); // または Session.getEffectiveUser().getEmail()

// 2. ユーザーマッピングファイルから、メールアドレス → NotionユーザーIDを逆引き
const userMapping = loadUserMappingFromDrive(USER_MAPPING_FILE_ID);
const executorNotionUserId = getUserNotionIdByEmail(executorEmail, userMapping);

// 3. プロダクトDBから、実行者のNotionユーザーIDが「スクラムマスター」プロパティに設定されているプロダクトを取得
const filter = {
  filter: {
    property: 'スクラムマスター',
    people: {
      contains: executorNotionUserId
    }
  }
};
const products = notionQueryAll(NOTION_PRODUCT_DB_ID, filter);
const targetProductIds = products.map(product => product.id);

// 4. リリースDBから、対象プロダクトに紐づくリリースのみを取得
const releaseFilter = {
  filter: {
    and: [
      {
        property: 'リリース日',
        date: {
          is_not_empty: true
        }
      },
      {
        property: 'プロダクト',
        relation: {
          contains: targetProductIds // 対象プロダクトIDの配列
        }
      }
    ]
  }
};
const targetReleases = notionQueryAll(NOTION_RELEASE_DB_ID, releaseFilter);
```

**処理フロー**:
1. GAS実行者のメールアドレスを取得（`Session.getActiveUser().getEmail()`等）
2. ユーザーマッピングファイルを読み込み、メールアドレス → NotionユーザーIDを逆引き
3. プロダクトDBから、実行者のNotionユーザーIDが「スクラムマスター」プロパティに設定されているプロダクトを取得
4. リリースDBから、対象プロダクトに紐づくリリースのみを抽出
5. 対象リリースのみを処理（他のプロダクトのリリースはスキップ）

##### 3.1.1.5 イベントIDの保存（Script Properties）
**方針変更**: カレンダーイベントIDをNotion DBには保存せず、各実行者のScript Propertiesに保存

```javascript
// イベントIDをScript Propertiesに保存
const eventCacheKey = `EVENT_CACHE_${releaseId}`;
PropertiesService.getScriptProperties().setProperty(eventCacheKey, eventId);

// イベントIDを取得（更新時など）
const cachedEventId = PropertiesService.getScriptProperties().getProperty(eventCacheKey);

// イベントIDを削除（リリース日削除時など）
PropertiesService.getScriptProperties().deleteProperty(eventCacheKey);
```

**保存形式**:
- キー: `EVENT_CACHE_{リリースページID}`
- 値: GoogleカレンダーのイベントID

**メリット**:
- 各実行者が個別にイベントIDを管理できる
- 1つのリリースに複数のプロダクトが紐づく場合でも、各スクラムマスターが個別にイベントIDを保持可能
- Notion DBのプロパティ追加が不要

**デメリット**:
- Script Propertiesはスクリプトごとに独立しているため、他の実行者のイベントIDは参照できない
- GASスクリプトを削除・再作成すると、イベントIDの情報が失われる可能性がある

#### 3.1.2 Google Calendar API

##### 3.1.2.1 イベント作成
```javascript
// GASのCalendarAppサービスを使用
const calendar = CalendarApp.getDefaultCalendar(); // または特定のカレンダーID

// 日付を12:00-13:00に設定
const startDate = new Date(releaseDate);
startDate.setHours(12, 0, 0, 0); // 12:00に設定

const endDate = new Date(releaseDate);
endDate.setHours(13, 0, 0, 0); // 13:00に設定

// タイトルは「[リリース]リリース名」の形式
const title = `[リリース]${releaseTitle}`;

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
try {
  const event = calendar.getEventById(eventId);
  // 新しい日付で更新（時間は12:00-13:00を維持）
  const newStartTime = new Date(newReleaseDate);
  newStartTime.setHours(12, 0, 0, 0); // 12:00に設定（分・秒・ミリ秒も0に）
  
  const newEndTime = new Date(newStartTime);
  newEndTime.setHours(13, 0, 0, 0); // 13:00に設定
  
  event.setTime(newStartTime, newEndTime);
} catch (error) {
  // イベントが見つからない場合（手動削除など）は新規作成にフォールバック
  console.warn(`イベントが見つかりません（ID: ${eventId}）。新規作成します。`);
  // 新規作成処理を実行
}
```

**リリース日変更時の処理フロー**:
1. リリースDBからリリース日が設定されているリリースを取得
2. カレンダーイベントIDプロパティが設定されているか確認
3. 設定されている場合:
   - イベントIDを使用してGoogleカレンダーからイベントを取得
   - イベントが存在するか確認（存在しない場合はエラー）
   - イベントの現在の開始日時を取得
   - Notionのリリース日と比較
   - 日付が異なる場合（時間部分は無視して日付のみ比較）:
     - 新しいリリース日の12:00-13:00にイベントを更新
     - ログに記録
   - 日付が同じ場合は処理をスキップ

##### 3.1.2.3 必要な権限
- Google Calendar APIの読み書き権限
- カレンダーイベントの作成・更新・削除権限
- イベントへの招待送信権限

##### 3.1.2.4 イベントの主催者と権限

**主催者**:
- **イベントの主催者は、GASスクリプトを実行するスクラムマスター自身となります**
- 例: スクラムマスターAが自分の担当プロダクトのリリースについてGASを実行した場合、スクラムマスターAのGoogleアカウントが主催者
- 各スクラムマスターが個別にGASを実行するため、自分が作成したイベントの主催者となる

**主催者の権限**:
- ✅ イベントの編集（タイトル、説明、日時、場所など）
- ✅ イベントの削除
- ✅ 参加者（ゲスト）の追加・削除
- ✅ 参加者への通知送信

**ゲスト（Task担当者）の権限**:
- ✅ イベントへの参加/不参加の回答
- ✅ イベントの閲覧
- ❌ イベントの編集（主催者が編集可能に設定している場合は可能）
- ❌ イベントの削除（主催者のみ）

**注意**: 
- 実行者のスクラムマスター自身は主催者となるため、通常はゲストとしても追加する必要はない
- ただし、他のカレンダーにイベントをコピーしたい場合などは、ゲストとして追加することも可能

**イベント削除時の対応**:
- **削除可能な人**: 主催者（GASスクリプトを実行するスクラムマスター）のみ
- **削除方法**:
  1. 主催者のGoogleカレンダーから直接削除（自分のカレンダー上で削除）
  2. GASスクリプトで削除処理を実行（リリース日が削除された場合など）
- **ゲストが削除したい場合**: 主催者（実行者のスクラムマスター）に連絡して削除を依頼

**主催者を変更したい場合**:
1. 元の主催者（GAS実行アカウント）がGoogleカレンダー上で主催者を変更
2. 新しい主催者が承諾することで主催者権限が移行
3. **注意**: 主催者を変更した場合、GASスクリプトでの自動更新ができなくなる可能性がある

**運用上の注意**:
- 各スクラムマスターが個別にGASを実行するため、自分が担当しているプロダクトのリリースに関するイベントのみが自分のカレンダーに作成される
- 他のスクラムマスターが実行した場合でも、自分の担当プロダクトのリリースに関するイベントは自分のカレンダーには作成されない（実行者自身のカレンダーにのみ作成される）

### 3.2 ユーザー情報マッピング

#### 3.2.1 マッピングファイル
- ファイルパス: `docs/slack/user_room_mapping.md`
- 形式: Markdownテーブル
- 含まれる情報:
  - Notionユーザー名
  - NotionユーザーID
  - メールアドレス

#### 3.2.2 マッピング処理
**実装方法**: 
- **Google Drive内にユーザーマッピングファイル（`user_room_mapping.md`）を配置し、GASのDriveAppサービスを使用して毎回読み込む**
- ファイルID: `1HjSu0MogpG38GqlHwxLOmNCJrAiRC_iG`
- Script Propertiesで`USER_MAPPING_FILE_ID`として管理
- マークダウンテーブルをパースしてNotionユーザーID → メールアドレスのマッピングオブジェクトを生成
- パフォーマンス向上のため、キャッシュ機能を実装（Script Propertiesに保存、一定時間内は再利用）

**処理フロー**:
1. Script PropertiesからマッピングファイルIDを取得（`USER_MAPPING_FILE_ID = 1HjSu0MogpG38GqlHwxLOmNCJrAiRC_iG`）
2. Google Driveからマッピングファイルを読み込み（キャッシュがあればそれを使用）
3. マークダウンテーブルをパースしてマッピングオブジェクトを生成
   - テーブルの列構造: `名前 | slack表示名 | ハンドル | メールアドレス | Notionユーザー名 | NotionユーザーID | ...`
   - NotionユーザーID列（5列目、インデックス5）→ メールアドレス列（3列目、インデックス3）のマッピングを作成
4. NotionユーザーIDを取得（スクラムマスター、Task担当者から）
5. マッピングオブジェクトから対応するメールアドレスを検索
6. 見つからない場合は、ログに記録してスキップ（そのユーザーはカレンダー招待から除外）

**キャッシュ戦略**:
- キャッシュ有効期限: 1時間（3600秒）
- キャッシュキー: `USER_MAPPING_CACHE`
- キャッシュ値: JSON形式のマッピングデータ + タイムスタンプ
- ファイル読み込みエラー時は、フォールバックとしてコード内のデフォルトマッピングを使用（オプション）

### 3.3 設定値（GAS Script Properties）
- `NOTION_API_TOKEN`: Notion APIトークン
- `NOTION_RELEASE_DB_ID`: `0cc4931427714c6bafe5f05bdc66ac22`
- `NOTION_ISSUE_DB_ID`: `61b50f425ae14687b44ba250869f09ae`（全社共通Issue DB）
- `NOTION_TASK_DB_ID`: `afafabe758044461a3e9e9b4c037e5aa`（全社共通Task DB）
- `NOTION_PRODUCT_DB_ID`: `0d0b0f9639454862af2b2c401f229ca6`（プロダクト DB）
- `CALENDAR_ID`: GoogleカレンダーのID（デフォルトカレンダーの場合は空欄でも可）
- `USER_MAPPING_FILE_ID`: Google Drive上のユーザーマッピングファイルID（`docs/slack/user_room_mapping.md`）

### 3.4 処理フロー

#### 3.4.1 リリース日が入力されたときのフロー
1. **実行者の識別**:
   - GAS実行者のメールアドレスを取得
   - ユーザーマッピングファイルから、メールアドレス → NotionユーザーIDを逆引き
2. **対象プロダクトの特定**:
   - プロダクトDBから、実行者のNotionユーザーIDが「スクラムマスター」プロパティに設定されているプロダクトを取得
   - 複数のプロダクトを担当している場合は、すべてのプロダクトIDを収集
3. **対象リリースの抽出**:
   - リリースDBからリリース日が設定されているリリースを取得
   - 各リリースについて、紐づく「プロダクト」プロパティ（Relation型）を確認
   - **実行者が担当しているプロダクトに紐づくリリースのみを処理対象とする**
4. 各対象リリースについて以下を実行:
   - カレンダーイベントIDプロパティが未設定かチェック
   - 未設定の場合:
     - リリースに紐づく全社共通Issueを取得
     - 各全社共通Issueに紐づく全社共通Taskを取得
     - Task担当者を抽出
     - NotionユーザーIDからメールアドレスに変換
     - **実行者のメールアドレスとTask担当者のメールアドレス**をゲストとして設定
     - Googleカレンダーイベントを作成
     - イベントIDをリリースDBに保存
   - 設定済みの場合:
     - スキップ（既に処理済み）

#### 3.4.2 リリース日が変更されたときのフロー
1. **実行者の識別**:
   - GAS実行者のメールアドレスを取得
   - ユーザーマッピングファイルから、メールアドレス → NotionユーザーIDを逆引き
2. **対象プロダクトの特定**:
   - プロダクトDBから、実行者のNotionユーザーIDが「スクラムマスター」プロパティに設定されているプロダクトを取得
3. **対象リリースの抽出**:
   - リリースDBからリリース日が設定されているリリースを取得
   - 各リリースについて、紐づく「プロダクト」プロパティ（Relation型）を確認
   - **実行者が担当しているプロダクトに紐づくリリースのみを処理対象とする**
4. 各対象リリースについて以下を実行:
   - Script PropertiesからイベントIDを取得（キー: `EVENT_CACHE_{リリースID}`）
   - イベントIDが存在する場合:
     - 保存されているイベントIDを使用
     - Google Calendarからイベントを取得（try-catchでエラーハンドリング）
     - イベントが存在する場合:
       - イベントの現在の開始日時から日付部分を取得（時間部分は無視）
       - DBのリリース日から日付部分を取得（Date型の日付のみ部分）
       - 現在のイベント日付とDBのリリース日を比較（日付のみ比較）
       - 異なる場合:
         - イベントの日付を新しいリリース日（12:00-13:00）に更新
         - ログに記録（「リリースID: xxx, 旧日付: yyyy-mm-dd, 新日付: yyyy-mm-dd」）
       - 同じ場合はスキップ
     - イベントが存在しない場合（手動削除など）:
       - 新規作成にフォールバック
       - **新しいイベントIDをScript Propertiesに保存**（キー: `EVENT_CACHE_{リリースID}`）
       - ログに記録

#### 3.4.3 リリース日が削除されたときのフロー
1. **実行者の識別**:
   - GAS実行者のメールアドレスを取得
   - ユーザーマッピングファイルから、メールアドレス → NotionユーザーIDを逆引き
2. **対象プロダクトの特定**:
   - プロダクトDBから、実行者のNotionユーザーIDが「スクラムマスター」プロパティに設定されているプロダクトを取得
3. **対象リリースの抽出**:
   - リリースDBからリリース日が未設定のリリースを取得
   - 各リリースについて、紐づく「プロダクト」プロパティ（Relation型）を確認
   - **実行者が担当しているプロダクトに紐づくリリースのみを処理対象とする**
   - Script PropertiesにイベントIDが保存されているリリースを対象とする
4. 各対象リリースについて以下を実行:
   - Script PropertiesからイベントIDを取得（キー: `EVENT_CACHE_{リリースID}`）
   - Google Calendarからイベントを取得
   - イベントが存在する場合:
     - イベントを削除
     - **Script PropertiesからイベントIDを削除**（キー: `EVENT_CACHE_{リリースID}`）
     - ログに記録
   - イベントが存在しない場合（既に削除済み）:
     - **Script PropertiesからイベントIDを削除**（キー: `EVENT_CACHE_{リリースID}`）
     - ログに記録

#### 3.4.4 複数スクラムマスター対応（同一リリースに複数プロダクトが紐づく場合）
**問題**: 
- 1つのリリースに複数のプロダクトが紐づく場合、各スクラムマスターが個別にGASを実行すると、同じリリースに対して複数のイベントが作成される
- NotionのカレンダーイベントIDプロパティは1つの値しか保存できないため、複数のイベントIDを保存できない

**対応方針**:
- **各スクラムマスターが個別にイベントを作成することを前提とする**
- カレンダーイベントIDプロパティは、**各実行者のスクリプト内部で管理**（Script PropertiesやLocal Storage的な仕組み）
- または、**イベントIDプロパティを使用せず、毎回対象リリースを検索して処理する方式**を採用

**実装方法（推奨）**:
- カレンダーイベントIDをNotion DBに保存しない
- 代わりに、実行者のScript Propertiesに以下の形式で保存:
  - キー: `EVENT_CACHE_{リリースID}`
  - 値: イベントID
- または、リリース日の比較方法を変更:
  - リリースDBのリリース日と、実行者が作成したイベントの日付を比較
  - 実行者が作成したイベントを検索（タイトル「[リリース]リリース名」で検索）

#### 3.4.5 担当者が変更された場合の処理（将来対応）
- 現在の実装では、担当者が変更されてもイベントのゲストを自動更新しない
- ゲストの追加/削除は手動で対応する想定
- 将来的に必要になった場合は、毎回イベントのゲストを再取得して更新する機能を追加

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
7. ページネーション処理の動作確認（大量データの場合）
8. APIレート制限時の動作確認
9. リリース日削除時のイベント削除処理

### 4.4 実装前の確認事項（詳細）
詳細な確認事項については、`docs/MISSING_REQUIREMENTS.md`を参照してください。

## 5. 注意事項

### 5.1 実行頻度
- 定期的な実行により、リリース日の入力や変更を検出
- 実行頻度はAPIレート制限を考慮して設定（Notion API、Google Calendar API）

### 5.2 ユーザー情報管理
- ユーザー情報マッピングファイルの更新が必要な場合がある
- NotionユーザーIDとメールアドレスの対応が正確でない場合、招待が送信されない可能性がある

### 5.3 イベント時間
- デフォルトで12:00-13:00に設定するが、後でスクラムマスターが手動で変更する想定
- 時間の変更は本ツールでは対応しない（日付変更のみ）
- リリース日が変更された場合、時間（12:00-13:00）は維持され、日付のみが更新される

### 5.4 権限

#### 5.4.1 Google Calendar API権限
- Google Calendar APIの権限設定が必要
- カレンダーイベントの作成・更新・削除権限を確認

#### 5.4.2 イベントの主催者と削除権限
- **イベントの主催者**: GASスクリプトを実行するGoogleアカウントが自動的に主催者となる
- **主催者の権限**: イベントの編集、削除、参加者の追加・削除が可能
- **ゲストの権限**: イベントの閲覧と参加/不参加の回答のみ（編集・削除不可）
- **削除権限**: 主催者のみがイベントを削除可能
- **運用上の注意**: GASスクリプトを実行するアカウントは、適切な担当者（管理者等）のアカウントを使用することを推奨

### 5.5 考慮が足りない点への対応

#### 5.5.1 リリース日変更の検出方法
- **問題**: 定期実行で前回の日付との比較が難しい
- **対応**: イベントの現在の日付とNotionのリリース日を比較することで差分を検出
- **実装**: イベントIDから現在のイベント日付を取得し、Notionのリリース日と比較（日付のみ）

#### 5.5.2 イベントの手動削除
- **問題**: ユーザーが手動でイベントを削除した場合、イベントIDだけが残る
- **対応**: `getEventById()`でエラーが発生した場合、新規作成にフォールバック
- **実装**: try-catchでエラーハンドリングし、新規作成処理を実行

#### 5.5.3 リリース日削除時の処理
- **問題**: リリース日が削除（空/null）になった場合の処理が定義されていない
- **対応**: カレンダーイベントを削除し、イベントIDプロパティをクリア
- **実装**: リリース日が未設定かつイベントIDが設定されているリリースを検出し、イベントを削除

#### 5.5.4 担当者変更時の処理
- **問題**: 担当者が変更されてもイベントのゲストが更新されない
- **対応**: 現在は手動対応。将来的に自動更新機能を追加可能
- **実装**: 現時点では未対応（Phase 5として将来実装）

#### 5.5.5 複数プロダクトの処理
- **問題**: 1つのリリースに複数のプロダクトが紐づく場合の処理が不明確
- **対応**: 1つのリリースに対して1つのイベントを作成し、全プロダクトのスクラムマスターをゲストに追加
- **実装**: 重複排除を実施し、全プロダクトのスクラムマスターとTask担当者を1つのイベントに集約

#### 5.5.6 タイムゾーン
- **問題**: タイムゾーンの明示が不足
- **対応**: すべてJST（日本標準時）で統一
- **実装**: GASの実行環境のタイムゾーン設定を確認し、必要に応じて明示的にJSTを指定

#### 5.5.7 重複イベントの検出
- **問題**: 同じリリースに対して複数のイベントが作成される可能性
- **対応**: カレンダーイベントIDプロパティの有無で判定
- **実装**: イベントIDが設定されている場合は新規作成をスキップ（既に実装済み）

---

**作成日**: 2025年1月29日  
**作成者**: AI Assistant  
**バージョン**: 1.0（要件確定前、実装前に確認事項を解決する必要あり）

