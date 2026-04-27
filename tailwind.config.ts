import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 品牌核心色
        brand: {
          black: "#1A1A1A",
          white: "#FFFFFF",
          gold: "#C5973F",         // Brand Gold — 品牌香槟金，唯一彩色，极度克制使用
          "gold-light": "#EFE0C0", // 金色的极浅底色，用于背景/hover
          "gold-muted": "#8C6B28", // 金色加深版，用于小字
          divider: "#E8E4DF",      // 暖米灰分割线
          gray: {
            50:  "#F9F8F6",  // 极浅暖白，页面背景
            100: "#F2F0EC",  // 轻暖灰，card/hover
            200: "#E8E4DF",  // 分割线
            400: "#9A9489",  // 辅助标签文字
            600: "#5A5A5A",  // 正文次要信息
            900: "#1A1A1A",  // 主色近黑
          }
        }
      },
      fontFamily: {
        // 模拟 Franklin Gothic (无衬线)
        sans: ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        // 模拟 Life (衬线)
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      letterSpacing: {
        'luxury': '0.15em',
        'luxury-wider': '0.25em',
      },
      aspectRatio: {
        'luxury': '3 / 4',
      }
    },
  },
  plugins: [],
};
export default config;
