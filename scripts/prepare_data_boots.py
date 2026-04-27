"""
预处理脚本：将 物料/时装靴-数据.xlsx 转换为 public/data/boots-products.json

运行方式：
  python3 scripts/prepare_data_boots.py

输出：
  public/data/boots-products.json
"""

import json
import os
import openpyxl

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "../物料/时装靴-数据.xlsx")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "../public/data/boots-products.json")

DROP_FIELDS = {
    "image_url",    # 相对路径，用 url 代替
    "图片",          # 空列
    "cate_name",    # 固定为"时装靴"
    "销售件数",      # 绝对值，不对外暴露
    "销售GMV",      # 绝对值，不对外暴露
}

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

ATTR_FIELDS = [
    "鞋子类型",
    "装饰物",
    "装饰位置",
    "图案装饰元素",
    "颜色",
    "颜色类型",
    "鞋面材质",
    "鞋头形状",
    "闭合方式",
    "鞋跟款式",
    "鞋跟高度",
    "鞋底厚薄",
    "靴筒高度",
]

# 靴筒高度数据脏值归一化（轻微变体 → 标准值）
BOOT_HEIGHT_NORMALIZE = {
    "中筒靴（15-31cm）": "中筒靴（15-30cm）",
    "中筒靴（15-32cm）": "中筒靴（15-30cm）",
}


def normalize_attrs(attrs: dict) -> dict:
    h = attrs.get("靴筒高度")
    if h and h in BOOT_HEIGHT_NORMALIZE:
        attrs["靴筒高度"] = BOOT_HEIGHT_NORMALIZE[h]
    return attrs


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

            if key.endswith("_说明") and key[:-3] in ATTR_FIELDS:
                attr_descs[key[:-3]] = val or ""
                continue

            if key in ATTR_FIELDS:
                attrs[key] = val if val and val != "unknown" else None
                continue

            new_key = RENAME_MAP.get(key, key)
            product[new_key] = val

        product["attrs"] = normalize_attrs(attrs)
        product["attrDescs"] = attr_descs
        products.append(product)

    wb.close()
    return products


def main():
    print(f"读取数据：{EXCEL_PATH}")
    products = load_products()
    print(f"共读取 {len(products)} 条产品记录")

    yr_cnt = {}
    for p in products:
        yr = p.get("year")
        yr_cnt[yr] = yr_cnt.get(yr, 0) + 1
    for yr, cnt in sorted(yr_cnt.items()):
        print(f"  {yr}年: {cnt} 条")

    jc = sum(1 for p in products if p.get("brand") == "jimmychoo官方旗舰店")
    print(f"  其中 JimmyChoo: {jc} 条")

    h_cnt = {}
    for p in products:
        h = p.get("attrs", {}).get("靴筒高度") or "unknown"
        h_cnt[h] = h_cnt.get(h, 0) + 1
    print(f"  靴筒高度分布: {h_cnt}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n已输出：{OUTPUT_PATH}")
    print(f"文件大小：{size_kb:.1f} KB")


if __name__ == "__main__":
    main()
