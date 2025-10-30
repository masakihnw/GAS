#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
notion_members.mdからuser_room_mapping.mdを更新するスクリプト
メールアドレスをキーにしてNotionユーザーIDを追加・更新
"""

import os

# ファイルパス
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
NOTION_MEMBERS_FILE = os.path.join(REPO_ROOT, "docs/notion/notion_members.md")
MAPPING_FILE = os.path.join(REPO_ROOT, "docs/slack/user_room_mapping.md")

# notion_members.mdからメールアドレスとNotionユーザーIDのマッピングを作成
email_to_notion_id = {}

with open(NOTION_MEMBERS_FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()
    header_found = False
    for line in lines:
        if "NotionユーザーID | 氏名 | メールアドレス" in line:
            header_found = True
            continue
        if header_found and "| ---" in line:
            continue
        if header_found and line.strip() and "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 4:
                notion_user_id = parts[1].strip() if len(parts) > 1 else ""
                email = parts[3].strip() if len(parts) > 3 else ""
                if email and notion_user_id:
                    email_to_notion_id[email.lower()] = notion_user_id

print(f"notion_members.mdから{len(email_to_notion_id)}件のマッピングを読み込みました")

# user_room_mapping.mdを読み込んで更新
with open(MAPPING_FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

updated_count = 0
header_line_idx = None

# ヘッダー行を探す
for i, line in enumerate(lines):
    if "名前 | slack表示名" in line and "NotionユーザーID" in line:
        header_line_idx = i
        break

if header_line_idx is None:
    print("ERROR: ヘッダー行が見つかりません")
    exit(1)

# データ行を更新
for i in range(header_line_idx + 2, len(lines)):
    line = lines[i]
    original_line = line
    line_stripped = line.strip()
    if not line_stripped or line_stripped.startswith("##"):
        continue
    
    # パイプで分割（先頭に|がある場合は除去）
    if line_stripped.startswith("|"):
        parts = [p.strip() for p in line_stripped[1:].split("|")]
    else:
        parts = [p.strip() for p in line_stripped.split("|")]
    # 先頭と末尾の空要素を除去
    if parts and parts[0] == "":
        parts = parts[1:]
    if parts and parts[-1] == "":
        parts = parts[:-1]
    
    if len(parts) < 9:
        continue
    
    # 列の順序: 名前 | slack表示名 | ハンドル | メールアドレス | Notionユーザー名 | NotionユーザーID | SlackユーザーID | roomチャンネル名 | roomチャンネルID
    # インデックス: 0       1           2          3                 4                   5                   6               7                 8
    email_col = parts[3].strip().lower() if len(parts) > 3 else ""
    current_notion_id = parts[5].strip() if len(parts) > 5 else ""
    
    # メールアドレスでマッチング
    if email_col and email_col in email_to_notion_id:
        new_notion_id = email_to_notion_id[email_col]
        # UUID形式でない（SlackユーザーID形式のUから始まる）場合、または異なる場合は更新
        if current_notion_id.startswith("U") or new_notion_id != current_notion_id:
            parts[5] = new_notion_id
            # 元の行が|で始まっていた場合は維持、そうでなければ|なしで出力
            if original_line.strip().startswith("|"):
                lines[i] = "| " + " | ".join(parts) + " |\n"
            else:
                lines[i] = " | ".join(parts) + "\n"
            updated_count += 1
            name_col = parts[0] if len(parts) > 0 else ""
            print(f"更新: {name_col} ({email_col}) {current_notion_id} -> {new_notion_id}")

# ファイルに書き戻し
with open(MAPPING_FILE, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"\n更新完了: {updated_count}件のNotionユーザーIDを更新しました")

