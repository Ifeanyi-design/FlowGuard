/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // legacy tokens kept so nothing silently breaks
        ink: '#0f1b2d',
        card: '#ffffff',
        mist: '#f3f5f9',
        // FlowGuard dark system
        obsidian: '#030712',
        carbon: '#0B0F19',
        panel: '#0E1424',
        raised: '#131C31',
        line: '#1F2937',
        'line-soft': '#26344B',
        accent: {
          DEFAULT: '#22D3EE',
          soft: '#67E8F9',
          deep: '#0891B2'
        },
        electric: '#3B82F6',
        good: '#34D399',
        warn: '#FBBF24',
        danger: '#FB7185'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03), 0 24px 48px -28px rgba(0,0,0,0.95)',
        'glow-cyan': '0 0 0 1px rgba(34,211,238,0.35), 0 0 28px -8px rgba(34,211,238,0.75)',
        'glow-emerald': '0 0 0 1px rgba(52,211,153,0.35), 0 0 28px -8px rgba(52,211,153,0.65)',
        'glow-amber': '0 0 0 1px rgba(251,191,36,0.35), 0 0 30px -8px rgba(251,191,36,0.65)',
        'glow-rose': '0 0 0 1px rgba(251,113,133,0.35), 0 0 30px -8px rgba(251,113,133,0.65)',
        'inner-soft': 'inset 0 1px 0 0 rgba(255,255,255,0.05)'
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.65' },
          '70%': { transform: 'scale(1.7)', opacity: '0' },
          '100%': { transform: 'scale(1.7)', opacity: '0' }
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        sheen: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' }
        }
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up': 'fade-up 260ms ease-out both',
        'spin-slow': 'spin 1s linear infinite',
        sheen: 'sheen 2.6s ease-in-out infinite'
      },
      transitionDuration: {
        DEFAULT: '200ms'
      }
    }
  },
  plugins: []
};
