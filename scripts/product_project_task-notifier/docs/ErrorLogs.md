# エラーログ記録

## 概要
タスク通知ボット実行時に発生したエラーとその原因、修正内容を記録します。

---

## ⚠️ 運用ルール（必須遵守）

### エラー発生時の記録義務
**エラーが発生した場合は、必ずこのドキュメントに以下を記録してください：**

1. **エラー概要**
   - 発生時刻
   - 対象プロジェクト/プロダクト
   - エラーコード
   - 影響範囲

2. **エラー詳細**
   - エラーログ（GASログからの抜粋）
   - 関連設定値（チャンネルID、ユーザーID等）

3. **原因分析**
   - エラーの性質（HTTPステータス、レスポンスボディ等）
   - 根本原因
   - 現在のコードの対応状況

4. **影響範囲**
   - どの処理に影響したか
   - 他の処理への影響はあるか

5. **暫定対応**
   - 発生時の暫定対応内容

6. **修正内容**（修正後）
   - 修正方針
   - 実装内容
   - 修正後の動作確認結果

### 記録フォーマット
各エラーは以下のフォーマットで記録してください：
```markdown
## YYYY/MM/DD HH:MM:SS - エラー名

### エラー概要
- **発生時刻**: [時刻]
- **対象**: [プロジェクト/プロダクト名]
- **エラーコード**: [コード]
- **影響範囲**: [影響の説明]

### エラー詳細
...

### 原因分析
...

### 影響範囲
...

### 暫定対応
...

### 修正内容
...
```

### 修正時は必ず更新
- エラーを修正した際は、該当エラーの「修正予定」セクションを「修正内容」に更新
- 「修正履歴」セクションに修正日時を追記
- コード変更と同時にドキュメントも更新すること

---

## 2025/10/27 10:05:59 - Slack通知channel_not_foundエラー

### エラー概要
- **発生時刻**: 2025/10/27 10:05:59（実行時間: 293.358秒）
- **対象プロジェクト**: Mukuge Phase 1 (PjM: 鈴木 遼)
- **エラーコード**: `200 - channel_not_found`
- **影響範囲**: 該当プロジェクトのSlack通知のみ失敗（他のプロジェクトは正常に処理）

### エラー詳細

#### エラーログ
```
2025/10/27 10:07:21	警告	Slack通知送信失敗 (試行1回目): 200 - channel_not_found
2025/10/27 10:07:21	警告	Slack通知送信失敗 (試行2回目): 200 - channel_not_found
2025/10/27 10:07:21	警告	Slack通知送信失敗 (試行3回目): 200 - channel_not_found
2025/10/27 10:07:21	エラー	Slack通知送信が最終的に失敗しました
```

#### プロジェクト設定
```javascript
'Mukuge Phase 1': { 
  channelId: 'C097UBAK886', 
  mentionUserId: 'U9ZFLRRG9', 
  notionId: '23e7d6b7-b8c6-8077-8c70-fdafbdda9aa3' 
}
```

### 原因分析

#### 1. エラーの性質
- **HTTPステータス**: 200（リクエスト自体は成功）
- **レスポンスボディ**: `{ "ok": false, "error": "channel_not_found" }`
- **Slack APIの仕様**: 特定のエラーパターンではHTTP 200を返すが、ボディにエラー情報を含む

#### 2. 根本原因
**チャンネルID `C097UBAK886` が存在しない、または削除されている**

考えられる原因：
1. チャンネルが削除された
2. チャンネルIDの設定ミス（タイポなど）
3. チャンネルがアーカイブされた
4. ワークスペースが変更された際にIDが変わった

#### 3. 現在のコードの対応状況
```javascript:scripts/task-notifier/task_notifier.js
// 1002-1007行目のリトライロジック
if (data.error === 'not_in_channel' && attempt < SLACK_API.RETRY_ATTEMPTS) {
  console.log('チャンネルに参加してからリトライします...');
  joinChannel(channelId);
  Utilities.sleep(SLACK_API.RETRY_DELAY_MS);
  continue;
}
```

**問題点**:
- `not_in_channel` エラーには自動join→リトライする処理がある
- `channel_not_found` エラーには対応していない
- チャンネルが存在しない場合は、3回リトライしても意味がない

### 影響範囲
- ✅ 他のプロジェクト通知: 正常に動作
- ❌ Mukuge Phase 1 の通知: 失敗
- ✅ エラー通知: 管理者（花輪）に正常に送信された
- ✅ 二重送信防止: 他のプロジェクトの通知成功により実行日が記録された

### 暫定対応
エラー通知が管理者に送信され、他のプロジェクトへの影響はなし。プロジェクト単体の通知失敗は確認済み。

### 修正予定
修正内容については別途記載予定。

---

## 解決完了（2025/10/27追記）

### 原因
- **チャンネルID**: `C097UBAK886` は正しい設定
- **URL**: https://playground-live.slack.com/archives/C097UBAK886
- **エラー原因**: プライベートチャンネルのため、Slackボットがアクセス権限を持っていない

### 解決方法
プライベートチャンネル `C097UBAK886` に手動でSlackアプリを追加する必要がある。

**手順**:
1. 該当チャンネルにアクセス
2. チャンネルのインテグレーション設定を開く
3. Slackアプリを追加

### 今後の改善案
- `channel_not_found` エラーに対してより詳細なエラーメッセージを送信
- プライベートチャンネルへの対応を明示的に案内

---

## エラー2: Notion API 502エラー（抽選プロダクト）

- **日時**: 2025/10/27 11:10:26
- **対象プロダクト**: 抽選プロダクト (SM: 花輪 真輝)
- **エラーコード**: `502 - Internal Server Error (500)`
- **影響範囲**: 抽選プロダクトの通知のみ失敗（他のプロダクトは正常に処理）

### エラー詳細

#### エラーログ
```
2025/10/27 11:10:21	デバッグ	Notion DBクエリ完了: 14件取得
2025/10/27 11:10:26	エラー	Notion DBクエリエラー: { [Exception: Request failed for https://api.notion.com returned code 502. Truncated server response: error code: 500 (use muteHttpExceptions option to examine full response)] name: 'Exception' }
2025/10/27 11:10:26	エラー	タスク取得エラー: { [Exception: Request failed for https://api.notion.com returned code 502. Truncated server response: error code: 500 (use muteHttpExceptions option to examine full response)] name: 'Exception' }
2025/10/27 11:10:26	エラー	抽選プロダクト の処理でエラー: ...
```

### 原因分析

#### 1. エラーの性質
- **HTTPステータス**: 502（Bad Gateway）
- **サーバーレスポンス**: Internal Server Error (500)
- **原因側**: Notion APIサーバー側の問題
- **発生タイミング**: 期限切れタスク取得（14件）後の今日期限タスク取得中

#### 2. 根本原因
**Notion APIサーバーの一時的な障害**

- 1回目のクエリ（期限切れタスク）：14件取得成功
- 2回目のクエリ（今日期限タスク）：502エラーで失敗
- 同じプロダクトで1回目は成功、2回目は失敗しているため、サーバー側の一時的な問題

考えられる原因：
1. Notion APIの一時的な障害
2. データベースの負荷によるタイムアウト
3. ネットワーク経路の問題

#### 3. 現在のコードの対応状況
```javascript:scripts/task-notifier/task_notifier.js
// 773-790行目のタスク取得処理
try {
  const overduePages = notionQueryAll(CONFIG.NOTION_TASK_DB_ID, overdueFilter);
  const overdueTasks = overduePages.map(page => parseTask(page)).filter(task => task !== null);
  
  const todayPages = notionQueryAll(CONFIG.NOTION_TASK_DB_ID, todayFilter);
  const todayTasks = todayPages.map(page => parseTask(page)).filter(task => task !== null);
  
  return {
    overdue: overdueTasks,
    today: todayTasks
  };
  
} catch (error) {
  console.error('タスク取得エラー:', error);
  throw error;
}
```

**問題点**:
- エラーが発生すると全体がスキップされる
- 期限切れタスクが取得成功した場合でも、今日期限タスクでエラーがあると両方捨てられる
- リトライ機能がない

### 影響範囲
- ✅ 他のプロダクト通知: 正常に動作
- ❌ 抽選プロダクトの通知: 失敗（期限切れタスク14件と今日期限タスクが通知されなかった）
- ✅ エラー通知: 管理者（花輪）に正常に送信された
- ✅ 他のプロダクト処理: 継続実行された

### 暫定対応
エラー通知が管理者に送信され、他のプロダクトへの影響はなし。問題は一時的なサーバー障害のため、次回実行時に自動的に復旧する可能性が高い。

### 修正予定
1. **部分的な結果の保持**: 1つのクエリが失敗しても、もう片方の結果は保持して通知
2. **リトライロジックの追加**: 502/500エラーに対して自動リトライ
3. **エラー処理の改善**: サーバー側エラーとクライアント側エラーを区別

---

## エラー分類

### Slack関連エラー

#### channel_not_found
- **意味**: 指定されたチャンネルIDが存在しない
- **HTTPステータス**: 200
- **対応**: チャンネルIDの確認・修正が必要

#### not_in_channel
- **意味**: ボットがチャンネルに参加していない
- **HTTPステータス**: 200
- **対応**: 自動joinしてリトライ（実装済み）

---

### Notion API関連エラー

#### 502 Bad Gateway / 500 Internal Server Error
- **意味**: Notion APIサーバー側の一時的な障害
- **HTTPステータス**: 502/500
- **対応**: 一時的な障害の可能性が高い。次回実行時に自動的に復旧する可能性が高い
- **対策**: リトライロジックの追加が推奨

---

## 修正履歴
- 2025/10/27: Notion API 502エラー原因分析完了
- 2025/10/27: channel_not_foundエラー原因分析完了
