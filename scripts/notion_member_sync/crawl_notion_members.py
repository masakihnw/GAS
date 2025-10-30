#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NotionメンバーDBから情報を取得してuser_room_mapping.mdを更新するスクリプト

使い方:
    export NOTION_TOKEN="secret_xxx"
    python crawl_notion_members.py
"""

import os
import sys
import time
import json
import re
import requests
from typing import Dict, List, Optional

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"

# NotionメンバーDBのID
MEMBER_DB_ID = "b8552ccda446461da12c46fcd6c0d68b"

# マッピングファイルのパス（スクリプトからの相対パス）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
MAPPING_FILE = os.path.join(REPO_ROOT, "docs/slack/user_room_mapping.md")

if not os.getenv("NOTION_TOKEN"):
    print("ERROR: NOTION_TOKEN is not set.")
    sys.exit(1)

session = requests.Session()
session.headers.update({
    "Authorization": f"Bearer {os.getenv('NOTION_TOKEN')}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
})


def query_notion_database(database_id: str) -> List[Dict]:
    """Notionデータベースから全レコードを取得（ページネーション対応）"""
    all_results = []
    has_more = True
    start_cursor = None
    
    while has_more:
        payload = {
            "page_size": 100,
        }
        
        if start_cursor:
            payload["start_cursor"] = start_cursor
        
        try:
            resp = session.post(
                f"{NOTION_API_BASE}/databases/{database_id}/query",
                json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            
            all_results.extend(data.get("results", []))
            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")
            
            if has_more:
                time.sleep(0.3)  # レート制限対策
                
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Notion API呼び出しエラー: {e}")
            sys.exit(1)
    
    return all_results


def extract_text_property(prop: Dict, prop_type: str = "title") -> str:
    """Notionプロパティからテキストを抽出"""
    if prop_type == "title":
        title_array = prop.get("title", [])
        return "".join([t.get("plain_text", "") for t in title_array])
    elif prop_type == "rich_text":
        rich_text_array = prop.get("rich_text", [])
        return "".join([t.get("plain_text", "") for t in rich_text_array])
    elif prop_type == "people":
        people_array = prop.get("people", [])
        if people_array:
            # 最初のユーザーのIDを返す
            return people_array[0].get("id", "")
        return ""
    return ""


def get_notion_members() -> Dict[str, Dict]:
    """NotionメンバーDBからメンバー情報を取得
    
    Returns:
        アカウント名をキーとした辞書 {account_name: {user_id, name, email, ...}}
    """
    print(f"NotionメンバーDBから情報を取得中... (DB ID: {MEMBER_DB_ID})")
    
    # まずデータベースのスキーマを取得してプロパティ名を確認
    try:
        resp = session.get(f"{NOTION_API_BASE}/databases/{MEMBER_DB_ID}")
        resp.raise_for_status()
        db_schema = resp.json()
        properties = db_schema.get("properties", {})
        
        print("データベースのプロパティ:")
        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get("type", "unknown")
            print(f"  - {prop_name}: {prop_type}")
        
    except requests.exceptions.RequestException as e:
        print(f"ERROR: データベーススキーマ取得エラー: {e}")
        sys.exit(1)
    
    # データベースから全レコードを取得
    pages = query_notion_database(MEMBER_DB_ID)
    print(f"取得したレコード数: {len(pages)}")
    
    members = {}
    
    for page in pages:
        props = page.get("properties", {})
        
        # プロパティ名を推測（一般的な名前を試す）
        account_name = ""
        notion_user_id = ""
        name = ""
        email = ""
        
        # アカウント名を探す
        for prop_name in ["アカウント名", "Account", "アカウント", "ユーザー名", "名前", "Name"]:
            if prop_name in props:
                prop = props[prop_name]
                prop_type = prop.get("type", "")
                if prop_type == "title":
                    account_name = extract_text_property(prop, "title")
                elif prop_type == "rich_text":
                    account_name = extract_text_property(prop, "rich_text")
                break
        
        # NotionユーザーIDを探す（people プロパティ）
        for prop_name in ["Notionユーザー", "User", "ユーザー", "People"]:
            if prop_name in props:
                prop = props[prop_name]
                prop_type = prop.get("type", "")
                if prop_type == "people":
                    notion_user_id = extract_text_property(prop, "people")
                break
        
        # 表示名を探す
        for prop_name in ["名前", "Name", "表示名", "Display Name"]:
            if prop_name in props and prop_name != account_name:
                prop = props[prop_name]
                prop_type = prop.get("type", "")
                if prop_type == "title":
                    name = extract_text_property(prop, "title")
                elif prop_type == "rich_text":
                    name = extract_text_property(prop, "rich_text")
                break
        
        # メールアドレスを探す
        for prop_name in ["メール", "Email", "メールアドレス"]:
            if prop_name in props:
                prop = props[prop_name]
                prop_type = prop.get("type", "")
                if prop_type == "email":
                    email = prop.get("email", "")
                elif prop_type == "rich_text":
                    email = extract_text_property(prop, "rich_text")
                break
        
        # ページIDからユーザー情報を取得する場合のフォールバック
        if not notion_user_id:
            # created_byやlast_edited_byから取得を試みる
            created_by = page.get("created_by", {})
            if created_by:
                notion_user_id = created_by.get("id", "")
        
        if account_name:
            members[account_name] = {
                "account_name": account_name,
                "notion_user_id": notion_user_id,
                "name": name,
                "email": email,
                "page_id": page.get("id", ""),
            }
            print(f"  取得: アカウント名={account_name}, NotionユーザーID={notion_user_id}")
        else:
            print(f"  警告: アカウント名が見つからないレコード (ID: {page.get('id')})")
    
    return members


def parse_mapping_file(file_path: str) -> List[Dict]:
    """マッピングファイルを解析して各行の情報を取得"""
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # ヘッダー行を探す
    header_line_idx = None
    for i, line in enumerate(lines):
        if "名前" in line and "slack表示名" in line and "NotionユーザーID" in line:
            header_line_idx = i
            break
    
    if header_line_idx is None:
        print("ERROR: ヘッダー行が見つかりません")
        sys.exit(1)
    
    # データ行を解析
    data_rows = []
    for i in range(header_line_idx + 2, len(lines)):  # +2はヘッダーと区切り行をスキップ
        line = lines[i].strip()
        if not line or line.startswith("##"):
            continue
        
        # パイプで分割
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 9:  # 最低限の列数チェック
            continue
        
        # 列の順序: 名前 | slack表示名 | ハンドル | メールアドレス | Notionユーザー名 | NotionユーザーID | SlackユーザーID | roomチャンネル名 | roomチャンネルID
        row_data = {
            "line_index": i,
            "名前": parts[1] if len(parts) > 1 else "",
            "slack表示名": parts[2] if len(parts) > 2 else "",
            "ハンドル": parts[3] if len(parts) > 3 else "",
            "メールアドレス": parts[4] if len(parts) > 4 else "",
            "Notionユーザー名": parts[5] if len(parts) > 5 else "",
            "NotionユーザーID": parts[6] if len(parts) > 6 else "",
            "SlackユーザーID": parts[7] if len(parts) > 7 else "",
            "roomチャンネル名": parts[8] if len(parts) > 8 else "",
            "roomチャンネルID": parts[9] if len(parts) > 9 else "",
        }
        data_rows.append(row_data)
    
    return data_rows, lines


def update_mapping_file(members: Dict[str, Dict], file_path: str):
    """マッピングファイルを更新"""
    data_rows, lines = parse_mapping_file(file_path)
    
    updated_count = 0
    
    for row in data_rows:
        name_col = row.get("名前", "").strip()  # マッピングファイルの「名前」列
        notion_user_name = row.get("Notionユーザー名", "").strip()
        current_user_id = row.get("NotionユーザーID", "").strip()
        
        # 既にNotionユーザーIDがある場合はスキップ（オプション）
        # if current_user_id:
        #     continue
        
        # アカウント名（マッピングファイルの「名前」列）でマッチング
        matched_member = None
        # まず完全一致で検索
        if name_col in members:
            matched_member = members[name_col]
        else:
            # Notionユーザー名でも検索
            if notion_user_name in members:
                matched_member = members[notion_user_name]
            else:
                # 部分一致で検索（名前列とアカウント名）
                for account_name, member_info in members.items():
                    if (account_name.lower() in name_col.lower() or 
                        name_col.lower() in account_name.lower() or
                        account_name.lower() in notion_user_name.lower() or
                        notion_user_name.lower() in account_name.lower()):
                        matched_member = member_info
                        break
        
        if matched_member and matched_member.get("notion_user_id"):
            new_user_id = matched_member["notion_user_id"]
            line_idx = row["line_index"]
            
            # 該当行を更新
            old_line = lines[line_idx]
            # パイプで分割
            parts = [p.strip() for p in old_line.split("|")]
            if len(parts) > 6:
                parts[6] = new_user_id  # NotionユーザーID列を更新
                new_line = "|" + "|".join(parts) + "|\n"
                lines[line_idx] = new_line
                updated_count += 1
                print(f"更新: {notion_user_name} -> {new_user_id}")
    
    # ファイルに書き戻し
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    
    print(f"\n更新完了: {updated_count}件のNotionユーザーIDを更新しました")


def main():
    print("=" * 60)
    print("NotionメンバーDBから情報を取得してマッピングファイルを更新")
    print("=" * 60)
    print()
    
    # NotionメンバーDBから情報を取得
    members = get_notion_members()
    
    print(f"\n取得したメンバー数: {len(members)}")
    print("\n取得したメンバー一覧:")
    for account_name, info in members.items():
        print(f"  アカウント名: {account_name}")
        print(f"    - NotionユーザーID: {info.get('notion_user_id', 'なし')}")
        print(f"    - 表示名: {info.get('name', 'なし')}")
        print(f"    - メール: {info.get('email', 'なし')}")
        print()
    
    # マッピングファイルを更新
    if os.path.exists(MAPPING_FILE):
        print(f"マッピングファイルを更新中: {MAPPING_FILE}")
        update_mapping_file(members, MAPPING_FILE)
    else:
        print(f"ERROR: マッピングファイルが見つかりません: {MAPPING_FILE}")
        sys.exit(1)
    
    print("\n処理完了！")


if __name__ == "__main__":
    main()

