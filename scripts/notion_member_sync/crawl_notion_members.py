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

# NOTION_TOKENの取得を試みる（環境変数またはコマンドライン引数）
notion_token = os.getenv("NOTION_TOKEN")
if not notion_token:
    # .envファイルから読み込みを試みる
    try:
        import dotenv
        dotenv.load_dotenv()
        notion_token = os.getenv("NOTION_TOKEN")
    except ImportError:
        pass

if not notion_token:
    print("ERROR: NOTION_TOKEN is not set.")
    print("環境変数として設定するか、コマンドライン引数で指定してください：")
    print("  export NOTION_TOKEN=\"your_token\"")
    print("  python3 crawl_notion_members.py")
    print("\nまたは、スクリプト実行時に直接指定：")
    print("  NOTION_TOKEN=\"your_token\" python3 crawl_notion_members.py")
    sys.exit(1)

session = requests.Session()
session.headers.update({
    "Authorization": f"Bearer {notion_token}",
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


def get_notion_user_info(user_id: str) -> Dict:
    """Notion Users APIでユーザー情報を取得"""
    try:
        resp = session.get(f"{NOTION_API_BASE}/users/{user_id}")
        resp.raise_for_status()
        user_data = resp.json()
        
        user_info = {
            "id": user_data.get("id", ""),
            "name": user_data.get("name", ""),
            "email": "",
            "type": user_data.get("type", ""),
        }
        
        if user_data.get("type") == "person" and user_data.get("person"):
            user_info["email"] = user_data.get("person", {}).get("email", "")
        elif user_data.get("type") == "bot":
            bot_owner = user_data.get("bot", {}).get("owner", {})
            if bot_owner.get("type") == "user":
                user_info["email"] = bot_owner.get("user", {}).get("person", {}).get("email", "")
        
        time.sleep(0.1)  # レート制限対策
        return user_info
    except requests.exceptions.RequestException as e:
        print(f"  警告: ユーザー情報取得エラー (ID: {user_id}): {e}")
        return None


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
        
        # 氏名を取得（titleプロパティ）
        if "氏名" in props:
            prop = props["氏名"]
            prop_type = prop.get("type", "")
            if prop_type == "title":
                name = extract_text_property(prop, "title")
        
        # アカウント名（peopleプロパティ）からNotionユーザーIDを取得
        if "アカウント名" in props:
            prop = props["アカウント名"]
            prop_type = prop.get("type", "")
            if prop_type == "people":
                people_array = prop.get("people", [])
                if people_array:
                    # 最初のユーザーのIDを取得
                    notion_user_id = people_array[0].get("id", "")
                    # ユーザー名も取得（マッチング用）
                    person = people_array[0]
                    if person.get("type") == "person":
                        account_name = person.get("name", "")
                    elif person.get("type") == "bot":
                        account_name = person.get("name", "")
        
        
        # メールアドレスを取得
        if "メール" in props:
            prop = props["メール"]
            prop_type = prop.get("type", "")
            if prop_type == "email":
                email = prop.get("email", "")
            elif prop_type == "rich_text":
                email = extract_text_property(prop, "rich_text")
        
        # ページIDからユーザー情報を取得する場合のフォールバック
        if not notion_user_id:
            # created_byやlast_edited_byから取得を試みる
            created_by = page.get("created_by", {})
            if created_by:
                notion_user_id = created_by.get("id", "")
        
        # NotionユーザーIDがある場合は、Users APIで詳細情報を取得
        if notion_user_id:
            user_info = get_notion_user_info(notion_user_id)
            if user_info:
                # Users APIから取得した情報を優先
                final_email = user_info.get("email") or email
                final_name = user_info.get("name") or name
                
                # メールアドレスをキーとして使用（重複を防ぐ）
                if final_email:
                    email_key = final_email.lower().strip()
                    # 既に存在する場合は、より詳細な情報で上書き
                    if email_key not in members or not members[email_key].get("name"):
                        members[email_key] = {
                            "notion_user_id": notion_user_id,
                            "name": final_name,
                            "email": email_key,
                            "page_id": page.get("id", ""),
                        }
                        print(f"  取得: 氏名={final_name}, NotionユーザーID={notion_user_id}, メール={email_key}")
                else:
                    # メールアドレスがない場合はNotionユーザーIDをキーとして使用
                    user_key = f"user_{notion_user_id}"
                    if user_key not in members:
                        members[user_key] = {
                            "notion_user_id": notion_user_id,
                            "name": final_name,
                            "email": "",
                            "page_id": page.get("id", ""),
                        }
                        print(f"  取得（メールなし）: 氏名={final_name}, NotionユーザーID={notion_user_id}")
        elif email and email != "None" and email.strip():
            # NotionユーザーIDがないがメールアドレスがある場合
            email_key = email.lower().strip()
            if email_key not in members:
                members[email_key] = {
                    "notion_user_id": "",
                    "name": name,
                    "email": email_key,
                    "page_id": page.get("id", ""),
                }
                print(f"  取得（NotionユーザーIDなし）: 氏名={name}, メール={email_key}")
        else:
            print(f"  警告: NotionユーザーIDもメールアドレスも見つからないレコード (ID: {page.get('id')})")
    
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
        email_col = row.get("メールアドレス", "").strip().lower()  # マッピングファイルの「メールアドレス」列
        current_user_id = row.get("NotionユーザーID", "").strip()
        
        # 既にNotionユーザーIDがある場合はスキップ（オプション）
        # if current_user_id:
        #     continue
        
        # メールアドレスでマッチング（優先）
        matched_member = None
        if email_col and email_col in members:
            matched_member = members[email_col]
        else:
            # 名前列やNotionユーザー名でマッチング
            # まず完全一致で検索
            if name_col in members:
                matched_member = members[name_col]
            elif notion_user_name in members:
                matched_member = members[notion_user_name]
            else:
                # 部分一致で検索（名前列とアカウント名）
                for key, member_info in members.items():
                    member_email = member_info.get("email", "").lower() if member_info.get("email") else ""
                    member_name = member_info.get("name", "").lower() if member_info.get("name") else ""
                    member_account = member_info.get("account_name", "").lower() if member_info.get("account_name") else ""
                    
                    # メールアドレスで部分一致
                    if email_col and member_email and (email_col in member_email or member_email in email_col):
                        matched_member = member_info
                        break
                    # 名前列で部分一致
                    if name_col and (name_col.lower() in member_name or member_name in name_col.lower() or
                                     name_col.lower() in member_account or member_account in name_col.lower()):
                        matched_member = member_info
                        break
                    # Notionユーザー名で部分一致
                    if notion_user_name and (notion_user_name.lower() in member_name or member_name in notion_user_name.lower() or
                                             notion_user_name.lower() in member_account or member_account in notion_user_name.lower()):
                        matched_member = member_info
                        break
        
        if matched_member and matched_member.get("notion_user_id"):
            new_user_id = matched_member["notion_user_id"]
            line_idx = row["line_index"]
            
            # 該当行を更新
            old_line = lines[line_idx]
            # パイプで分割（先頭と末尾の空要素を除去）
            parts = [p.strip() for p in old_line.strip().split("|")]
            # 先頭と末尾が空の場合は除去
            if parts and parts[0] == "":
                parts = parts[1:]
            if parts and parts[-1] == "":
                parts = parts[:-1]
            
            if len(parts) > 6:
                parts[6] = new_user_id  # NotionユーザーID列を更新（インデックス6）
                # 元のフォーマットを保持（スペース付き）
                new_line = " | ".join(parts) + "\n"
                lines[line_idx] = new_line
                updated_count += 1
                print(f"更新: {notion_user_name or name_col} ({email_col}) -> {new_user_id}")
    
    # ファイルに書き戻し
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    
    print(f"\n更新完了: {updated_count}件のNotionユーザーIDを更新しました")


def load_notion_members_from_file(file_path: str) -> Dict[str, str]:
    """notion_members.mdファイルからメールアドレス→NotionユーザーIDのマッピングを読み込む"""
    email_to_notion_id = {}
    
    if not os.path.exists(file_path):
        print(f"警告: {file_path}が見つかりません")
        return email_to_notion_id
    
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # ヘッダー行を探す
    header_found = False
    for i, line in enumerate(lines):
        if "NotionユーザーID" in line and "メールアドレス" in line:
            header_found = True
            continue
        
        if header_found and line.strip() and not line.strip().startswith("|"):
            continue
        
        if header_found and "|" in line and "---" not in line:
            # データ行を解析
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 4:
                notion_user_id = parts[1].strip() if len(parts) > 1 else ""
                name = parts[2].strip() if len(parts) > 2 else ""
                email = parts[3].strip() if len(parts) > 3 else ""
                
                if email and notion_user_id:
                    email_lower = email.lower().strip()
                    email_to_notion_id[email_lower] = notion_user_id
    
    print(f"  notion_members.mdから{len(email_to_notion_id)}件のマッピングを読み込みました")
    return email_to_notion_id


def update_mapping_file_from_notion_members(notion_members_file: str, mapping_file: str):
    """notion_members.mdからuser_room_mapping.mdを更新"""
    # notion_members.mdからマッピングを読み込み
    email_to_notion_id = load_notion_members_from_file(notion_members_file)
    
    if not email_to_notion_id:
        print("  notion_members.mdからマッピングを読み込めませんでした")
        return
    
    # マッピングファイルを読み込み
    data_rows, lines = parse_mapping_file(mapping_file)
    
    updated_count = 0
    
    for row in data_rows:
        email_col = row.get("メールアドレス", "").strip().lower()
        current_user_id = row.get("NotionユーザーID", "").strip()
        
        # メールアドレスでマッチング
        if email_col and email_col in email_to_notion_id:
            new_user_id = email_to_notion_id[email_col]
            
            # 既に同じIDの場合はスキップ
            if current_user_id == new_user_id:
                continue
            
            line_idx = row["line_index"]
            
            # 該当行を更新
            old_line = lines[line_idx]
            # パイプで分割（先頭と末尾の空要素を除去）
            parts = [p.strip() for p in old_line.strip().split("|")]
            # 先頭と末尾が空の場合は除去
            if parts and parts[0] == "":
                parts = parts[1:]
            if parts and parts[-1] == "":
                parts = parts[:-1]
            
            if len(parts) > 6:
                parts[6] = new_user_id  # NotionユーザーID列を更新（インデックス6）
                # ワークのフォーマットを保持（スペース付き）
                new_line = " | ".join(parts) + "\n"
                lines[line_idx] = new_line
                updated_count += 1
                notion_user_name = row.get("Notionユーザー名", "").strip()
                name_col = row.get("名前", "").strip()
                print(f"  更新: {notion_user_name or name_col} ({email_col}) -> {new_user_id}")
    
    # ファイルに書き戻し
    with open(mapping_file, "w", encoding="utf-8") as f:
        f.writelines(lines)
    
    print(f"\n更新完了: {updated_count}件のNotionユーザーIDを更新しました")


def export_notion_members_list(members: Dict[str, Dict], output_dir: str):
    """NotionメンバーリストをMarkdown形式でエクスポート"""
    output_file = os.path.join(output_dir, "notion_members.md")
    
    # メールアドレスまたはNotionユーザーIDがあるメンバーでソート
    sorted_members = sorted(
        [(key, info) for key, info in members.items() if info.get("email") or info.get("notion_user_id")],
        key=lambda x: (x[1].get("email", "") or "", x[1].get("name", "") or "")
    )
    
    lines = []
    lines.append("# Notionメンバーリスト")
    lines.append("")
    lines.append("このファイルは、NotionメンバーDBから自動生成されたメンバー情報の一覧です。")
    lines.append("")
    lines.append("最終更新日時: " + time.strftime('%Y-%m-%d %H:%M:%S'))
    lines.append("")
    lines.append("## メンバー一覧")
    lines.append("")
    lines.append("| NotionユーザーID | 氏名 | メールアドレス |")
    lines.append("| --- | --- | --- |")
    
    for key, info in sorted_members:
        notion_user_id = info.get("notion_user_id", "")
        name = info.get("name", "")
        email = info.get("email", "")
        
        lines.append(f"| {notion_user_id} | {name} | {email} |")
    
    lines.append("")
    lines.append(f"合計: {len(sorted_members)}名")
    lines.append("")
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    
    print(f"✓ Notionメンバーリストを出力: {output_file}")


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
    
    # Notionメンバーリストをエクスポート
    notion_docs_dir = os.path.join(REPO_ROOT, "docs/notion")
    if not os.path.exists(notion_docs_dir):
        os.makedirs(notion_docs_dir, exist_ok=True)
        print(f"出力ディレクトリを作成: {notion_docs_dir}")
    
    print(f"\nNotionメンバーリストをエクスポート中...")
    export_notion_members_list(members, notion_docs_dir)
    
    # notion_members.mdを使用してマッピングファイルを更新
    notion_members_file = os.path.join(notion_docs_dir, "notion_members.md")
    if os.path.exists(MAPPING_FILE) and os.path.exists(notion_members_file):
        print(f"\nnotion_members.mdを使用してマッピングファイルを更新中: {MAPPING_FILE}")
        update_mapping_file_from_notion_members(notion_members_file, MAPPING_FILE)
    elif os.path.exists(MAPPING_FILE):
        print(f"\nnotion_members.mdが見つからないため、既存のロジックでマッピングファイルを更新中: {MAPPING_FILE}")
        update_mapping_file(members, MAPPING_FILE)
    else:
        print(f"\n警告: マッピングファイルが見つかりません: {MAPPING_FILE}")
        print("      マッピングファイルの更新はスキップします")
    
    print("\n処理完了！")


if __name__ == "__main__":
    main()

