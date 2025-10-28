# ドキュメント管理ルール

## 概要
このファイルは、リポジトリ内のドキュメント配置に関するルールを定義します。

## 配置基準

### ルート `docs/` フォルダに配置するドキュメント
以下の条件を満たすドキュメントは、ルートの `docs/` フォルダに配置してください：

#### 条件
- **複数のプロジェクトやコードで参照される可能性がある**
- **共通の仕様、ルール、リファレンス情報**
- **プロジェクト横断的なエラーログ、運用ドキュメント**

#### 該当するドキュメントの例
- 共通の要件定義書
- エラーログ記録フォーマット（ErrorLogs.md）
- Slack投稿例などのリファレンス（SlackPostExample.md）
- 共通のマッピング表（slack&notion_user_room_filtered.md）
- 複数プロジェクトで使用される設定項目の定義

### プロジェクト固有の `docs/` フォルダに配置するドキュメント
以下の条件を満たすドキュメントは、各プロジェクトの `docs/` フォルダに配置してください：

#### 条件
- **特定のプロジェクトやコードのみで参照される**
- **個別の要件定義、設計書、実装仕様**
- **プロジェクト固有の設定やルール**

#### 該当するドキュメントの例
- 特定システムの要件定義書（例：ProductProjectTaskNotification.md）
- 特定機能の要件定義書（例：PostExpiredTasks.md）
- プロジェクト固有のREADME
- プロジェクト固有のアーカイブルール（例：ARCHIVES_RULES.md）
- そのプロジェクトでのみ使用される設定項目の定義

## 判断フローチャート

```
ドキュメントを作成する時、以下を確認：

1. このドキュメントは複数のプロジェクトで参照されるか？
   ├─ YES → ルート docs/ に配置
   └─ NO → 2. に進む

2. このドキュメントは特定のプロジェクトのみで参照されるか？
   ├─ YES → 該当プロジェクトの docs/ フォルダに配置
   └─ NO → 3. に進む

3. どちらでもない場合
   └─ 用途を再検討し、適切な配置先を決定
```

## 現在の配置状況

### ルート `docs/` のドキュメント
- `ErrorLogs.md` - 複数プロジェクト共通のエラーログ記録フォーマット ✅
- `SlackPostExample.md` - Slack投稿例のリファレンス ✅
- `slack&notion_user_room_filtered.md` - 共通のユーザーマッピング表 ✅
- `task_notification_requirements.md` - 一般的なタスク通知ボットの要件定義 ✅
- `ProductProjectTaskNotification.md` - **特定システムの要件定義（移動対象）** ❌
- `PostExpiredTasks.md` - **特定機能の要件定義（移動対象）** ❌

### プロジェクト固有のドキュメント
- `scripts/product_project_task-notifier/README.md` - プロジェクト固有のREADME ✅
- `scripts/product_project_task-notifier/docs/ARCHIVES_RULES.md` - プロジェクト固有のルール ✅

## 作業完了後の状態

### ルート `docs/` に残すドキュメント
- `DOCUMENTATION_MANAGEMENT_RULES.md` - このファイル
- `ErrorLog移到.md` - 共通のエラーログ記録フォーマット
- `SlackPostExample.md` - Slack投稿例のリファレンス
- `slack&notion_user_room_filtered.md` - 共通のユーザーマッピング表
- `task_notification_requirements.md` - 一般的な要件定義

### プロジェクト固有のドキュメント
- `scripts/product_project_task-notifier/docs/ProductProjectTaskNotification.md` - プロジェクト固有の要件定義
- `scripts/product_project_task-notifier/docs/PostExpiredTasks.md` - プロジェクト固有の要件定義
- `scripts/product_project_task-notifier/README.md` - プロジェクト固有のREADME
- `scripts/product_project_task-notifier/docs/ARCHIVES_RULES.md` - プロジェクト固有のルール

## AI支援での実装

AIにドキュメント作成を依頼する際は、このルールに従って配置先を自動判断します：

### 判断プロンプト
「このドキュメントは**複数のプロジェクトやコードで参照**される可能性がありますか？
 それとも**特定のプロジェクトのみ**で参照されますか？」

### 自動判定
- 複数プロジェクトで参照 → ルート `docs/` に配置
- 特定プロジェクトのみで参照 → 該当プロジェクトの `docs/` に配置

## 更新履歴
- 2025-10-27: 初版作成
