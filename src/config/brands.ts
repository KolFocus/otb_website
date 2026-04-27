/**
 * 品牌预制表
 * - nick:    店铺 seller_nick（与数据源 brand 字段完全匹配）
 * - display: UI 展示名称
 * - logoUrl: 正方形 / 单色 SVG 或 PNG logo 本地路径（null = 降级为文字首字母）
 *
 * 新增品牌：在列表末尾追加一项即可；不在列表内的 nick 会走 cleanBrandName() 正则降级。
 */

export interface BrandInfo {
  nick: string;
  display: string;
  logoUrl: string | null;
}

export const BRAND_LIST: BrandInfo[] = [
  // ── 奢侈鞋履核心品牌 ───────────────────────────────────────────────────────
  {
    nick: "jimmychoo官方旗舰店",
    display: "Jimmy Choo",
    logoUrl: `/brands/jimmychoo.png`,
  },
  {
    nick: "manoloblahnik官方旗舰店",
    display: "Manolo Blahnik",
    logoUrl: `/brands/manoloblahnik.png`,
  },
  {
    nick: "rogervivier官方旗舰店",
    display: "Roger Vivier",
    logoUrl: `/brands/rogervivier.png`,
  },
  {
    nick: "d]christianlouboutin官方旗舰店_579",
    display: "Christian Louboutin",
    logoUrl: `/brands/christianlouboutin.png`,
  },
  {
    nick: "sergiorossi旗舰店",
    display: "Sergio Rossi",
    logoUrl: `/brands/sergiorossi.png`,
  },
  {
    nick: "renecaovilla旗舰店",
    display: "René Caovilla",
    logoUrl: `/brands/renecaovilla.png`,
  },
  {
    nick: "stuartweitzman官方旗舰店",
    display: "Stuart Weitzman",
    logoUrl: null, // 下载失败或无效，降级首字母
  },

  // ── 大牌时装 ───────────────────────────────────────────────────────────────
  {
    nick: "gucci古驰官方旗舰店",
    display: "Gucci",
    logoUrl: `/brands/gucci.png`, 
  },
  {
    nick: "prada官方旗舰店",
    display: "Prada",
    logoUrl: `/brands/prada.png`,
  },
  {
    nick: "miumiu官方旗舰店",
    display: "Miu Miu",
    logoUrl: `/brands/miumiu.png`,
  },
  {
    nick: "bottegaveneta官方旗舰店",
    display: "Bottega Veneta",
    logoUrl: `/brands/bottegaveneta.png`,
  },
  {
    nick: "valentino官方旗舰店",
    display: "Valentino",
    logoUrl: `/brands/valentino.png`,
  },
  {
    nick: "versace范思哲官方旗舰店",
    display: "Versace",
    logoUrl: `/brands/versace.png`,
  },
  {
    nick: "圣罗兰官方旗舰店",
    display: "Saint Laurent",
    logoUrl: `/brands/saintlaurent.png`,
  },
  {
    nick: "ferragamo菲拉格慕官方旗舰店",
    display: "Ferragamo",
    logoUrl: `/brands/ferragamo.png`,
  },
  {
    nick: "tods官方旗舰店",
    display: "Tod's",
    logoUrl: `/brands/tods.png`,
  },
  {
    nick: "bally巴利官方旗舰店",
    display: "Bally",
    logoUrl: `/brands/bally.png`,
  },
  {
    nick: "toryburch官方旗舰店",
    display: "Tory Burch",
    logoUrl: `/brands/toryburch.png`,
  },
  {
    nick: "maisonmargiela旗舰店",
    display: "Maison Margiela",
    logoUrl: `/brands/maisonmargiela.png`,
  },
  {
    nick: "thombrowne官方旗舰店",
    display: "Thom Browne",
    logoUrl: `/brands/thombrowne.png`,
  },
  {
    nick: "toteme官方旗舰店",
    display: "Totême",
    logoUrl: `/brands/toteme.png`,
  },
  {
    nick: "lemaire官方旗舰店",
    display: "Lemaire",
    logoUrl: `/brands/lemaire.png`,
  },
  {
    nick: "ourlegacy旗舰店",
    display: "Our Legacy",
    logoUrl: `/brands/ourlegacy.png`,
  },
  {
    nick: "coscia官方旗舰店",
    display: "Coscia",
    logoUrl: `/brands/coscia.png`,
  },

  // ── 买手 / 平台 ────────────────────────────────────────────────────────────
  {
    nick: "farfetch发发奇官方海外旗",
    display: "Farfetch",
    logoUrl: `/brands/farfetch.png`,
  },
  {
    nick: "d]netaporter官方旗舰店_626",
    display: "Net-a-Porter",
    logoUrl: `/brands/netaporter.png`,
  },
  {
    nick: "it服饰旗舰店",
    display: "I.T",
    logoUrl: `/brands/it.png`,
  },
  {
    nick: "labelhood蕾虎旗舰店",
    display: "Labelhood",
    logoUrl: `/brands/labelhood.png`,
  },
  {
    nick: "shoplinq西有奥莱旗舰店",
    display: "ShopLinq",
    logoUrl: null,
  },
  {
    nick: "estate旗舰店",
    display: "Estate",
    logoUrl: null,
  },

  // ── 天猫国际 ───────────────────────────────────────────────────────────────
  {
    nick: "天猫国际时尚范",
    display: "天猫国际·时尚范",
    logoUrl: null,
  },
  {
    nick: "天猫国际欧洲直购",
    display: "天猫国际·欧洲直购",
    logoUrl: null,
  },
  {
    nick: "天猫国际进口超市",
    display: "天猫国际·进口超市",
    logoUrl: null,
  },

  // ── 其他 ───────────────────────────────────────────────────────────────────
  {
    nick: "婚礼方舟旗舰店",
    display: "婚礼方舟",
    logoUrl: null,
  },
  {
    nick: "星期六西芽专卖店",
    display: "星期六",
    logoUrl: null,
  },
  {
    nick: "珍品网旗舰店",
    display: "珍品网",
    logoUrl: null,
  },
];

/** O(1) 查询 */
export const BRAND_MAP_BY_NICK: Record<string, BrandInfo> = Object.fromEntries(
  BRAND_LIST.map((b) => [b.nick, b])
);

/** 获取品牌展示名（未找到则返回 null，交由调用方降级处理） */
export function getBrandDisplay(nick: string): string | null {
  return BRAND_MAP_BY_NICK[nick]?.display ?? null;
}

/** 获取品牌 logo URL（未找到或无 logo 则返回 null） */
export function getBrandLogo(nick: string): string | null {
  return BRAND_MAP_BY_NICK[nick]?.logoUrl ?? null;
}
