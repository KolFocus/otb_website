"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { CATEGORY_CONFIGS } from "@/config/categories";
import type { CategoryConfig, TabValueConfig } from "@/config/categories";
import { getBrandDisplay, getBrandLogo } from "@/config/brands";
import type { Product, AttributeRow, DimensionAnalysis, ModalState } from "@/types/product";

// ─── Global Constants ─────────────────────────────────────────────────────────

const CURRENT_YEAR = 2025;
const PREV_YEAR = CURRENT_YEAR - 1;

const DEFAULT_OWN_BRAND_NICK = "jimmychoo官方旗舰店";

const CATEGORY_STORAGE_KEY = "otb_selected_category";

function getSavedConfigIndex(): number {
  try {
    const saved = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (saved) {
      const idx = CATEGORY_CONFIGS.findIndex((c) => c.name === saved);
      if (idx >= 0) return idx;
    }
  } catch {}
  return 0;
}

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

const ALL_TAB_VALUE = "所有";

function resolvedTabValues(products: Product[], config: CategoryConfig): TabValueConfig[] {
  if (!config.tabDimension) return [{ value: ALL_TAB_VALUE }];
  if (config.tabValues !== null) return config.tabValues;
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
function cleanBrandName(nick: string | null | undefined): string {
  if (!nick) return "Unknown";
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

function BrandLogo({ nick, className }: { nick: string | null | undefined; className?: string }) {
  const logoUrl = nick ? getBrandLogo(nick) : null;
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

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  products,
  initialIndex,
  config,
  selectedTab,
  excludeDimensions,
  ownBrandNick,
  onClose,
}: {
  products: Product[];
  initialIndex: number;
  config: CategoryConfig;
  selectedTab: string | null;
  excludeDimensions: string[];
  ownBrandNick: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const product = products[index];
  const own = product.brand === ownBrandNick;

  const visibleDims = useMemo(() => {
    const dims = config.tableDimensions ?? (Object.keys(product.attrs) as string[]);
    return dims.filter((d) => !excludeDimensions.includes(d));
  }, [config.tableDimensions, excludeDimensions, product.attrs]);

  const goPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIndex((i) => (i - 1 + products.length) % products.length);
  };

  const goNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIndex((i) => (i + 1) % products.length);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: "#111111",
      });

      const a = document.createElement("a");
      const brand = cleanBrandName(product.brand).replace(/\s+/g, "_");
      a.download = `${brand}-${product.itemId}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      {/* Close */}
      <button
        className="absolute top-6 right-8 text-white/40 hover:text-white text-3xl font-light z-10 transition-colors"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        ×
      </button>

      {/* Prev arrow */}
      <button
        onClick={goPrev}
        disabled={products.length <= 1}
        className="absolute left-6 text-white/30 hover:text-white text-6xl font-thin disabled:opacity-0 transition-colors leading-none z-10"
      >
        ‹
      </button>

      {/* Main content: large image + info sidebar */}
      <div
        ref={cardRef}
        className="flex items-stretch gap-0 max-h-[90vh]"
        style={{ maxWidth: "calc(100vw - 160px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Large image */}
        <div className="relative flex-1 flex items-center justify-center bg-[#111] min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.title}
            className="max-h-[90vh] max-w-full object-contain"
            crossOrigin="anonymous"
          />
          {own && (
            <span className="absolute top-0 left-0 bg-[#C5973F] text-white text-[9px] font-bold px-2 py-1 uppercase tracking-widest">
              OWN
            </span>
          )}
        </div>

        {/* Info sidebar */}
        <div className="w-64 bg-white flex-shrink-0 flex flex-col overflow-y-auto">
          <div className="p-5 flex flex-col gap-4 flex-1">
            {/* Brand + Title */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BrandLogo nick={product.brand} className="w-3 h-3 grayscale" />
                <span className="text-[11px] font-bold uppercase tracking-luxury text-black">
                  {cleanBrandName(product.brand)}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-snug">{product.title}</p>
            </div>

            {/* Price + Share */}
            <div className="flex items-baseline justify-between border-y border-gray-100 py-2.5">
              <span className="text-sm font-medium text-black tabular-nums">
                {formatPrice(product.unitPrice)}
              </span>
              <span className="text-[9px] text-gray-400 uppercase tracking-tighter">
                QTY {product.netQtyPct?.toFixed(2)}%
              </span>
            </div>

            {/* Tab info */}
            {config.tabDimension && selectedTab && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-gray-400 uppercase tracking-widest">
                  {config.tabDimension}
                </span>
                <span className="text-[9px] font-bold border border-[#1A1A1A] px-1.5 py-0.5 uppercase tracking-wider text-[#1A1A1A]">
                  {selectedTab}
                </span>
              </div>
            )}

            {/* Attribute dimensions */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {visibleDims.map((dim) => {
                const val = product.attrs[dim as keyof Product["attrs"]];
                if (!val) return null;
                return (
                  <div key={dim}>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">
                      {dim}
                    </p>
                    <p className="text-[10px] text-[#1A1A1A] font-medium leading-tight">{val}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] text-gray-400 tabular-nums">
              {index + 1} / {products.length}
            </span>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="text-[10px] uppercase tracking-widest font-bold border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white px-3 py-1.5 transition-colors disabled:opacity-30"
            >
              {downloading ? "..." : "↓ Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Next arrow */}
      <button
        onClick={goNext}
        disabled={products.length <= 1}
        className="absolute right-6 text-white/30 hover:text-white text-6xl font-thin disabled:opacity-0 transition-colors leading-none z-10"
      >
        ›
      </button>

    </div>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  ownBrandNick,
  onImageClick,
}: {
  product: Product;
  ownBrandNick: string;
  onImageClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const own = product.brand === ownBrandNick;

  return (
    <div className="flex flex-col group">
      <div
        className="relative bg-gray-50 aspect-luxury overflow-hidden cursor-zoom-in"
        onClick={() => !imgError && onImageClick()}
      >
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
        {/* Hover hint */}
        {!imgError && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/10">
            <span className="text-white text-[10px] uppercase tracking-widest font-bold bg-black/40 px-3 py-1.5">
              View
            </span>
          </div>
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
            QTY Share {product.netQtyPct?.toFixed(2)}%
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
  tabValues,
  ownBrandNick,
  onClose,
}: {
  modal: ModalState;
  products: Product[];
  config: CategoryConfig;
  tabValues: TabValueConfig[];
  ownBrandNick: string;
  onClose: () => void;
}) {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);
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

  const handleDownloadGrid = async () => {
    if (!modalContentRef.current || downloading) return;
    setDownloading(true);
    try {
      const el = modalContentRef.current;

      // 临时展开高度/滚动，确保整个网格都被捕获
      const prev = { maxHeight: el.style.maxHeight, overflow: el.style.overflow };
      el.style.maxHeight = "none";
      el.style.overflow = "visible";

      // 临时注入样式：移除文字截断，让完整文字显示在截图中
      const styleEl = document.createElement("style");
      styleEl.id = "__dl_override__";
      styleEl.textContent = `
        #__modal_dl_target__ .truncate {
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: normal !important;
        }
        #__modal_dl_target__ .line-clamp-1 {
          display: block !important;
          overflow: visible !important;
          -webkit-line-clamp: unset !important;
        }
      `;
      document.head.appendChild(styleEl);
      el.id = "__modal_dl_target__";

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: "#ffffff" });

      // 还原
      el.id = "";
      document.head.removeChild(styleEl);
      el.style.maxHeight = prev.maxHeight;
      el.style.overflow = prev.overflow;

      const a = document.createElement("a");
      const tabLabel = modal.selectedTab ? `-${modal.selectedTab}` : "";
      a.download = `${modal.dimension}-${modal.value}${tabLabel}-${year}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        ref={modalContentRef}
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
            <div className="flex gap-6" data-dl-hide="true">
              {[PREV_YEAR, CURRENT_YEAR].map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`relative pb-1.5 text-[11px] uppercase tracking-widest font-bold transition-colors ${
                    year === y
                      ? "text-[#1A1A1A] after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#C5973F]"
                      : "text-gray-400 hover:text-[#1A1A1A]"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <div className="w-[1px] h-4 bg-gray-200" data-dl-hide="true" />
            <button
              onClick={handleDownloadGrid}
              disabled={downloading || sorted.length === 0}
              className="text-[10px] uppercase tracking-widest font-bold border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white px-3 py-1.5 transition-colors disabled:opacity-30"
              data-dl-hide="true"
            >
              {downloading ? "..." : "↓ Save All"}
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-black hover:bg-gray-100 transition-colors text-2xl font-light"
              data-dl-hide="true"
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
                <ProductCard
                  key={idx}
                  product={product}
                  ownBrandNick={ownBrandNick}
                  onImageClick={() => setLightboxIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          products={sorted}
          initialIndex={lightboxIndex}
          config={config}
          selectedTab={modal.selectedTab}
          excludeDimensions={
            tabValues.find((t) => t.value === modal.selectedTab)?.excludeDimensions ?? []
          }
          ownBrandNick={ownBrandNick}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

// ─── CategoryDropdown ─────────────────────────────────────────────────────────

function CategoryDropdown({
  configIndex,
  onChange,
}: {
  configIndex: number;
  onChange: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const config = CATEGORY_CONFIGS[configIndex];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 group"
      >
        <span className="text-2xl font-light tracking-luxury-wider text-black uppercase">
          {config.name}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M1 1l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 min-w-[10rem] bg-white border border-gray-200 shadow-lg z-50">
          {CATEGORY_CONFIGS.map((c, i) => (
            <button
              key={c.name}
              onClick={() => { onChange(i); setOpen(false); }}
              className={`w-full text-left px-5 py-3 text-sm uppercase tracking-wider transition-colors ${
                i === configIndex
                  ? "text-[#C5973F] font-semibold bg-gray-50"
                  : "text-black font-medium hover:bg-gray-50"
              }`}
            >
              {i === configIndex && (
                <span className="inline-block w-2 mr-1.5 text-[#C5973F]">✓</span>
              )}
              {i !== configIndex && <span className="inline-block w-2 mr-1.5" />}
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BrandFilterDropdown ──────────────────────────────────────────────────────

function BrandFilterDropdown({
  allBrands,
  selectedBrands,
  onChange,
}: {
  allBrands: string[];
  selectedBrands: string[];
  onChange: (brands: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAll = selectedBrands.length === allBrands.length;

  const toggle = (nick: string) => {
    if (nick === DEFAULT_OWN_BRAND_NICK) return; // 本品不可取消
    if (selectedBrands.includes(nick)) {
      const next = selectedBrands.filter((b) => b !== nick);
      if (next.length > 0) onChange(next);
    } else {
      onChange([...selectedBrands, nick]);
    }
  };

  const selectNone = () => onChange([DEFAULT_OWN_BRAND_NICK]);

  const invert = () => {
    const next = allBrands.filter(
      (b) => b === DEFAULT_OWN_BRAND_NICK || !selectedBrands.includes(b)
    );
    if (next.length > 0) onChange(next);
  };

  return (
    <div ref={ref} className="relative flex flex-col items-end gap-1">
      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Brand Filter</span>
      <button
        onClick={() => setOpen(!open)}
        className={`text-xs font-bold uppercase tracking-wider border-b pb-0.5 transition-colors ${
          isAll ? "text-gray-400 border-gray-300" : "text-[#C5973F] border-[#C5973F]"
        }`}
      >
        {isAll ? "All Brands" : `${selectedBrands.length} / ${allBrands.length} Brands`}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-gray-200 shadow-xl z-50 max-h-80 overflow-y-auto">
          {/* Quick actions */}
          <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10">
            {[
              { label: "All", action: () => onChange(allBrands) },
              { label: "None", action: selectNone },
              { label: "Invert", action: invert },
            ].map(({ label, action }, i) => (
              <button
                key={label}
                onClick={action}
                className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold hover:bg-gray-50 transition-colors ${
                  i > 0 ? "border-l border-gray-100" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Brand list */}
          {allBrands.map((nick) => {
            const isOwn = nick === DEFAULT_OWN_BRAND_NICK;
            return (
              <label
                key={nick}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 ${
                  isOwn ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(nick)}
                  onChange={() => toggle(nick)}
                  disabled={isOwn}
                  className="accent-[#C5973F] cursor-pointer disabled:cursor-not-allowed"
                />
                <BrandLogo nick={nick} className="w-4 h-4 grayscale flex-shrink-0" />
                <span className="text-[11px] text-black font-medium flex-1 truncate">
                  {cleanBrandName(nick)}
                </span>
                {isOwn && (
                  <span className="text-[8px] bg-[#C5973F] text-white px-1.5 py-0.5 font-bold flex-shrink-0">
                    OWN
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DimensionTable ────────────────────────────────────────────────────────────

function DimensionTable({
  analysis,
  onRowClick,
  stickyTop,
}: {
  analysis: DimensionAnalysis;
  onRowClick: (row: AttributeRow) => void;
  stickyTop: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const maxShare = Math.max(...analysis.rows.map((r) => r.shareCurr));

  return (
    <div className="mb-12">
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ top: stickyTop }}
        className="sticky z-20 w-full flex items-baseline gap-4 py-4 border-b border-black text-left group bg-white"
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
  const [modal, setModal] = useState<ModalState | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const ownBrandNick = DEFAULT_OWN_BRAND_NICK;
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  const config = CATEGORY_CONFIGS[configIndex];

  // 动态测量全局导航栏高度，供维度标题吸顶使用
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 客户端 mount 后从 localStorage 恢复（避免 SSR hydration 不匹配）
  useEffect(() => {
    setConfigIndex(getSavedConfigIndex());
  }, []);

  // 持久化品类选择：跳过首次 mount（防止 index=0 覆盖 localStorage）
  const persistReady = useRef(false);
  useEffect(() => {
    if (!persistReady.current) { persistReady.current = true; return; }
    try { localStorage.setItem(CATEGORY_STORAGE_KEY, config.name); } catch {}
  }, [config.name]);

  // Fetch data when config changes（cancelled 标记防止旧请求覆盖新结果）
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedTab(null);
    setModal(null);
    fetch(`/data/${config.dataFile}`)
      .then((r) => r.json())
      .then((data: Product[]) => {
        if (cancelled) return;
        setProducts(data);
        setSelectedBrands(deriveBrands(data));
        setLoading(false);
      });
    return () => { cancelled = true; };
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

  const allBrands = useMemo(() => deriveBrands(products), [products]);

  const filteredProducts = useMemo(
    () =>
      selectedBrands.length === 0 || selectedBrands.length === allBrands.length
        ? products
        : products.filter((p) => selectedBrands.includes(p.brand)),
    [products, selectedBrands, allBrands.length]
  );

  // Current tab's excluded dimensions
  const currentTabConfig = useMemo(
    () => tabValues.find((t) => t.value === selectedTab) ?? { value: selectedTab ?? "" },
    [tabValues, selectedTab]
  );


  const analysis = useMemo(
    () =>
      computeAnalysis(
        filteredProducts,
        config,
        ownBrandNick,
        selectedTab,
        currentTabConfig.excludeDimensions ?? []
      ),
    [filteredProducts, config, ownBrandNick, selectedTab, currentTabConfig]
  );

  const handleRowClick = useCallback(
    (dimension: string, row: AttributeRow) => {
      setModal({ dimension, value: row.value, selectedTab });
    },
    [selectedTab]
  );

  const ownBrandCount = useMemo(() => {
    const tabKey = config.tabDimension as keyof Product["attrs"] | undefined;
    return filteredProducts.filter(
      (p) =>
        p.year === CURRENT_YEAR &&
        (!tabKey || !selectedTab || p.attrs[tabKey] === selectedTab) &&
        isOwnBrand(p, ownBrandNick)
    ).length;
  }, [filteredProducts, config, selectedTab, ownBrandNick]);

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <div ref={headerRef} className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-8">
          {/* Title Row — 与主内容使用相同的 grid 列宽，确保左右边界对齐 */}
          <div className="grid py-6 gap-16" style={{ gridTemplateColumns: "1fr 16rem" }}>
            {/* 左列：品类名 + 趋势标注 + 品牌过滤器 */}
            <div className="flex items-center gap-6 min-w-0">
              {CATEGORY_CONFIGS.length === 1 ? (
                <h1 className="text-2xl font-light tracking-luxury-wider text-black uppercase">{config.name}</h1>
              ) : (
                <CategoryDropdown configIndex={configIndex} onChange={setConfigIndex} />
              )}
              <div className="h-4 w-[1px] bg-gray-200 flex-shrink-0" />
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Trend Analysis</span>
                <span className="text-[10px] bg-[#C5973F] text-white px-2 py-0.5 font-bold tracking-tighter">
                  {CURRENT_YEAR} / {PREV_YEAR}
                </span>
              </div>
              {!loading && allBrands.length > 0 && (
                <>
                  <div className="h-4 w-[1px] bg-gray-200 flex-shrink-0" />
                  <BrandFilterDropdown
                    allBrands={allBrands}
                    selectedBrands={selectedBrands}
                    onChange={setSelectedBrands}
                  />
                </>
              )}
            </div>

            {/* 右列：本品 + 数量（宽度 = w-64，与 Legend 栏左边界严格对齐） */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Own Brand View</span>
                <span className="text-xs font-bold text-black uppercase tracking-wider">
                  {cleanBrandName(DEFAULT_OWN_BRAND_NICK)}
                </span>
              </div>
              {!loading && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Selection Size</span>
                  <span className="text-xs font-medium text-black uppercase tracking-tighter">
                    {selectedTab ? `${selectedTab} ` : ""} / {ownBrandCount} Items
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tab 切换 */}
          {!loading && (
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
      <div className="max-w-7xl mx-auto px-8 pt-0 pb-12">
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
                  stickyTop={headerHeight}
                />
              ))}
            </div>

            {/* Side Info / Legend */}
            <div className="lg:w-64 shrink-0 space-y-12 self-start sticky" style={{ top: headerHeight + 16 }}>
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
          products={filteredProducts}
          config={config}
          tabValues={tabValues}
          ownBrandNick={ownBrandNick}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
