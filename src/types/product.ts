export interface Product {
  year: number;
  brand: string;
  title: string;
  imageUrl: string;
  netQtyPct: number;
  netGmvPct: number;
  sortKey: number;
  unitPrice: number;
  attrs: {
    鞋子类型?: string | null;
    装饰物?: string | null;
    装饰位置?: string | null;
    图案装饰元素?: string | null;
    颜色?: string | null;
    颜色类型?: string | null;
    鞋面材质?: string | null;
    鞋头形状?: string | null;
    闭合方式?: string | null;
    鞋面绑带款式?: string | null;
    鞋跟款式?: string | null;
    鞋跟高度?: string | null;
    鞋底厚薄?: string | null;
  };
  attrDescs: Record<string, string>;
}

export interface AttributeRow {
  value: string;
  shareCurr: number;
  sharePrev: number;
  yoy: number | "NEW" | null;
  hasCompetitor: boolean;
  hasOwnBrand: boolean;
}

export interface DimensionAnalysis {
  dimension: string;
  rows: AttributeRow[];
}

export interface ModalState {
  dimension: string;
  value: string;
  selectedTab: string | null;
}
