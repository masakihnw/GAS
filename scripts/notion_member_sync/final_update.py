#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
NOTION_MEMBERS_FILE = os.path.join(REPO_ROOT, "docs/notion/notion_members.md")
MAPPING_FILE = os.path.join(REPO_ROOT, "docs/slack/user_room_mapping.md")

# notion_members.mdからマッピングを作成
email_to_notion_id = {}
with open(NOTION_MEMBERS_FILE, "r", encoding="utf-8") as f:
    for line in f:
        if "|" in line and "---" not in line and "NotionユーザーID | 氏名 | メールアドレス" not in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 4:
                notion_user_id = parts[1].strip()
                email = parts[3].strip()
                if email and notion_user_id:
                    email_to_notion_id[email.lower()] = notion_user_id

# user_room_mapping.mdを読み込んで更新
with open(MAPPING_FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

updated_count = 0

for i, line in enumerate(lines):
    if "|" not in line or "---" in line:
        continue
    
    # パイプで分割
    parts = [p.strip() for p in line.split("|")]
    # 先頭と末尾のhigh要素を除去
    while parts and parts[0] == "":
        parts.pop(0)
    while parts and parts[-1] == "":
        parts.pop()
    
    if len(parts) >= 9:
        email_col = parts[3].strip().lower() if len(parts) > 3 else ""
        current_notion_id = parts[5].strip() if len(parts) > 5 else ""
        
        if email_col and email_col in email_to_notion_id:
            new_notion_id = email_to_notion_id[email_col]
            # Uで始まる短いID（SlackユーザーID形式）または異なるIDの場合は更新
            if (current_notion_id.startswith("U") and len(current_notion_id) < 16) or (new_notion_id != current_notion_id and len(new_notion_id) == 36):
                parts[5] = new_notion_id
                lines[i] = " | ".join(parts) + "\n"
                updated_count += 1
                name_col = parts[0] if len(parts) > 0 else ""
                print(f"更新: {name_col} ({email_col}) {current_notion_id} -> {new_notion_id}")

# ファイルに書き戻し
with open(MAPPING_FILE, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"\n更新完了: {updated_count}件のNotionユーザーIDを更新しました")

