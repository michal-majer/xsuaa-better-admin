/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        'button-enter': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%) rotate(25deg)' },
          '100%': { transform: 'translateX(200%) rotate(25deg)' },
        },
        'glow-pulse': {
          '0%, 100%': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          '50%': {
            boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.15)',
          },
        },
        'logo-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        'text-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'progress-bar': {
          '0%': { width: '0%' },
          '80%': { width: '95%' },
          '100%': { width: '100%' },
        },
        'border-progress': {
          '0%': { strokeDashoffset: '1000' },
          '80%': { strokeDashoffset: '50' },
          '100%': { strokeDashoffset: '0' },
        },
        'ripple': {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        'logo-path-1': {
          '0%, 100%': {
            transform: 'scale(1) rotate(0deg)',
            opacity: '1'
          },
          '50%': {
            transform: 'scale(1.12) rotate(-3deg)',
            opacity: '0.85'
          },
        },
        'logo-glow': {
          '0%, 100%': {
            filter: 'brightness(1)'
          },
          '50%': {
            filter: 'brightness(1.2)'
          },
        },
        'slide-up': {
          '0%': {
            transform: 'translateY(4px)',
            opacity: '0'
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1'
          },
        },
        'logo-path-2': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'logo-path-3': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        'button-enter': 'button-enter 0.6s ease-out forwards',
        'gradient-shift': 'gradient-shift 3s ease infinite',
        'shimmer': 'shimmer 1.5s ease-in-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'logo-float': 'logo-float 1.5s ease-in-out infinite',
        'text-pulse': 'text-pulse 1.5s ease-in-out infinite',
        'progress-bar': 'progress-bar 5s ease-out forwards',
        'border-progress': 'border-progress 5s ease-out forwards',
        'ripple': 'ripple 0.6s ease-out',
        'logo-path-1': 'logo-path-1 2s ease-in-out infinite',
        'logo-path-2': 'logo-path-2 1.5s ease-in-out infinite',
        'logo-path-3': 'logo-path-3 1.5s ease-in-out infinite',
        'logo-glow': 'logo-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
