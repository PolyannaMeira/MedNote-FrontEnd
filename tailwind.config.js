/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          green: '#10b981',
          blue: '#3b82f6',
        },
        light: {
          green: '#d1fae5',
          blue: '#dbeafe',
        },
        dark: {
          green: '#065f46',
          blue: '#1e40af',
        }
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}