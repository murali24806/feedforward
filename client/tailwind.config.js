/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FC8019',
          'orange-dark': '#E8720C',
          'orange-light': '#FFF3E8',
          green: '#1BA672',
          'green-dark': '#138A5C',
          'green-light': '#E8F8F2',
          dark: '#282C3F',
          gray: '#686B78',
          'gray-light': '#93959F',
          'gray-bg': '#F9F9F9',
          white: '#FFFFFF',
          red: '#E74C3C',
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Poppins"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['13px', '18px'],
        'sm': ['14px', '20px'],
        'base': ['16px', '24px'],
        'lg': ['18px', '28px'],
        'xl': ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['28px', '36px'],
        '4xl': ['34px', '42px'],
        '5xl': ['42px', '52px'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(40,44,63,0.08)',
        'card-hover': '0 4px 16px rgba(40,44,63,0.14)',
        'orange': '0 4px 14px rgba(252,128,25,0.35)',
        'green': '0 4px 14px rgba(27,166,114,0.30)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
      },
    },
  },
  plugins: [],
};
