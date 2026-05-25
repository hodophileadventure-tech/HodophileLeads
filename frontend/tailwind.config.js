/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7e6',
          100: '#fff0cc',
          300: '#ffdd66',
          500: '#FCC000',
          700: '#e6a300'
        },
        neutral: {
          900: '#000000',
          800: '#0b0b0b',
          700: '#111111',
          600: '#1a1a1a'
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'float-slow': 'float 6s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 400ms ease both'
      }
    },
  },
  darkMode: 'class',
  plugins: [
    require('@tailwindcss/forms')
  ],
}
