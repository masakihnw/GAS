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


def extract_property_details(pname: str, pdef: Dict) -> Dict:
    """プロパティの詳細情報を抽出"""
    ptype = pdef.get("type")
    mapped = PROPERTY_TYPE_MAP.get(ptype, ptype)
    
    details = {
        "name": slugify(pname, separator="_"),
        "raw_name": pname,
        "type": mapped,
        "raw_type": ptype,
        "options": None,
        "formula": None,
        "relation_info": None,
        "rollup_info": None,
    }
    
    # select/multi_selectのオプションを取得
    if ptype in ["select", "multi_select"]:
        options = pdef.get(ptype, {}).get("options", [])
        details["options"] = [opt.get("name", "") for opt in options]
    
    # formulaの式を取得
    if ptype == "formula":
        formula_expr = pdef.get("formula", {}).get("expression", "")
        details["formula"] = formula_expr
    
    # relationの詳細を取得
    if ptype == "relation":
        rel = pdef.get("relation", {})
        details["relation_info"] = {
            "database_id": rel.get("database_id"),
            "type": rel.get("type", "dual_property"),  # dual_property or single_property
            "single_property": rel.get("single_property"),
            "dual_property": rel.get("dual_property"),
        }
    
    # rollupの詳細を取得
    if ptype == "rollup":
        rollup = pdef.get("rollup", {})
        details["rollup_info"] = {
            "relation_property_name": rollup.get("relation_property_name", ""),
            "relation_property_id": rollup.get("relation_property_id", ""),
            "rollup_property_name": rollup.get("rollup_property_name", ""),
            "rollup_property_id": rollup.get("rollup_property_id", ""),
            "function": rollup.get("function", ""),  # count, sum, average, etc.
        }
    
    return details


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
            field_details = extract_property_details(pname, pdef)
            fields.append(field_details)
        
        tables[db_id] = {
            "id": db_id,
            "name": table_name,
            "title": ''.join([t.get('plain_text','') for t in schema.get('title', [])]) or table_name,
            "fields": fields,
            "raw": schema,
        }
    
    # 次にRelationとRollupからエッジ作成
    print("関係（Relation/Rollup）を解析中...")
    for db in databases:
        db_id = db["id"]
        schema = tables[db_id]["raw"]
        src = tables[db_id]
        
        for field in tables[db_id]["fields"]:
            pname = field["raw_name"]
            pdef = schema.get("properties", {}).get(pname, {})
            ptype = field.get("raw_type")
            
            # Relationからエッジ作成
            if ptype == "relation":
                rel_info = field.get("relation_info", {})
                dst_id = rel_info.get("database_id")
                
                if not dst_id or dst_id not in tables:
                    continue
                
                left, right = infer_edge_cardinality(pdef)
                edges.append({
                    "src_id": db_id,
                    "src_name": src["name"],
                    "src_prop": field["name"],
                    "src_raw_prop": pname,
                    "dst_id": dst_id,
                    "dst_name": tables[dst_id]["name"],
                    "style": (left, right),
                    "type": "relation",
                    "dual_property": rel_info.get("dual_property", {}).get("name") if rel_info.get("type") == "dual_property" else None,
                })
    
    # Rollupの元Relationを解決してエッジを追加
    for db_id, table in tables.items():
        schema = table["raw"]
        for field in table["fields"]:
            if field.get("raw_type") == "rollup":
                rollup_info = field.get("rollup_info", {})
                relation_prop_name = rollup_info.get("relation_property_name", "")
                
                # 同じDB内のRelationプロパティを探す
                for rel_field in table["fields"]:
                    if rel_field.get("raw_name") == relation_prop_name and rel_field.get("raw_type") == "relation":
                        rel_info = rel_field.get("relation_info", {})
                        dst_id = rel_info.get("database_id")
                        
                        if dst_id and dst_id in tables:
                            # Rollupエッジを追加
                            left, right = infer_edge_cardinality({"type": "rollup"})
                            edges.append({
                                "src_id": db_id,
                                "src_name": table["name"],
                                "src_prop": field["name"],
                                "src_raw_prop": field["raw_name"],
                                "dst_id": dst_id,
                                "dst_name": tables[dst_id]["name"],
                                "style": (left, right),
                                "type": "rollup",
                                "function": rollup_info.get("function", ""),
                                "based_on_relation": relation_prop_name,
                            })
                        break
    
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
            field_type = f['type']
            field_name = f['name']
            lines.append(f"    {field_type} {field_name}")
        lines.append("  }")
    
    for e in edges:
        l, r = e["style"]
        edge_label = e['src_prop']
        if e.get("type") == "rollup":
            edge_label = f"{e['src_prop']} ({e.get('function', 'rollup')})"
        lines.append(
            f"  {e['src_name']} {l}--{r} {e['dst_name']} : {edge_label}"
        )
    
    return "\n".join(lines) + "\n"


def to_dbml(tables: Dict[str, Dict], edges: List[Dict]) -> str:
    """DBML形式に変換"""
    lines = []
    
    for t in tables.values():
        lines.append(f"Table {t['name']} {{")
        for f in t["fields"]:
            # DBMLは型が重要だがNotion型→RDB型の対応は仮。text/number/date等に丸める。
            field_type = f['type']
            field_name = f['name']
            # コメントで追加情報を記録
            comment_parts = []
            if f.get("options"):
                comment_parts.append(f"options: {', '.join(f['options'])}")
            if f.get("formula"):
                comment_parts.append(f"formula: {f['formula']}")
            if f.get("rollup_info"):
                rollup = f["rollup_info"]
                comment_parts.append(f"rollup({rollup.get('function', '')}) via {rollup.get('relation_property_name', '')}")
            
            comment = f" // {'; '.join(comment_parts)}" if comment_parts else ""
            lines.append(f"  {field_name} {field_type}{comment}")
        lines.append("}")
        lines.append("")
    
    # 関係（カーディナリティは注釈とする）
    for e in edges:
        edge_comment = "Notion relation"
        if e.get("type") == "rollup":
            edge_comment = f"Notion rollup ({e.get('function', '')}) via {e.get('based_on_relation', '')}"
        elif e.get("dual_property"):
            edge_comment = f"Notion relation (dual: {e['dual_property']})"
        
        lines.append(
            f"Ref: {e['src_name']}.{e['src_prop']} > {e['dst_name']}.id // {edge_comment} (cardinality approx)"
        )
    
    return "\n".join(lines) + "\n"


def to_markdown_doc(tables: Dict[str, Dict], edges: List[Dict]) -> str:
    """Markdown形式の詳細ドキュメントを生成"""
    lines = ["# Notion データベース構造ドキュメント", ""]
    lines.append("このドキュメントは、Notionワークスペース内のデータベース構造を自動生成したものです。")
    lines.append("")
    
    # データベース一覧
    lines.append("## データベース一覧")
    lines.append("")
    for t in sorted(tables.values(), key=lambda x: x["name"]):
        lines.append(f"- **{t['title']}** (`{t['name']}`)")
    lines.append("")
    
    # 各データベースの詳細
    for t in sorted(tables.values(), key=lambda x: x["name"]):
        lines.append(f"## {t['title']} (`{t['name']}`)")
        lines.append("")
        lines.append(f"- **DB ID**: `{t['id']}`")
        lines.append(f"- **プロパティ数**: {len(t['fields'])}")
        lines.append("")
        
        # プロパティの詳細
        lines.append("### プロパティ")
        lines.append("")
        lines.append("| プロパティ名 | 型 | 詳細 |")
        lines.append("|------------|-----|------|")
        
        for f in sorted(t["fields"], key=lambda x: x["raw_name"]):
            prop_name = f["raw_name"]
            prop_type = f["type"]
            details = []
            
            # select/multi_selectのオプション
            if f.get("options"):
                details.append(f"オプション: {', '.join(f['options'])}")
            
            # formulaの式
            if f.get("formula"):
                details.append(f"式: `{f['formula']}`")
            
            # relation情報
            if f.get("relation_info"):
                rel_info = f["relation_info"]
                dst_name = "外部DB"
                for table_id, table in tables.items():
                    if table_id == rel_info.get("database_id"):
                        dst_name = table["title"]
                        break
                details.append(f"→ {dst_name}")
                if rel_info.get("dual_property"):
                    details.append(f"双方向: {rel_info['dual_property'].get('name', '')}")
            
            # rollup情報
            if f.get("rollup_info"):
                rollup = f["rollup_info"]
                details.append(f"集計: {rollup.get('function', '')} ({rollup.get('relation_property_name', '')}経由)")
            
            detail_str = "<br>".join(details) if details else "-"
            lines.append(f"| `{prop_name}` | `{prop_type}` | {detail_str} |")
        
        lines.append("")
    
    # データベース間の関係
    lines.append("## データベース間の関係")
    lines.append("")
    
    # Relation関係
    relation_edges = [e for e in edges if e.get("type") == "relation"]
    if relation_edges:
        lines.append("### Relation関係")
        lines.append("")
        lines.append("| 元DB | プロパティ | 先DB | 双方向プロパティ |")
        lines.append("|------|-----------|------|------------------|")
        for e in sorted(relation_edges, key=lambda x: (x["src_name"], x["dst_name"])):
            dual = e.get("dual_property", "-")
            lines.append(f"| `{e['src_name']}` | `{e['src_prop']}` | `{e['dst_name']}` | {dual} |")
        lines.append("")
    
    # Rollup関係
    rollup_edges = [e for e in edges if e.get("type") == "rollup"]
    if rollup_edges:
        lines.append("### Rollup関係")
        lines.append("")
        lines.append("| 元DB | Rollupプロパティ | 先DB | 集計方法 | 元Relation |")
        lines.append("|------|----------------|------|----------|-----------|")
        for e in sorted(rollup_edges, key=lambda x: (x["src_name"], x["dst_name"])):
            lines.append(f"| `{e['src_name']}` | `{e['src_prop']}` | `{e['dst_name']}` | {e.get('function', '-')} | `{e.get('based_on_relation', '-')}` |")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append(f"生成日時: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
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
    ap.add_argument(
        "--out-markdown",
        default="../docs/notion/erd/notion_database_structure.md",
        help="Markdown詳細ドキュメント出力ファイルパス（デフォルト: ../docs/notion/erd/notion_database_structure.md）"
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
    markdown_dir = os.path.dirname(args.out_markdown) or "."
    
    for output_dir in [mermaid_dir, dbml_dir, markdown_dir]:
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
    
    # Markdown詳細ドキュメントを出力
    markdown_doc = to_markdown_doc(tables, edges)
    with open(args.out_markdown, "w", encoding="utf-8") as f:
        f.write(markdown_doc)
    print(f"✓ Markdown詳細ドキュメントを出力: {args.out_markdown}")
    
    print("\n完了しました！")


if __name__ == "__main__":
    main()

