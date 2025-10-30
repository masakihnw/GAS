#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Notionデータベース構造をERD風のMermaidとDBMLに変換するスクリプト

使い方:
    export NOTION_TOKEN="secret_xxx"
    python notion_erd_exporter.py --workspace-scan --out-mermaid notion_erd.mmd --out-dbml notion_schema.dbml
"""

import os
import sys
import time
import json
import argparse
from typing import Dict, List, Tuple
import requests
from slugify import slugify

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"  # 安定版。必要に応じて更新可

# ------------------------------
# 型・ユーティリティ
# ------------------------------

PROPERTY_TYPE_MAP = {
    "title": "text",
    "rich_text": "text",
    "number": "number",
    "select": "enum",
    "multi_select": "enum[]",
    "date": "date",
    "people": "user[]",
    "files": "file[]",
    "checkbox": "boolean",
    "url": "url",
    "email": "email",
    "phone_number": "phone",
    "formula": "formula",
    "relation": "relation",
    "rollup": "rollup",
    "created_time": "timestamp",
    "created_by": "user",
    "last_edited_time": "timestamp",
    "last_edited_by": "user",
    "status": "status",
}

HEADERS = {
    "Authorization": f"Bearer {os.getenv('NOTION_TOKEN','')}\n",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}

if not os.getenv("NOTION_TOKEN"):
    print("ERROR: NOTION_TOKEN is not set.")
    sys.exit(1)

session = requests.Session()
session.headers.clear()
session.headers.update({
    "Authorization": f"Bearer {os.getenv('NOTION_TOKEN')}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
})


def notion_search_databases(name_filter: List[str]) -> List[Dict]:
    """/searchでDBを列挙。name_filterがあればタイトルに含むもののみ。"""
    results = []
    payload = {
        "filter": {"value": "database", "property": "object"},
        "page_size": 100,
        "sort": {"direction": "ascending", "timestamp": "last_edited_time"}
    }
    
    while True:
        resp = session.post(f"{NOTION_API_BASE}/search", data=json.dumps(payload))
        resp.raise_for_status()
        data = resp.json()
        
        for it in data.get("results", []):
            title = ''.join([t.get('plain_text','') for t in it.get('title', [])])
            if name_filter:
                if any(f.lower().strip() in title.lower() for f in name_filter):
                    results.append(it)
            else:
                results.append(it)
        
        if not data.get("has_more"):
            break
        payload["start_cursor"] = data.get("next_cursor")
        time.sleep(0.3)  # レート制限対策
    
    return results


def get_database_schema(db_id: str) -> Dict:
    """データベーススキーマを取得"""
    resp = session.get(f"{NOTION_API_BASE}/databases/{db_id}")
    resp.raise_for_status()
    time.sleep(0.3)  # レート制限対策
    return resp.json()


def normalize_db_name(db: Dict) -> str:
    """データベース名を正規化（Mermaid/DBMLで扱いやすい形式に）"""
    title = ''.join([t.get('plain_text','') for t in db.get('title', [])]) or db.get('id')
    # Mermaid/DBMLで扱いやすいようにスラッグ化
    s = slugify(title or "untitled", separator="_")
    # 先頭数字は避ける
    if s and s[0].isdigit():
        s = f"t_{s}"
    return s or db.get('id')


def infer_edge_cardinality(prop: Dict) -> Tuple[str, str]:
    """
    NotionのRelationは実質 list で多対多的に使えることが多い。
    厳密な制約がないため、デフォルト: N:M とみなす（Mermaid: }o--o{）
    """
    # 記号はMermaid erDiagramに準拠
    return ("}o", "o{")  # many-to-many 風（左DB }o--o{ 右DB）


def build_model(databases: List[Dict]) -> Tuple[Dict, List[Dict]]:
    """ノード（DB=tables）とエッジ（relations）に分解"""
    tables: Dict[str, Dict] = {}
    edges: List[Dict] = []
    
    # まずテーブル登録
    print(f"データベーススキーマを取得中... ({len(databases)}件)")
    for i, db in enumerate(databases, 1):
        db_id = db["id"]
        print(f"  [{i}/{len(databases)}] DB ID: {db_id}")
        schema = get_database_schema(db_id)
        table_name = normalize_db_name(schema)
        props = schema.get("properties", {})
        
        fields = []
        for pname, pdef in props.items():
            ptype = pdef.get("type")
            mapped = PROPERTY_TYPE_MAP.get(ptype, ptype)
            fields.append({
                "name": slugify(pname, separator="_"),
                "raw_name": pname,
                "type": mapped,
                "raw_type": ptype,
            })
        
        tables[db_id] = {
            "id": db_id,
            "name": table_name,
            "title": ''.join([t.get('plain_text','') for t in schema.get('title', [])]) or table_name,
            "fields": fields,
            "raw": schema,
        }
    
    # 次にRelationからエッジ作成
    print("関係（Relation）を解析中...")
    for db in databases:
        db_id = db["id"]
        schema = tables[db_id]["raw"]
        src = tables[db_id]
        
        for pname, pdef in schema.get("properties", {}).items():
            if pdef.get("type") == "relation":
                rel = pdef.get("relation", {})
                dst_id = rel.get("database_id")
                
                if not dst_id or dst_id not in tables:
                    continue
                
                left, right = infer_edge_cardinality(pdef)
                edges.append({
                    "src_id": db_id,
                    "src_name": src["name"],
                    "src_prop": slugify(pname, separator="_"),
                    "dst_id": dst_id,
                    "dst_name": tables[dst_id]["name"],
                    "style": (left, right),
                })
    
    return tables, edges


# ------------------------------
# フォーマッタ
# ------------------------------

def to_mermaid_er(tables: Dict[str, Dict], edges: List[Dict]) -> str:
    """Mermaid ER図形式に変換"""
    lines = ["erDiagram"]
    
    for t in tables.values():
        lines.append(f"  {t['name']} {{")
        for f in t["fields"]:
            # Mermaidは厳密な型ではないため、ラベル的に出力
            lines.append(f"    {f['type']} {f['name']}")
        lines.append("  }")
    
    for e in edges:
        l, r = e["style"]
        lines.append(
            f"  {e['src_name']} {l}--{r} {e['dst_name']} : {e['src_prop']}"
        )
    
    return "\n".join(lines) + "\n"


def to_dbml(tables: Dict[str, Dict], edges: List[Dict]) -> str:
    """DBML形式に変換"""
    lines = []
    
    for t in tables.values():
        lines.append(f"Table {t['name']} {{")
        for f in t["fields"]:
            # DBMLは型が重要だがNotion型→RDB型の対応は仮。text/number/date等に丸める。
            lines.append(f"  {f['name']} {f['type']}")
        lines.append("}")
        lines.append("")
    
    # 関係（カーディナリティは注釈とする）
    for e in edges:
        lines.append(
            f"Ref: {e['src_name']}.{e['src_prop']} > {e['dst_name']}.id // Notion relation (cardinality approx)"
        )
    
    return "\n".join(lines) + "\n"


# ------------------------------
# CLI
# ------------------------------

def main():
    ap = argparse.ArgumentParser(
        description="Notionデータベース構造をERD風のMermaidSeederとDBMLに変換"
    )
    ap.add_argument(
        "--workspace-scan",
        action="store_true",
        help="ワークスペース全体をスキャン"
    )
    ap.add_argument(
        "--db-ids",
        help="カンマ区切りのDB ID指定（--workspace-scanと排他）"
    )
    ap.add_argument(
        "--out-mermaid",
        default="../docs/notion/erd/notion_erd.mmd",
        help="Mermaid ER図出力ファイルパス（デフォルト: ../docs/notion/erd/notion_erd.mmd）"
    )
    ap.add_argument(
        "--out-dbml",
        default="../docs/notion/erd/notion_schema.dbml",
        help="DBML出力ファイルパス（デフォルト: ../docs/notion/erd/notion_schema.dbml）"
    )
    
    args = ap.parse_args()
    
    if args.workspace_scan and args.db_ids:
        print("ERROR: --workspace-scan と --db-ids は同時指定できません")
        sys.exit(2)
    
    if args.workspace_scan:
        name_filter = [
            s.strip()
            for s in os.getenv("NOTION_DB_NAME_FILTER", "").split(",")
            if s.strip()
        ]
        print("ワークスペース内のデータベースを検索中...")
        dbs = notion_search_databases(name_filter)
    else:
        if not args.db_ids:
            print("ERROR: --db-ids か --workspace-scan を指定してください")
            sys.exit(2)
        dbs = [{"id": s.strip()} for s in args.db_ids.split(",") if s.strip()]
    
    if not dbs:
        print("No databases found. Integration access or filters to check.")
        sys.exit(0)
    
    print(f"\n対象データベース数: {len(dbs)}\n")
    tables, edges = build_model(dbs)
    
    print(f"\n生成されたテーブル数: {len(tables)}")
    print(f"生成された関係数: {len(edges)}")
    
    # 出力ディレクトリを作成（存在しない場合）
    mermaid_dir = os.path.dirname(args.out_mermaid) or "."
    dbml_dir = os.path.dirname(args.out_dbml) or "."
    
    for output_dir in [mermaid_dir, dbml_dir]:
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            print(f"出力ディレクトリを作成: {output_dir}")
    
    # Mermaid ER図を出力
    mermaid = to_mermaid_er(tables, edges)
    with open(args.out_mermaid, "w", encoding="utf-8") as f:
        f.write(mermaid)
    print(f"\n✓ Mermaid ER図を出力: {args.out_mermaid}")
    
    # DBMLを出力
    dbml = to_dbml(tables, edges)
    with open(args.out_dbml, "w", encoding="utf-8") as f:
        f.write(dbml)
    print(f"✓ DBMLスキーマを出力: {args.out_dbml}")
    
    print("\n完了しました！")


if __name__ == "__main__":
    main()

