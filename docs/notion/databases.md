# Notion データベースID マスタ情報

このファイルには、GASスクリプトで使用するNotionデータベースのID情報をまとめています。

## 全社共通データベース

### Task DB（タスクDB）
- **用途**: 全社共通のタスク管理
- **DB ID**: `afafabe758044461a3e9e9b4c037e5aa`
- **使用スクリプト**: 
  - `product_project_task-notifier`
  - `private_task_notifier`
  - `release_calendar_invite`（要確認）

### Product DB（プロダクトDB）
- **用途**: プロダクト情報の管理
- **DB ID**: Script Propertiesで管理（`NOTION_PRODUCT_DB_ID`）
- **使用スクリプト**: 
  - `product_project_task-notifier`
  - `release_calendar_invite`（要確認）

### Project DB（プロジェクトDB）
- **用途**: プロジェクト情報の管理
- **DB ID**: Script Propertiesで管理（`NOTION_PROJECT_DB_ID`）
- **使用スクリプト**: 
  - `product_project_task-notifier`

### Issue DB（Issue DB / 全社共通Issue DB）
- **用途**: 全社共通のIssue管理
- **DB ID**: Script Propertiesで管理（`NOTION_ISSUE_DB_ID`）
- **使用スクリプト**: 
  - `release_calendar_invite`（要確認）

### Config DB（設定DB）
- **用途**: 各種設定情報の管理
- **DB ID**: Script Propertiesで管理（`NOTION_CONFIG_DB_ID`）
- **使用スクリプト**: 
  - `product_project_task-notifier`

## 機能別データベース

### Release DB（リリースDB）
- **用途**: リリース情報の管理
- **DB ID**: `0cc4931427714c6bafe5f05bdc66ac22`
- **使用スクリプト**: 
  - `release_calendar_invite`

### 朝会議事録DB
- **用途**: 朝会の議事録管理
- **DB ID**: `cd1b1c95bfc34c7d9ec50405a5023cc9`
- **使用スクリプト**: 
  - `release_announce`

## 使用方法

### Script Propertiesでの設定
多くのDB IDはScript Propertiesで管理されています：

| Script Property Key | 説明 | デフォルト値 |
|---|---|---|
| `NOTION_TASK_DB_ID` | Task DB ID | `afafabe758044461a3e9e9b4c037e5aa` |
| `NOTION_PRODUCT_DB_ID` | Product DB ID | - |
| `NOTION_PROJECT_DB_ID` | Project DB ID | - |
| `NOTION_ISSUE_DB_ID` | Issue DB ID | - |
| `NOTION_CONFIG_DB_ID` | Config DB ID | - |
| `NOTION_RELEASE_DB_ID` | Release DB ID | `0cc4931427714c6bafe5f05bdc66ac22` |
| `NOTION_DB_ID` | 朝会議事録DB ID（release_announce用） | `cd1b1c95bfc34c7d9ec50405a5023cc9` |

### コードでの使用例
```javascript
const CONFIG = {
  NOTION_TASK_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_TASK_DB_ID') || '',
  NOTION_PRODUCT_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_PRODUCT_DB_ID') || '',
  // ...
};
```

## 注意事項

- DB IDは機密情報として管理してください
- Script Propertiesで設定する場合は、各GASプロジェクトで個別に設定が必要です
- DB IDが変更された場合は、このファイルとScript Propertiesの両方を更新してください

## 更新履歴

- 2025-01-XX: 初版作成

