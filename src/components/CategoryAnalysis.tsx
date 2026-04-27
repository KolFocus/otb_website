"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CATEGORY_CONFIGS } from "@/config/categories";
import type { CategoryConfig, TabValueConfig } from "@/config/categories";
import { getBrandDisplay, getBrandLogo } from "@/config/brands";
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
  if (yoy === "NEW") return { text: "NEW", color: "text-black", badge: true };
  const pct = (yoy * 100).toFixed(0);
  if (yoy > 0) return { text: `+${pct}%`, color: "text-black" };
  if (yoy < 0) return { text: `${pct}%`, color: "text-gray-400" };
  return { text: "0%", color: "text-gray-400" };
}

function formatPrice(val: number) {
  return "¥" + val.toLocaleString("zh-CN");
}

/** 品牌展示名：先查预制表，查不到再用正则降级 */
function cleanBrandName(nick: string): string {
  const preset = getBrandDisplay(nick);
  if (preset) return preset;
  return nick
    .replace(/^d\]/, "")
    .replace(/官方旗舰店$/, "")
    .replace(/旗舰店$/, "")
    .replace(/官方海外旗$/, "")
    .replace(/[_]\d+$/, "")
    .trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function YoyBadge({ yoy }: { yoy: number | "NEW" | null }) {
  const { text, color, badge } = formatYoy(yoy);
  if (badge) {
    return (
      <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold border border-black text-black uppercase tracking-wider">
        NEW
      </span>
    );
  }
  return <span className={`text-xs font-medium tracking-wide ${color}`}>{text}</span>;
}

function ShareBar({ share, maxShare }: { share: number; maxShare: number }) {
  const width = maxShare > 0 ? (share / maxShare) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 h-[2px] min-w-[60px]">
        <div className="h-[2px] bg-[#C5973F]" style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs text-[#1A1A1A] font-medium w-10 text-right tabular-nums">
        {formatPct(share)}
      </span>
    </div>
  );
}

function CheckMark({ has, isOwn }: { has: boolean; isOwn?: boolean }) {
  if (!has) return <span className="text-gray-200 text-xs">/</span>;
  if (isOwn) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 bg-[#C5973F] text-white text-[9px] font-bold tracking-tight">
        JC
      </span>
    );
  }
  return <span className="text-[#1A1A1A] font-bold text-xs">●</span>;
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function BrandLogo({ nick, className }: { nick: string; className?: string }) {
  const logoUrl = getBrandLogo(nick);
  const display = cleanBrandName(nick);
  const initials = display
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const [logoError, setLogoError] = useState(false);

  if (logoUrl && !logoError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={display}
        className={`object-contain grayscale ${className ?? ""}`}
        onError={() => setLogoError(true)}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center bg-gray-100 text-gray-500 font-bold text-[10px] select-none ${className ?? ""}`}
    >
      {initials}
    </span>
  );
}

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
    <div className="flex flex-col group cursor-pointer">
      <div className="relative bg-gray-50 aspect-luxury overflow-hidden">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px] uppercase tracking-widest">
            No Image
          </div>
        )}
        {own && (
          <span className="absolute top-0 left-0 bg-[#C5973F] text-white text-[9px] font-bold px-2 py-1 uppercase tracking-widest">
            OWN
          </span>
        )}
      </div>

      <div className="pt-3 pb-2 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BrandLogo nick={product.brand} className="w-3 h-3 grayscale opacity-80" />
          <p className="text-[10px] font-bold uppercase tracking-luxury text-black truncate">
            {cleanBrandName(product.brand)}
          </p>
        </div>
        <p className="text-[11px] text-gray-500 line-clamp-1 leading-tight uppercase tracking-tight">
          {product.title}
        </p>
        <div className="flex items-baseline justify-between mt-0.5 border-t border-gray-100 pt-1.5">
          <span className="text-xs font-medium text-black tabular-nums">
            {formatPrice(product.unitPrice)}
          </span>
          <span className="text-[9px] text-gray-400 uppercase tracking-tighter">
            Share {product.netQtyPct?.toFixed(2)}%
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
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="bg-white shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
          <div>
            <div className="flex items-baseline gap-4">
              <span className="text-[10px] text-gray-400 uppercase tracking-luxury-wider font-semibold">
                {modal.dimension}
              </span>
              <h2 className="text-2xl font-light text-black uppercase tracking-wider">{modal.value}</h2>
              {modal.selectedTab && (
                <span className="border border-black px-2 py-0.5 text-black text-[10px] uppercase tracking-widest font-bold">
                  {modal.selectedTab}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-tighter">Total {filtered.length} Items</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex border border-[#1A1A1A]">
              {[PREV_YEAR, CURRENT_YEAR].map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-5 py-1.5 text-[11px] uppercase tracking-widest font-bold transition-colors ${
                    year === y
                      ? "bg-[#C5973F] text-white border-[#C5973F]"
                      : "bg-white text-[#1A1A1A] hover:bg-gray-50"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-black hover:bg-gray-100 transition-colors text-2xl font-light"
            >
              ×
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <div className="overflow-y-auto p-8 bg-white">
          {sorted.length === 0 ? (
            <div className="text-center py-24 text-gray-300 uppercase tracking-widest text-sm">No items found for this combination</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
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
    <div className="mb-12">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-baseline gap-4 py-4 border-b border-black text-left group"
      >
        <span className="text-[11px] font-bold text-[#C5973F] tracking-widest shrink-0">
          {String(analysis.rows.length).padStart(2, "0")} /
        </span>
        <h3 className="text-xl font-light text-[#1A1A1A] tracking-wider uppercase">{analysis.dimension}</h3>
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{analysis.rows.length} ATTRIBUTES</span>
        <span className="ml-auto text-[#1A1A1A] font-light text-xl transition-transform duration-300" style={{ transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)' }}>
          +
        </span>
      </button>

      {expanded && (
        <div className="overflow-x-auto mt-4">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-gray-400 border-b border-gray-100 uppercase tracking-luxury font-semibold">
                <th className="text-left py-4 font-semibold w-1/4">Attribute</th>
                <th className="text-left py-4 font-semibold">Market Share & Trend</th>
                <th className="text-right py-4 font-semibold w-24">YOY</th>
                <th className="text-center py-4 font-semibold w-16">Comp</th>
                <th className="text-center py-4 font-semibold w-16">Own</th>
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map((row) => (
                <tr
                  key={row.value}
                  onClick={() => onRowClick(row)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <td className="py-5 pr-4">
                    <span className="text-sm text-black font-medium tracking-wide group-hover:underline">
                      {row.value}
                    </span>
                  </td>
                  <td className="py-5">
                    <ShareBar share={row.shareCurr} maxShare={maxShare} />
                  </td>
                  <td className="py-5 text-right">
                    <YoyBadge yoy={row.yoy} />
                  </td>
                  <td className="py-5 text-center">
                    <CheckMark has={row.hasCompetitor} />
                  </td>
                  <td className="py-5 text-center">
                    <CheckMark has={row.hasOwnBrand} isOwn />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-8">
          {/* Title Row */}
          <div className="flex items-center justify-between py-6">
            <div className="flex items-baseline gap-6">
              {/* Category Dropdown */}
              {CATEGORY_CONFIGS.length === 1 ? (
                <h1 className="text-2xl font-light tracking-luxury-wider text-black">{config.name}</h1>
              ) : (
                <select
                  value={configIndex}
                  onChange={(e) => setConfigIndex(Number(e.target.value))}
                  className="text-2xl font-light tracking-luxury-wider text-black bg-transparent outline-none cursor-pointer border-b border-transparent hover:border-black transition-colors py-1 uppercase"
                >
                  {CATEGORY_CONFIGS.map((c, i) => (
                    <option key={c.name} value={i}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="h-4 w-[1px] bg-gray-200" />
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Trend Analysis</span>
                <span className="text-[10px] bg-[#C5973F] text-white px-2 py-0.5 font-bold tracking-tighter">
                  {CURRENT_YEAR} / {PREV_YEAR}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end gap-1">
                <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Own Brand View</span>
                {!loading && brands.length > 0 ? (
                  <select
                    value={ownBrandNick}
                    onChange={(e) => setOwnBrandNick(e.target.value)}
                    className="text-xs font-bold text-black uppercase tracking-wider outline-none cursor-pointer border-b border-black pb-0.5 bg-transparent"
                  >
                    {brands.map((b) => (
                      <option key={b} value={b}>
                        {cleanBrandName(b)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-black uppercase tracking-wider">—</span>
                )}
              </div>
              {!loading && (
                <div className="border-l border-gray-100 pl-6 flex flex-col items-end gap-1">
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Selection Size</span>
                  <span className="text-xs font-medium text-black uppercase tracking-tighter">
                    {selectedTab ? `${selectedTab} ` : ""} / {ownBrandCount} Items
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tab 切换 */}
          {!loading && tabValues.length > 0 && (
            <div className="flex gap-10 pb-4">
              {tabValues.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSelectedTab(t.value)}
                  className={`text-[11px] font-bold uppercase tracking-luxury transition-all relative pb-2 ${
                    selectedTab === t.value
                      ? "text-black after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#C5973F]"
                      : "text-gray-400 hover:text-black"
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
      <div className="max-w-7xl mx-auto px-8 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-48 text-gray-300">
            <div className="text-center">
              <div className="w-10 h-10 border-t-2 border-black rounded-full animate-spin mx-auto mb-6" />
              <p className="text-xs uppercase tracking-luxury-wider font-medium">Synchronizing Data...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-16">
            {/* Analysis Tables */}
            <div className="flex-1 max-w-4xl">
              {analysis.map((dim) => (
                <DimensionTable
                  key={dim.dimension}
                  analysis={dim}
                  onRowClick={(row) => handleRowClick(dim.dimension, row)}
                />
              ))}
            </div>

            {/* Side Info / Legend */}
            <div className="lg:w-64 shrink-0 space-y-12">
              <section>
                <h4 className="text-[11px] text-black font-bold uppercase tracking-luxury mb-6 border-b border-gray-100 pb-2">Legend</h4>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-[2px] bg-[#C5973F]" />
                      <span className="text-[10px] text-black font-bold uppercase tracking-wider">{CURRENT_YEAR} Share</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed italic">
                      Normalized within current {config.tabDimension || 'category'}.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-1.5 py-0.5 border border-black text-black text-[9px] font-bold tracking-widest uppercase">NEW</span>
                      <span className="text-[10px] text-black font-bold uppercase tracking-wider">Arrivals</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-[#C5973F] text-white text-[9px] font-bold tracking-tight">JC</span>
                      <span className="text-[10px] text-black font-bold uppercase tracking-wider">Own Brand</span>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-[11px] text-black font-bold uppercase tracking-luxury mb-4 border-b border-gray-100 pb-2">Navigation Hint</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed uppercase tracking-tighter">
                  Select any attribute row to explore current seasonal product curation.
                </p>
              </section>
            </div>
          </div>
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
