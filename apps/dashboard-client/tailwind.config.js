/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617',
        },
        // GitHub-inspired semantic palette — light mode
        'gh-bg':          '#ffffff',
        'gh-bg-subtle':   '#f6f8fa',
        'gh-border':      '#d0d7de',
        'gh-text':        '#1f2328',
        'gh-accent':      '#0969da',
        // GitHub-inspired semantic palette — dark mode
        'gh-bg-dark':          '#0d1117',
        'gh-bg-subtle-dark':   '#161b22',
        'gh-border-dark':      '#30363d',
        'gh-text-dark':        '#e6edf3',
        'gh-accent-dark':      '#2f81f7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      keyframes: {
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'slide-down': 'slide-down 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-slow': 'fade-in 1s ease-out',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-hide::-webkit-scrollbar': {
          display: 'none',
        },
      });
    },
  ],
};
