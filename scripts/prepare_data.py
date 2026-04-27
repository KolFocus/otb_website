"""
预处理脚本：将 物料/浅口单鞋-数据.xlsx 转换为 public/data/pumps-products.json

运行方式：
  python3 scripts/prepare_data.py

输出：
  public/data/pumps-products.json
"""

import json
import os
import openpyxl

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "../物料/浅口单鞋-数据.xlsx")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "../public/data/pumps-products.json")

# 需要过滤掉的字段
DROP_FIELDS = {
    "image_url",    # 相对路径，用url代替
    "图片",          # 空列
    "cate_name",    # 固定为"浅口单鞋"
    "销售件数",      # 绝对值，不对外暴露
    "销售GMV",      # 绝对值，不对外暴露
}

# 字段重命名映射（英文key更友好）
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

# 属性维度字段（用于分析计算）
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
    "鞋面绑带款式",
    "鞋跟款式",
    "鞋跟高度",
    "鞋底厚薄",
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

        # 过滤掉不需要的字段，构建产品对象
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

            # 属性字段收集到attrs
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

    # 按年份统计
    year_counts = {}
    for p in products:
        yr = p.get("year")
        year_counts[yr] = year_counts.get(yr, 0) + 1
    for yr, cnt in sorted(year_counts.items()):
        print(f"  {yr}年: {cnt} 条")

    # JimmyChoo 商品数
    jc_count = sum(1 for p in products if p.get("brand") == "jimmychoo官方旗舰店")
    print(f"  其中 JimmyChoo: {jc_count} 条")

    # 写入JSON
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n已输出：{OUTPUT_PATH}")
    print(f"文件大小：{size_kb:.1f} KB")


if __name__ == "__main__":
    main()
