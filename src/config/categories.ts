/**
 * 品类分析配置
 *
 * 每套配置对应一个品类的数据源和展示规则。
 * 页面顶部下拉可在多套配置间切换。
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TabValueConfig {
  /** Tab 项的值，对应 tabDimension 属性的某个枚举值 */
  value: string;
  /** 该 Tab 项下需要排除的表格维度（如平底无跟高，排除"鞋跟款式"） */
  excludeDimensions?: string[];
}

export interface CategoryConfig {
  /** 品类展示名称，也作为唯一 key */
  name: string;
  /** 对应 /public/data/ 下的 JSON 文件名 */
  dataFile: string;
  /**
   * Tab 轴维度：用哪个属性字段将分析拆分为多个 Tab
   * null = 不显示 Tab，所有商品一起分析
   */
  tabDimension: string | null;
  /**
   * Tab 项列表（含各自的排除维度）
   * null = 自动从数据中推导（顺序不保证）
   */
  tabValues: TabValueConfig[] | null;
  /**
   * 分析表格展示的属性维度列表
   * null = 自动推导（attrs 中所有字段，排除 tabDimension）
   */
  tableDimensions: string[] | null;
}

// ─── Configs ──────────────────────────────────────────────────────────────────

export const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    name: "浅口单鞋",
    dataFile: "pumps-products.json",
    tabDimension: "鞋跟高度",
    tabValues: [
      { value: "平底", excludeDimensions: ["鞋跟款式"] },
      { value: "低跟" },
      { value: "中跟" },
      { value: "高跟" },
      { value: "超高跟" },
    ],
    tableDimensions: [
      "装饰物",
      "装饰位置",
      "颜色",
      "鞋面材质",
      "鞋头形状",
      "闭合方式",
      "鞋面绑带款式",
      "鞋跟款式",
    ],
  },
];
