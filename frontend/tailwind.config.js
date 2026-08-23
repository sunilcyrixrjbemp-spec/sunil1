/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Canvas & Surface ───────────────────────────────
        canvas:  '#FAFAF9',       // surface-50 page bg
        surface: {
          DEFAULT: '#FFFFFF',     // surface-0 card bg
          0:       '#FFFFFF',
          50:      '#FAFAF9',
          100:     '#F4F3F1',     // surface-100 sunken bg
          sunken:  '#F4F3F1',
        },

        // ─── Ink (Text) ─────────────────────────────────────
        ink: {
          900: '#12151A',
          700: '#3A3F47',
          500: '#6B7280',
          300: '#A9AFB8',
        },

        // ─── Borders / Lines ────────────────────────────────
        line: '#E7E5E1',
        'line-strong': '#D4D1CB',
        border: {
          DEFAULT: '#E7E5E1',
          hover:   '#D4D1CB',
        },

        // ─── Brand Accent — Ledger Indigo (#4338CA) ─────────
        accent: {
          50:  '#EEF0FF',        // accent-subtle
          100: '#DEE1FF',
          400: '#6366F1',
          500: '#4F46E5',
          600: '#4338CA',        // PRIMARY ACTION ACCENT
          700: '#362FA0',        // hover / pressed
          800: '#2E2882',
          900: '#1E1B4B',
          subtle: '#EEF0FF',
          hover:  '#362FA0',
        },

        'cyrix-header': '#4A6A8A',
        // ─── Legacy primary alias (mapped to accent-600) ────
        primary: {
          50:  '#EEF0FF',
          100: '#DEE1FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#6366F1',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#362FA0',
          800: '#2E2882',
          900: '#1E1B4B',
        },

        // ─── Status — Semantics locked, hex refined ────────
        approved: {
          DEFAULT: '#0F7A4C',
          text:   '#0F7A4C',
          bg:     '#EBF7F1',
          border: '#C9EBDA',
        },
        pending: {
          DEFAULT: '#B7791F',
          text:   '#B7791F',
          bg:     '#FCF6EB',
          border: '#F1E1BC',
        },
        rejected: {
          DEFAULT: '#B3261E',
          text:   '#B3261E',
          bg:     '#FBEEEC',
          border: '#F0CFC9',
        },
        draft: {
          DEFAULT: '#6B7280',
          text:   '#6B7280',
          bg:     '#F4F3F1',
          border: '#E7E5E1',
        },
        escalated: {
          DEFAULT: '#7C3AED',
          text:   '#7C3AED',
          bg:     '#F3EEFD',
          border: '#DECBFA',
        },

        // ─── Semantic aliases (kept for AntD compat) ────────
        success: {
          DEFAULT: '#0F7A4C',
          50:  '#EBF7F1',
          100: '#C9EBDA',
          600: '#0F7A4C',
          700: '#0B5C39',
        },
        warning: {
          DEFAULT: '#B7791F',
          50:  '#FCF6EB',
          100: '#F1E1BC',
          600: '#B7791F',
          700: '#926017',
        },
        error: {
          DEFAULT: '#B3261E',
          50:  '#FBEEEC',
          100: '#F0CFC9',
          600: '#B3261E',
          700: '#8C1D18',
        },

        // ─── Data-viz categorical palette ───────────────────
        chart: {
          indigo:  '#4338CA',
          green:   '#0F7A4C',
          amber:   '#B7791F',
          violet:  '#7C3AED',
          cyan:    '#0E7490',
          red:     '#B3261E',
        },

        // ─── Legacy navy (kept for sidebar/gradients) ───────
        navy: {
          50:  '#EEF0FF',
          100: '#DEE1FF',
          500: '#4338CA',
          800: '#2E2882',
          900: '#1E1B4B',
        },
      },

      // ─── Typography ───────────────────────────────────────
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Inter Tight"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'JetBrains Mono', 'Consolas', 'monospace'],
      },

      // ─── Type Scale ───────────────────────────────────────
      fontSize: {
        '2xs': ['11px', { lineHeight: '14px' }],
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['14px', { lineHeight: '20px' }],
        base:  ['16px', { lineHeight: '24px' }],
        lg:    ['20px', { lineHeight: '28px' }],
        xl:    ['22px', { lineHeight: '28px' }],
        '2xl': ['28px', { lineHeight: '32px' }],
        '3xl': ['36px', { lineHeight: '40px' }],
        '4xl': ['48px', { lineHeight: '52px' }],
      },

      // ─── Spacing (keep 8px rhythm) ────────────────────────
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
      },

      // ─── Border Radius ────────────────────────────────────
      borderRadius: {
        sm:   '4px',
        md:   '8px',
        lg:   '10px',
        xl:   '14px',
        '2xl':'20px',
        '3xl':'24px',
        pill: '9999px',
        full: '9999px',
      },

      // ─── Elevation ────────────────────────────────────────
      boxShadow: {
        none:  'none',
        xs:    '0 1px 2px rgba(18,21,26,0.05)',
        sm:    '0 1px 3px rgba(18,21,26,0.08)',
        md:    '0 4px 12px -2px rgba(18,21,26,0.12)',
        lg:    '0 12px 24px -4px rgba(18,21,26,0.15)',
        focus: '0 0 0 2px #FAFAF9, 0 0 0 4px #4338CA',
      },

      // ─── Keyframes & Animations ───────────────────────────
      keyframes: {
        // Existing — preserved, just cleaned up timings
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-up': {
          '0%':   { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        'slide-in-left': {
          '0%':   { transform: 'translateX(-16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        'slide-in-up': {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        // Shimmer — extends to skeleton-shimmer site-wide
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        // Count-up: used for KPI hero numbers on first mount
        'count-up': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Toast progress bar
        'progress-drain': {
          '0%':   { width: '100%' },
          '100%': { width: '0%' },
        },
        // Approval confirm pulse
        'confirm-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':       { transform: 'scale(1.04)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-5px)' },
          '40%, 80%': { transform: 'translateX(5px)' },
        },
        spin: {
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        // Page / component entrances (120–160ms per §7)
        'fade-in-up':    'fade-in-up 0.15s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in':       'fade-in 0.12s ease-out forwards',
        'scale-up':      'scale-up 0.15s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in-right':'slide-in-right 0.15s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in-left': 'slide-in-left 0.15s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in-up':   'slide-in-up 0.22s cubic-bezier(0.16,1,0.3,1) forwards',
        // Skeleton shimmer — site-wide
        shimmer:         'shimmer 1.6s linear infinite',
        // KPI count-up — first mount only
        'count-up':      'count-up 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        // Toast drain
        'progress-drain':'progress-drain 4s linear forwards',
        // Approval confirm
        'confirm-pulse': 'confirm-pulse 0.2s ease-in-out',
        shake:           'shake 0.35s ease-in-out',
        spin:            'spin 0.6s linear infinite',
      },
    },
  },
  plugins: [],
}
