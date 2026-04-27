"""
预处理脚本：将 物料/时尚休闲鞋-数据.xlsx 转换为 public/data/casual-products.json

运行方式：
  python3 scripts/prepare_data_casual.py

输出：
  public/data/casual-products.json
"""

import json
import os
import openpyxl

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "../物料/时尚休闲鞋-数据.xlsx")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "../public/data/casual-products.json")

# 需要过滤掉的字段
DROP_FIELDS = {
    "排序",        # 序号，用 sort_key 代替
    "image_url",   # 相对路径，用 url 代替
    "图片",         # 空列
    "cate_name",   # 固定为"时尚休闲鞋"
    "销售件数",     # 绝对值，不对外暴露
    "GMV",         # 绝对值，不对外暴露
    "ai_raw",      # AI 原始输出，内部字段
    "error",       # 内部字段
    "latency_ms",  # 内部字段
}

# 字段重命名映射
RENAME_MAP = {
    "yr": "year",
    "seller_nick": "brand",
    "md5_item_id": "itemId",
    "url": "imageUrl",
    "net_qty_pct": "netQtyPct",
    "net_gmv_pct": "netGmvPct",
    "sort_key": "sortKey",
    "件单价": "unitPrice",
}

# 属性维度字段
ATTR_FIELDS = [
    "鞋子类型",
    "装饰物",
    "装饰位置",
    "图案装饰元素",
    "颜色",
    "颜色类型",
    "鞋面材质",
    "鞋底厚薄",
    "闭合方式",
]


def load_products():
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
    ws = wb.active
    headers = None
    products = []

    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            headers = list(row)
            continue

        row_dict = dict(zip(headers, row))

        product = {}
        attrs = {}
        attr_descs = {}

        for key, val in row_dict.items():
            if key in DROP_FIELDS:
                continue

            # 属性说明字段单独收集
            if key.endswith("_说明") and key[:-3] in ATTR_FIELDS:
                attr_name = key[:-3]
                attr_descs[attr_name] = val or ""
                continue

            # 属性字段收集到 attrs
            if key in ATTR_FIELDS:
                attrs[key] = val if val and val != "unknown" else None
                continue

            # 普通字段重命名
            new_key = RENAME_MAP.get(key, key)
            product[new_key] = val

        product["attrs"] = attrs
        product["attrDescs"] = attr_descs

        products.append(product)

    wb.close()
    return products


def main():
    print(f"读取数据：{EXCEL_PATH}")
    products = load_products()
    print(f"共读取 {len(products)} 条产品记录")

    year_counts = {}
    for p in products:
        yr = p.get("year")
        year_counts[yr] = year_counts.get(yr, 0) + 1
    for yr, cnt in sorted(year_counts.items()):
        print(f"  {yr}年: {cnt} 条")

    jc_count = sum(1 for p in products if p.get("brand") == "jimmychoo官方旗舰店")
    print(f"  其中 JimmyChoo: {jc_count} 条")

    type_counts = {}
    for p in products:
        t = p.get("attrs", {}).get("鞋子类型", "未知")
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"  鞋子类型分布: {type_counts}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n已输出：{OUTPUT_PATH}")
    print(f"文件大小：{size_kb:.1f} KB")


if __name__ == "__main__":
    main()
