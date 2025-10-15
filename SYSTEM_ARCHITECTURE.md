# GAS開発環境 システム構成設計書

## 🎯 設計思想

**「共通認証 + 個人プロジェクト分離」**で開発効率とセキュリティを両立

- **共通要素**: OAuth認証・GCPプロジェクト → 管理コスト削減
- **分離要素**: 個人GASプロジェクト → 開発独立性・権限分離
- **統一要素**: clasp操作・命名規則 → 運用効率化

---

## 🏗️ システム構成図

```
[組織共通GCPプロジェクト]
    ├─ OAuth2.0認証設定
    ├─ client_secret_gas_common.json
    └─ API有効化・課金設定

[個人開発者A]              [個人開発者B]              [個人開発者N]
├─ 個人GASプロジェクト      ├─ 個人GASプロジェクト      ├─ 個人GASプロジェクト
├─ .clasp.json            ├─ .clasp.json            ├─ .clasp.json
├─ .clasprc.json          ├─ .clasprc.json          ├─ .clasprc.json
└─ workspaces/            └─ workspaces/            └─ workspaces/
   ├─ 20250129-task1      ├─ 20250129-taskA         ├─ 20250129-project1
   ├─ 20250130-task2      ├─ 20250130-taskB         ├─ 20250130-project2
   └─ 20250131-task3      └─ 20250131-taskC         └─ 20250131-project3
```

---

## 📋 構成要素詳細

### 1. 共通GCPプロジェクト

**役割**: OAuth認証・API管理の中央集権化

| 要素 | 内容 | 管理者 |
|------|------|---------|
| **プロジェクト** | 組織全体で1つのGCPプロジェクト | システム管理者 |
| **OAuth設定** | `client_secret_gas_common.json` | システム管理者 |
| **API有効化** | Apps Script API・Drive API等 | システム管理者 |
| **課金設定** | 使用料金の集約管理 | システム管理者 |

**メリット**:
- ✅ OAuth設定の重複排除
- ✅ API使用量の一元管理
- ✅ セキュリティポリシーの統一

### 2. 共通OAuth Agent

**役割**: 認証情報の標準化・自動配布

| ファイル | 配置場所 | 内容 |
|----------|----------|------|
| `client_secret_gas_common.json` | 各開発者ローカル | GCP OAuth設定 |
| `.clasprc.json` | `~/.clasprc.json` | 認証トークン |

**認証フロー**:
```bash
# 初回のみ（開発者ごと）
clasp login --creds ./client_secret_gas_common.json --use-project-scopes

# 結果: ~/.clasprc.json に認証情報保存
# 以降: 全てのclasp操作で自動使用
```

**セキュリティ境界**:
- 🔒 **共通**: OAuth Client（認証方法）
- 🔓 **分離**: Access Token（個人権限）

### 3. 個人GASプロジェクト

**役割**: 開発環境の独立性確保

| レベル | 分離単位 | 管理者 |
|--------|----------|---------|
| **GASプロジェクト** | 開発者単位 | 個人開発者 |
| **workspaces** | タスク単位 | 個人開発者 |
| **関数・変数** | 名前空間 | 個人開発者 |

**権限モデル**:
```
開発者A のGASプロジェクト:
├─ 開発者A: 所有者権限（全操作可能）
├─ 開発者B: アクセス不可
└─ システム管理者: 閲覧権限（監査用）
```

**名前空間ルール**:
```javascript
// 関数命名: ws_{フォルダ名}_{処理名}
function ws_20250129_data_analysis_processCSV() { }

// 変数命名: WS_{YYYYMMDD}_{PROJECT}_{VARIABLE_NAME}
const WS_20250129_DATA_ANALYSIS_CONFIG = { };
```

### 4. clasp 統合システム

**役割**: 開発運用の標準化

| 操作 | コマンド | 実行場所 |
|------|----------|----------|
| **認証** | `clasp login --creds ./client_secret_gas_common.json --use-project-scopes` | ルートディレクトリ |
| **コード更新** | `clasp push` | workspaces/YYYYMMDD-{task}/ |
| **関数実行** | `clasp run ws_フォルダ名_処理名` | workspaces/YYYYMMDD-{task}/ |
| **デプロイ** | `clasp deploy` | workspaces/YYYYMMDD-{task}/ |

**ディレクトリ構成**:
```
gas_test6/                          ← プロジェクトルート
├─ .clasp.json                      ← GASプロジェクト設定（個人固有）
├─ .clasprc.json                    ← 認証情報（個人固有）
├─ client_secret_gas_common.json    ← OAuth設定（共通配布）
├─ appsscript.json                  ← スコープ設定
└─ workspaces/                      ← 作業領域
   ├─ appsscript.json               ← プロジェクト設定
   ├─ Code.js                       ← メインコード
   ├─ 20250129-task1/              ← 個別タスク
   ├─ 20250130-task2/              ← 個別タスク
   └─ 20250131-task3/              ← 個別タスク
```

---

## 🔄 運用フロー

### 新規開発者の参加

1. **システム管理者**:
   - `client_secret_gas_common.json` を配布
   - 個人GASプロジェクト作成権限付与

2. **個人開発者**:
   ```bash
   # 1. 認証設定
   clasp login --creds ./client_secret_gas_common.json --use-project-scopes
   
   # 2. 個人GASプロジェクト作成
   clasp create --type standalone --title "個人開発プロジェクト"
   
   # 3. 初期設定
   clasp push
   ```

### 日常的な開発フロー

```bash
# 1. 新しいタスク開始
mkdir workspaces/20250129-new-task
cd workspaces/20250129-new-task

# 2. コード作成・編集
# （関数名: ws_20250129_new_task_関数名）

# 3. アップロード・テスト
clasp push
clasp run ws_20250129_new_task_関数名

# 4. 本番デプロイ
clasp deploy
```

---

## 🎛️ 権限・セキュリティモデル

### 階層別権限

| レベル | 管理対象 | 権限範囲 |
|--------|----------|----------|
| **組織** | GCPプロジェクト・OAuth | システム管理者 |
| **プロジェクト** | 個人GASプロジェクト | 個人開発者 |
| **タスク** | workspaces内コード | 個人開発者 |

### セキュリティ境界

```
[組織レベル] 
└─ 共通OAuth → 認証方法は統一、アクセス権限は個人別

[個人レベル]
└─ GASプロジェクト → 完全分離、相互アクセス不可

[タスクレベル]
└─ 名前空間 → 同一プロジェクト内でも関数・変数の衝突防止
```

---

## 🚀 メリット・デメリット

### ✅ メリット

| 観点 | 効果 |
|------|------|
| **運用効率** | OAuth設定の重複排除、clasp操作の標準化 |
| **開発独立性** | 個人プロジェクト分離により他者への影響なし |
| **セキュリティ** | 権限の最小化、アクセス制御の明確化 |
| **保守性** | 名前空間による競合防止、構成の可視化 |

### ⚠️ 注意点・制約

| 観点 | 課題 | 対策 |
|------|------|------|
| **初期設定** | 開発者ごとの認証・プロジェクト作成が必要 | 標準化された手順書 |
| **命名規則** | 関数・変数名が長くなる | IDE補完・テンプレート活用 |
| **プロジェクト管理** | 個人プロジェクトの乱立リスク | 定期的な棚卸し・アーカイブ |

---

## 📝 保守・運用指針

### 定期的な見直し項目

- [ ] **月次**: 未使用個人プロジェクトの確認
- [ ] **四半期**: OAuth設定・API使用量の確認
- [ ] **年次**: 全体アーキテクチャの見直し

### トラブルシューティング指針

| 問題 | 原因 | 解決方法 |
|------|------|----------|
| 認証エラー | `.clasprc.json`破損 | `clasp login`再実行 |
| 関数未発見 | プッシュ忘れ | `clasp push`実行 |
| 権限エラー | スコープ不足 | `appsscript.json`更新 |
| 名前衝突 | 命名規則違反 | 名前空間付きに修正 |

---

**設計者**: システム管理者  
**文書作成日**: 2025年1月29日  
**最終更新**: 2025年1月29日  
**バージョン**: 1.0.0 