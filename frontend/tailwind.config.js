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
        canvas:  '#F8FAFC',       // surface-50 page bg
        surface: {
          DEFAULT: '#FFFFFF',     // surface-0 card bg
          0:       '#FFFFFF',
          50:      '#F8FAFC',
          100:     '#F1F5F9',     // surface-100 hover bg
          sunken:  '#F1F5F9',
        },

        // ─── Ink (Text) ─────────────────────────────────────
        ink: {
          900: '#0B0F19',
          700: '#374151',
          500: '#6B7280',
          300: '#D1D5DB',
        },

        // ─── Borders / Lines ────────────────────────────────
        line: '#E5E7EB',
        'line-strong': '#D1D5DB',
        border: {
          DEFAULT: '#E5E7EB',
          hover:   '#D1D5DB',
        },

        // ─── Brand Accent — Royal Blue Refined (#2563EB) ───
        accent: {
          50:  '#EFF6FF',        // accent-subtle
          100: '#DBEAFE',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',        // PRIMARY ACTION ACCENT
          700: '#1D4ED8',        // hover / pressed
          800: '#1E40AF',
          900: '#1E3A8A',
          subtle: '#EFF6FF',
          hover:  '#1D4ED8',
        },

        'cyrix-header': '#4A6A8A',
        // ─── Legacy primary alias (mapped to accent-600) ────
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },

        // ─── Status — Semantics locked, hex refined ────────
        approved: {
          DEFAULT: '#16A34A',
          text:   '#16A34A',
          bg:     '#F0FDF4',
          border: '#BBF7D0',
        },
        pending: {
          DEFAULT: '#D97706',
          text:   '#D97706',
          bg:     '#FFFBEB',
          border: '#FDE68A',
        },
        rejected: {
          DEFAULT: '#DC2626',
          text:   '#DC2626',
          bg:     '#FEF2F2',
          border: '#FECACA',
        },
        draft: {
          DEFAULT: '#6B7280',
          text:   '#6B7280',
          bg:     '#F3F4F6',
          border: '#E5E7EB',
        },
        escalated: {
          DEFAULT: '#7C3AED',
          text:   '#7C3AED',
          bg:     '#F3EEFD',
          border: '#DECBFA',
        },

        // ─── Semantic aliases (kept for AntD compat) ────────
        success: {
          DEFAULT: '#16A34A',
          50:  '#F0FDF4',
          100: '#BBF7D0',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          DEFAULT: '#D97706',
          50:  '#FFFBEB',
          100: '#FDE68A',
          600: '#D97706',
          700: '#B45309',
        },
        error: {
          DEFAULT: '#DC2626',
          50:  '#FEF2F2',
          100: '#FECACA',
          600: '#DC2626',
          700: '#B91C1C',
        },

        // ─── Data-viz categorical palette ───────────────────
        chart: {
          indigo:  '#2563EB',
          green:   '#16A34A',
          amber:   '#D97706',
          violet:  '#7C3AED',
          cyan:    '#0EA5E9',
          red:     '#DC2626',
        },

        // ─── Legacy navy (kept for sidebar/gradients) ───────
        navy: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          500: '#2563EB',
          800: '#1E40AF',
          900: '#0F172A',
        },
      },

      // ─── Typography ───────────────────────────────────────
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"Inter"', '"Roboto Mono"', 'monospace'],
      },

      // ─── Type Scale ───────────────────────────────────────
      fontSize: {
        '2xs': ['11px', { lineHeight: '14px' }],
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['14px', { lineHeight: '20px' }],
        base:  ['16px', { lineHeight: '24px' }],
        lg:    ['18px', { lineHeight: '28px' }],
        xl:    ['22px', { lineHeight: '28px' }],
        '2xl': ['28px', { lineHeight: '34px' }],
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
        sm:   '6px',   // inputs, badges
        md:   '10px',  // buttons
        lg:   '14px',  // cards
        xl:   '20px',  // modals
        '2xl':'24px',
        '3xl':'32px',
        pill: '9999px',
      },

      // ─── Elevation ────────────────────────────────────────
      boxShadow: {
        none:  'none',
        xs:    '0 1px 2px rgba(16,24,40,0.05)',
        sm:    '0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)',
        md:    '0 4px 8px rgba(16,24,40,0.06), 0 2px 4px rgba(16,24,40,0.04)',
        lg:    '0 12px 24px rgba(16,24,40,0.10)',
        focus: '0 0 0 2px #FFFFFF, 0 0 0 4px #2563EB',
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
