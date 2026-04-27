"use client";

import { useState, useMemo, useCallback } from "react";
import type { Product, AttributeRow, DimensionAnalysis, ModalState } from "@/types/product";

// ─── Constants ────────────────────────────────────────────────────────────────

const HEEL_HEIGHTS = ["平底", "低跟", "中跟", "高跟", "超高跟"] as const;

const ALL_DIMENSIONS = [
  "装饰物",
  "装饰位置",
  "颜色",
  "鞋面材质",
  "鞋头形状",
  "闭合方式",
  "鞋面绑带款式",
  "鞋跟款式",
] as const;

const OWN_BRAND_NICK = "jimmychoo官方旗舰店";
const OWN_BRAND_DISPLAY = "Jimmy Choo";
const CATEGORY_NAME = "浅口单鞋";

const CURRENT_YEAR = 2025;
const PREV_YEAR = CURRENT_YEAR - 1;

function isOwnBrand(product: Product) {
  return product.brand === OWN_BRAND_NICK;
}

// ─── Analysis computation ─────────────────────────────────────────────────────

function computeAnalysis(products: Product[], heelHeight: string): DimensionAnalysis[] {
  const dims = heelHeight === "平底"
    ? ALL_DIMENSIONS.filter((d) => d !== "鞋跟款式")
    : ALL_DIMENSIONS;

  const p2025 = products.filter(
    (p) => p.year === CURRENT_YEAR && p.attrs["鞋跟高度"] === heelHeight
  );
  const p2024 = products.filter(
    (p) => p.year === PREV_YEAR && p.attrs["鞋跟高度"] === heelHeight
  );

  const total2025 = p2025.reduce((s, p) => s + (p.netQtyPct || 0), 0);
  const total2024 = p2024.reduce((s, p) => s + (p.netQtyPct || 0), 0);

  return dims.map((dim) => {
    const key = dim as keyof Product["attrs"];

    const vals = new Set<string>([
      ...p2025.map((p) => p.attrs[key]).filter((v): v is string => !!v),
      ...p2024.map((p) => p.attrs[key]).filter((v): v is string => !!v),
    ]);

    const rows: AttributeRow[] = Array.from(vals).map((value) => {
      const sum2025 = p2025
        .filter((p) => p.attrs[key] === value)
        .reduce((s, p) => s + (p.netQtyPct || 0), 0);
      const sum2024 = p2024
        .filter((p) => p.attrs[key] === value)
        .reduce((s, p) => s + (p.netQtyPct || 0), 0);

      const share2025 = total2025 > 0 ? sum2025 / total2025 : 0;
      const share2024 = total2024 > 0 ? sum2024 / total2024 : 0;

      let yoy: number | "NEW" | null = null;
      if (share2024 === 0 && share2025 > 0) yoy = "NEW";
      else if (share2024 > 0) yoy = (share2025 - share2024) / share2024;

      return {
        value,
        share2025,
        share2024,
        yoy,
        hasCompetitor: p2025.some((p) => p.attrs[key] === value && !isOwnBrand(p)),
        hasOwnBrand: p2025.some((p) => p.attrs[key] === value && isOwnBrand(p)),
      };
    });

    // Sort by 2025 share descending
    rows.sort((a, b) => b.share2025 - a.share2025);

    return { dimension: dim, rows };
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatPct(val: number) {
  return (val * 100).toFixed(1) + "%";
}

function formatYoy(yoy: number | "NEW" | null) {
  if (yoy === null) return { text: "—", color: "text-gray-400" };
  if (yoy === "NEW") return { text: "NEW", color: "text-blue-600", badge: true };
  const pct = (yoy * 100).toFixed(0);
  if (yoy > 0) return { text: `+${pct}%`, color: "text-emerald-600" };
  if (yoy < 0) return { text: `${pct}%`, color: "text-red-500" };
  return { text: "0%", color: "text-gray-500" };
}

function formatPrice(val: number) {
  return "¥" + val.toLocaleString("zh-CN");
}

function cleanBrandName(nick: string) {
  return nick
    .replace(/官方旗舰店$/, "")
    .replace(/旗舰店$/, "")
    .replace(/[_]\d+$/, "")
    .replace(/d\]/, "")
    .trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function YoyBadge({ yoy }: { yoy: number | "NEW" | null }) {
  const { text, color, badge } = formatYoy(yoy);
  if (badge) {
    return (
      <span className="inline-block px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
        NEW
      </span>
    );
  }
  return <span className={`text-sm font-medium ${color}`}>{text}</span>;
}

function ShareBar({ share, maxShare }: { share: number; maxShare: number }) {
  const width = maxShare > 0 ? (share / maxShare) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[60px]">
        <div
          className="h-2 rounded-full bg-amber-400"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-sm text-gray-700 w-12 text-right tabular-nums">
        {formatPct(share)}
      </span>
    </div>
  );
}

function CheckMark({ has }: { has: boolean }) {
  return has ? (
    <span className="text-emerald-500 font-bold">√</span>
  ) : (
    <span className="text-gray-300">×</span>
  );
}

// ─── ProductModal ──────────────────────────────────────────────────────────────

function ProductModal({
  modal,
  products,
  onClose,
}: {
  modal: ModalState;
  products: Product[];
  onClose: () => void;
}) {
  const [year, setYear] = useState<number>(CURRENT_YEAR);

  const filtered = useMemo(() => {
    const key = modal.dimension as keyof Product["attrs"];
    return products.filter(
      (p) =>
        p.year === year &&
        p.attrs["鞋跟高度"] === modal.heelHeight &&
        p.attrs[key] === modal.value
    );
  }, [products, modal, year]);  // year is derived from CURRENT_YEAR constant

  // JimmyChoo first
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => {
      if (isOwnBrand(a) && !isOwnBrand(b)) return -1;
      if (!isOwnBrand(a) && isOwnBrand(b)) return 1;
      return (b.netQtyPct || 0) - (a.netQtyPct || 0);
    }),
    [filtered]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {modal.dimension}
              </span>
              <span className="text-lg font-semibold text-gray-900">
                {modal.value}
              </span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                {modal.heelHeight}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              共 {filtered.length} 款商品
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Year toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              {[PREV_YEAR, CURRENT_YEAR].map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    year === y
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <div className="overflow-y-auto p-6">
          {sorted.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              该组合暂无商品数据
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {sorted.map((product, idx) => (
                <ProductCard key={idx} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`rounded-xl overflow-hidden flex flex-col border transition-shadow hover:shadow-md ${
        isOwnBrand(product)
          ? "border-amber-400 shadow-amber-100 shadow-sm"
          : "border-gray-100"
      }`}
    >
      {/* Image */}
      <div className="relative bg-gray-50 aspect-square">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            无图片
          </div>
        )}
        {isOwnBrand(product) && (
          <span className="absolute top-2 left-2 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            本品
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <p
          className={`text-xs font-semibold truncate ${
            isOwnBrand(product) ? "text-amber-600" : "text-gray-500"
          }`}
        >
          {cleanBrandName(product.brand)}
        </p>
        <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed flex-1">
          {product.title}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm font-bold text-gray-900">
            {formatPrice(product.unitPrice)}
          </span>
          <span className="text-[10px] text-gray-400">
            {product.netQtyPct?.toFixed(2)}% 销量
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Dimension Table ──────────────────────────────────────────────────────────

function DimensionTable({
  analysis,
  onRowClick,
}: {
  analysis: DimensionAnalysis;
  onRowClick: (row: AttributeRow) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const maxShare = Math.max(...analysis.rows.map((r) => r.share2025));

  return (
    <div className="mb-2">
      {/* Dimension Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left rounded-lg mb-1"
      >
        <span
          className={`text-gray-400 transition-transform text-xs ${
            expanded ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
        <span className="text-sm font-semibold text-gray-700">
          {analysis.dimension}
        </span>
        <span className="text-xs text-gray-400">
          {analysis.rows.length} 项
        </span>
      </button>

      {expanded && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left px-4 py-2 font-medium w-28">细分属性</th>
              <th className="text-left px-4 py-2 font-medium">{String(CURRENT_YEAR).slice(2)}年占比</th>
              <th className="text-left px-4 py-2 font-medium w-24">YOY</th>
              <th className="text-center px-4 py-2 font-medium w-16">竞品</th>
              <th className="text-center px-4 py-2 font-medium w-16">本品</th>
            </tr>
          </thead>
          <tbody>
            {analysis.rows.map((row) => (
              <tr
                key={row.value}
                onClick={() => onRowClick(row)}
                className="border-b border-gray-50 hover:bg-amber-50 cursor-pointer transition-colors group"
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium text-gray-800 group-hover:text-amber-700 transition-colors">
                    {row.value}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <ShareBar share={row.share2025} maxShare={maxShare} />
                </td>
                <td className="px-4 py-2.5">
                  <YoyBadge yoy={row.yoy} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CheckMark has={row.hasCompetitor} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CheckMark has={row.hasOwnBrand} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PumpsAnalysis({ products }: { products: Product[] }) {
  const [heelHeight, setHeelHeight] = useState<string>("平底");
  const [modal, setModal] = useState<ModalState | null>(null);

  const analysis = useMemo(
    () => computeAnalysis(products, heelHeight),
    [products, heelHeight]
  );

  const handleRowClick = useCallback(
    (dimension: string, row: AttributeRow) => {
      setModal({ dimension, value: row.value, heelHeight });
    },
    [heelHeight]
  );

  // Count JC products for display
  const jcCount = useMemo(
    () => products.filter((p) => p.year === CURRENT_YEAR && p.attrs["鞋跟高度"] === heelHeight && isOwnBrand(p)).length,
    [products, heelHeight]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6">
          {/* Title Row */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{CATEGORY_NAME}</h1>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">品类属性分析</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                {CURRENT_YEAR} vs {PREV_YEAR}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">本品</span>
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-700 text-sm font-semibold rounded-lg">
                {OWN_BRAND_DISPLAY}
              </span>
              <span className="text-xs text-gray-400">
                当前跟高 {jcCount} 款
              </span>
            </div>
          </div>

          {/* Heel Height Tabs */}
          <div className="flex gap-1 pb-3">
            {HEEL_HEIGHTS.map((h) => (
              <button
                key={h}
                onClick={() => setHeelHeight(h)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  heelHeight === h
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Legend */}
        <div className="flex items-center gap-6 mb-6 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span>{String(CURRENT_YEAR).slice(2)}年销量占比（跟高内归一化）</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">+%</span>
            <span>同比增长</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-500 font-bold">-%</span>
            <span>同比下降</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">NEW</span>
            <span>今年新出现</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">点击行查看相关商品</span>
          </div>
        </div>

        {/* Attribute Tables */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-2">
          {analysis.map((dim) => (
            <DimensionTable
              key={dim.dimension}
              analysis={dim}
              onRowClick={(row) => handleRowClick(dim.dimension, row)}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <ProductModal
          modal={modal}
          products={products}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
