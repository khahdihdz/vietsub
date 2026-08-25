import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0A0F0E',
        surface: '#11201C',
        raised: '#16241F',
        hair: '#22332D',
        ink: '#EAF2EE',
        muted: '#7E958D',
        teal: {
          DEFAULT: '#22D3B8',
          dim: '#1A8F7D',
        },
        amber: {
          DEFAULT: '#F0A63D',
          dim: '#B97C2A',
        },
        danger: '#F25C63',
        ok: '#4ADE80',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
