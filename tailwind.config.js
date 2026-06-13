/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg: 'var(--bg)',
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
        },
        text: {
          DEFAULT: 'var(--text)',
          1: 'var(--text)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
          4: 'var(--text-4)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        violet: 'var(--violet)',
        sky: 'var(--sky)',
        // Static space accents (data-driven dots/badges also use inline hex)
        space: {
          infrastructure: '#6ea8fe',
          runbooks: '#5eead4',
          onboarding: '#86efac',
          incidents: '#fb87a4',
          security: '#fbbf72',
          tribal: '#b794f6',
          network: '#fb87a4',
        },
      },
      borderColor: {
        panel: 'var(--panel-border)',
      },
      backgroundImage: {
        'accent-grad': 'var(--accent-grad)',
        'panel-grad': 'var(--panel-grad)',
      },
      boxShadow: {
        panel: 'var(--panel-inset), var(--panel-shadow)',
      },
      keyframes: {
        cbUp: { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        cbSlide: { from: { transform: 'translateX(40px)' }, to: { transform: 'translateX(0)' } },
        cbSpin: { to: { transform: 'rotate(360deg)' } },
        cbOnline: { '0%,100%': { boxShadow: '0 0 0 0 rgba(94,234,212,.5)' }, '50%': { boxShadow: '0 0 0 4px rgba(94,234,212,0)' } },
        cbPulse: { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
        cbAurora: { '0%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(-3%,2%,0) scale(1.08)' }, '100%': { transform: 'translate3d(0,0,0) scale(1)' } },
      },
      animation: {
        'cb-up': 'cbUp .18s ease both',
        'cb-slide': 'cbSlide .22s ease both',
        'cb-spin': 'cbSpin .7s linear infinite',
        'cb-online': 'cbOnline 2.4s infinite',
        'cb-pulse': 'cbPulse 1.6s infinite',
        'cb-aurora': 'cbAurora 26s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
