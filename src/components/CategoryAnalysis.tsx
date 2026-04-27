"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CATEGORY_CONFIGS } from "@/config/categories";
import type { CategoryConfig, TabValueConfig } from "@/config/categories";
import type { Product, AttributeRow, DimensionAnalysis, ModalState } from "@/types/product";

// ─── Global Constants ─────────────────────────────────────────────────────────

const CURRENT_YEAR = 2025;
const PREV_YEAR = CURRENT_YEAR - 1;

// 本品默认值（运行时可切换）
const DEFAULT_OWN_BRAND_NICK = "jimmychoo官方旗舰店";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOwnBrand(product: Product, ownBrandNick: string) {
  return product.brand === ownBrandNick;
}

/** 从商品数据中提取所有品牌列表（按首次出现顺序） */
function deriveBrands(products: Product[]): string[] {
  const seen = new Set<string>();
  const brands: string[] = [];
  products.forEach((p) => {
    if (!seen.has(p.brand)) {
      seen.add(p.brand);
      brands.push(p.brand);
    }
  });
  return brands.sort();
}

function resolvedTabValues(products: Product[], config: CategoryConfig): TabValueConfig[] {
  if (config.tabValues !== null) return config.tabValues;
  if (!config.tabDimension) return [];
  const key = config.tabDimension as keyof Product["attrs"];
  const vals = new Set<string>();
  products.forEach((p) => { const v = p.attrs[key]; if (v) vals.add(v); });
  return Array.from(vals).map((v) => ({ value: v }));
}

function resolvedTableDimensions(
  products: Product[],
  config: CategoryConfig,
  excludeDims: string[]
): string[] {
  let dims = config.tableDimensions;
  if (dims === null) {
    const keys = new Set<string>();
    products.forEach((p) =>
      Object.keys(p.attrs).forEach((k) => {
        if (k !== config.tabDimension) keys.add(k);
      })
    );
    dims = Array.from(keys);
  }
  return dims.filter((d) => !excludeDims.includes(d));
}

// ─── Analysis computation ─────────────────────────────────────────────────────

function computeAnalysis(
  products: Product[],
  config: CategoryConfig,
  ownBrandNick: string,
  selectedTab: string | null,
  excludeDims: string[]
): DimensionAnalysis[] {
  const dims = resolvedTableDimensions(products, config, excludeDims);
  const tabKey = config.tabDimension as keyof Product["attrs"] | undefined;

  const matchTab = (p: Product) =>
    tabKey && selectedTab ? p.attrs[tabKey] === selectedTab : true;

  const pCurr = products.filter((p) => p.year === CURRENT_YEAR && matchTab(p));
  const pPrev = products.filter((p) => p.year === PREV_YEAR && matchTab(p));

  const totalCurr = pCurr.reduce((s, p) => s + (p.netQtyPct || 0), 0);
  const totalPrev = pPrev.reduce((s, p) => s + (p.netQtyPct || 0), 0);

  return dims.map((dim) => {
    const key = dim as keyof Product["attrs"];

    const vals = new Set<string>([
      ...pCurr.map((p) => p.attrs[key]).filter((v): v is string => !!v),
      ...pPrev.map((p) => p.attrs[key]).filter((v): v is string => !!v),
    ]);

    const rows: AttributeRow[] = Array.from(vals).map((value) => {
      const sumCurr = pCurr
        .filter((p) => p.attrs[key] === value)
        .reduce((s, p) => s + (p.netQtyPct || 0), 0);
      const sumPrev = pPrev
        .filter((p) => p.attrs[key] === value)
        .reduce((s, p) => s + (p.netQtyPct || 0), 0);

      const shareCurr = totalCurr > 0 ? sumCurr / totalCurr : 0;
      const sharePrev = totalPrev > 0 ? sumPrev / totalPrev : 0;

      let yoy: number | "NEW" | null = null;
      if (sharePrev === 0 && shareCurr > 0) yoy = "NEW";
      else if (sharePrev > 0) yoy = (shareCurr - sharePrev) / sharePrev;

      return {
        value,
        shareCurr,
        sharePrev,
        yoy,
        hasCompetitor: pCurr.some((p) => p.attrs[key] === value && !isOwnBrand(p, ownBrandNick)),
        hasOwnBrand: pCurr.some((p) => p.attrs[key] === value && isOwnBrand(p, ownBrandNick)),
      };
    });

    rows.sort((a, b) => b.shareCurr - a.shareCurr);
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
        <div className="h-2 rounded-full bg-amber-400" style={{ width: `${width}%` }} />
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

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  ownBrandNick,
}: {
  product: Product;
  ownBrandNick: string;
}) {
  const [imgError, setImgError] = useState(false);
  const own = product.brand === ownBrandNick;

  return (
    <div
      className={`rounded-xl overflow-hidden flex flex-col border transition-shadow hover:shadow-md ${
        own ? "border-amber-400 shadow-amber-100 shadow-sm" : "border-gray-100"
      }`}
    >
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
        {own && (
          <span className="absolute top-2 left-2 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            本品
          </span>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <p className={`text-xs font-semibold truncate ${own ? "text-amber-600" : "text-gray-500"}`}>
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

// ─── ProductModal ──────────────────────────────────────────────────────────────

function ProductModal({
  modal,
  products,
  config,
  ownBrandNick,
  onClose,
}: {
  modal: ModalState;
  products: Product[];
  config: CategoryConfig;
  ownBrandNick: string;
  onClose: () => void;
}) {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const tabKey = config.tabDimension as keyof Product["attrs"] | undefined;

  const filtered = useMemo(() => {
    const key = modal.dimension as keyof Product["attrs"];
    return products.filter(
      (p) =>
        p.year === year &&
        (!tabKey || !modal.selectedTab || p.attrs[tabKey] === modal.selectedTab) &&
        p.attrs[key] === modal.value
    );
  }, [products, modal, year, tabKey]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aOwn = isOwnBrand(a, ownBrandNick);
        const bOwn = isOwnBrand(b, ownBrandNick);
        if (aOwn && !bOwn) return -1;
        if (!aOwn && bOwn) return 1;
        return (b.netQtyPct || 0) - (a.netQtyPct || 0);
      }),
    [filtered, ownBrandNick]
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
              <span className="text-lg font-semibold text-gray-900">{modal.value}</span>
              {modal.selectedTab && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                  {modal.selectedTab}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-0.5">共 {filtered.length} 款商品</p>
          </div>
          <div className="flex items-center gap-3">
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
            <div className="text-center py-16 text-gray-400">该组合暂无商品数据</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {sorted.map((product, idx) => (
                <ProductCard key={idx} product={product} ownBrandNick={ownBrandNick} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DimensionTable ────────────────────────────────────────────────────────────

function DimensionTable({
  analysis,
  onRowClick,
}: {
  analysis: DimensionAnalysis;
  onRowClick: (row: AttributeRow) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const maxShare = Math.max(...analysis.rows.map((r) => r.shareCurr));

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left rounded-lg mb-1"
      >
        <span className={`text-gray-400 transition-transform text-xs ${expanded ? "rotate-90" : ""}`}>
          ▶
        </span>
        <span className="text-sm font-semibold text-gray-700">{analysis.dimension}</span>
        <span className="text-xs text-gray-400">{analysis.rows.length} 项</span>
      </button>

      {expanded && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left px-4 py-2 font-medium w-28">细分属性</th>
              <th className="text-left px-4 py-2 font-medium">
                {String(CURRENT_YEAR).slice(2)}年占比
              </th>
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
                  <ShareBar share={row.shareCurr} maxShare={maxShare} />
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

export default function CategoryAnalysis() {
  const [configIndex, setConfigIndex] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [ownBrandNick, setOwnBrandNick] = useState<string>(DEFAULT_OWN_BRAND_NICK);
  const [modal, setModal] = useState<ModalState | null>(null);

  const config = CATEGORY_CONFIGS[configIndex];

  // Fetch data when config changes
  useEffect(() => {
    setLoading(true);
    setSelectedTab(null);
    setModal(null);
    fetch(`/data/${config.dataFile}`)
      .then((r) => r.json())
      .then((data: Product[]) => {
        setProducts(data);
        setLoading(false);
        // 如果默认本品在新数据中存在则保留，否则重置为第一个品牌
        setOwnBrandNick((prev) => {
          const brands = deriveBrands(data);
          return brands.includes(prev) ? prev : (brands[0] ?? prev);
        });
      });
  }, [config.dataFile]);

  // Tab values resolved from config or data
  const tabValues = useMemo(
    () => resolvedTabValues(products, config),
    [products, config]
  );

  // Set default tab when tab list is ready
  useEffect(() => {
    if (tabValues.length > 0) setSelectedTab(tabValues[0].value);
    else setSelectedTab(null);
  }, [tabValues]);

  // Current tab's excluded dimensions
  const currentTabConfig = useMemo(
    () => tabValues.find((t) => t.value === selectedTab) ?? { value: selectedTab ?? "" },
    [tabValues, selectedTab]
  );

  // 品牌列表（供本品下拉选择）
  const brands = useMemo(() => deriveBrands(products), [products]);

  const analysis = useMemo(
    () =>
      computeAnalysis(
        products,
        config,
        ownBrandNick,
        selectedTab,
        currentTabConfig.excludeDimensions ?? []
      ),
    [products, config, ownBrandNick, selectedTab, currentTabConfig]
  );

  const handleRowClick = useCallback(
    (dimension: string, row: AttributeRow) => {
      setModal({ dimension, value: row.value, selectedTab });
    },
    [selectedTab]
  );

  const ownBrandCount = useMemo(() => {
    const tabKey = config.tabDimension as keyof Product["attrs"] | undefined;
    return products.filter(
      (p) =>
        p.year === CURRENT_YEAR &&
        (!tabKey || !selectedTab || p.attrs[tabKey] === selectedTab) &&
        isOwnBrand(p, ownBrandNick)
    ).length;
  }, [products, config, selectedTab, ownBrandNick]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6">
          {/* Title Row */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              {/* Category Dropdown */}
              {CATEGORY_CONFIGS.length === 1 ? (
                <h1 className="text-xl font-bold text-gray-900">{config.name}</h1>
              ) : (
                <select
                  value={configIndex}
                  onChange={(e) => setConfigIndex(Number(e.target.value))}
                  className="text-xl font-bold text-gray-900 bg-transparent border-b-2 border-gray-300 focus:border-amber-400 outline-none cursor-pointer pb-0.5"
                >
                  {CATEGORY_CONFIGS.map((c, i) => (
                    <option key={c.name} value={i}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">品类属性分析</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                {CURRENT_YEAR} vs {PREV_YEAR}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">本品</span>
              {!loading && brands.length > 0 ? (
                <select
                  value={ownBrandNick}
                  onChange={(e) => setOwnBrandNick(e.target.value)}
                  className="px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-700 text-sm font-semibold rounded-lg outline-none cursor-pointer max-w-[180px] truncate"
                >
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-700 text-sm font-semibold rounded-lg">
                  —
                </span>
              )}
              {!loading && (
                <span className="text-xs text-gray-400">
                  {selectedTab ? `${selectedTab} ` : ""}共 {ownBrandCount} 款
                </span>
              )}
            </div>
          </div>

          {/* Tab 切换 */}
          {!loading && tabValues.length > 0 && (
            <div className="flex gap-1 pb-3">
              {tabValues.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSelectedTab(t.value)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedTab === t.value
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {t.value}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-gray-400">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">加载数据中…</p>
            </div>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex items-center gap-6 mb-6 text-xs text-gray-400 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <span>
                  {String(CURRENT_YEAR).slice(2)}年销量占比
                  {config.tabDimension ? `（${config.tabDimension}内归一化）` : ""}
                </span>
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
                <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">
                  NEW
                </span>
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
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ProductModal
          modal={modal}
          products={products}
          config={config}
          ownBrandNick={ownBrandNick}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
