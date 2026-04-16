/** @type {import('tailwindcss').Config} */
import 'dotenv/config';

const themeColor = process.env.THEME_COLOR || '#2563eb';

function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/**/*.{html,svg}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1a1a2e',
          strong: '#0f0f1a',
          normal: '#3d3d5c',
          soft: '#6b6b8a',
          faint: '#9090a8',
        },
        surface: {
          DEFAULT: '#f8f9fa',
          raised: '#ffffff',
          muted: '#eef1f3',
          recessed: '#e4e7eb',
        },
        accent: {
          DEFAULT: themeColor,
          strong: adjustBrightness(themeColor, -15),
          subtle: adjustBrightness(themeColor, 85),
          glow: adjustBrightness(themeColor, 40),
          muted: adjustBrightness(themeColor, -5),
        },
        line: {
          soft: 'rgba(26, 26, 46, 0.08)',
          medium: 'rgba(26, 26, 46, 0.15)',
          strong: 'rgba(26, 26, 46, 0.25)',
        },
      },
      fontFamily: {
        display: [
          'Cormorant Garamond',
          'Georgia',
          'Cambria',
          'Noto Serif SC',
          'serif'
        ],
        body: [
          'DM Sans',
          'Plus Jakarta Sans',
          'Source Han Sans SC',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Monaco',
          'Consolas',
          'monospace'
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1' }],
        'display-xl': ['clamp(3.5rem, 10vw, 8rem)', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(2.5rem, 6vw, 5rem)', { lineHeight: '1', letterSpacing: '-0.025em' }],
        'display-md': ['clamp(2rem, 4vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-sm': ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
      },
      boxShadow: {
        'warm': '0 4px 24px -2px rgba(26, 26, 46, 0.06), 0 2px 8px -2px rgba(26, 26, 46, 0.04)',
        'warm-lg': '0 12px 48px -8px rgba(26, 26, 46, 0.1), 0 4px 16px -4px rgba(26, 26, 46, 0.06)',
        'warm-xl': '0 24px 64px -12px rgba(26, 26, 46, 0.14), 0 8px 24px -8px rgba(26, 26, 46, 0.08)',
        'inner-warm': 'inset 0 2px 4px 0 rgba(26, 26, 46, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out both',
        'fade-in-up': 'fadeInUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-scale': 'fadeInScale 0.5s ease-out both',
        'slide-in-left': 'slideInLeft 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slideInRight 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'line-expand': 'lineExpand 1s cubic-bezier(0.22, 1, 0.36, 1) both',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        lineExpand: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        enterprise: {
          'primary': themeColor,
          'secondary': '#1a1a2e',
          'accent': adjustBrightness(themeColor, -5),
          'neutral': '#f8f9fa',
          'base-100': '#ffffff',
          'base-200': '#eef1f3',
          'base-300': '#e4e7eb',
          'base-content': '#1a1a2e',
          'info': adjustBrightness(themeColor, -5),
          'success': '#10b981',
          'warning': '#f59e0b',
          'error': '#ef4444',
        },
      },
    ],
  },
};
