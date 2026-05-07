/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#4F86F7',
          light: '#6B9BF8',
          dark: '#3A6EE0',
        },
        bg: {
          DEFAULT: '#0D0D0D',
          1: '#161616',
          2: '#1E1E1E',
          3: '#272727',
          4: '#303030',
          5: '#3A3A3A',
        },
        txt: {
          primary: '#FFFFFF',
          secondary: '#9B9B9B',
          muted: '#5A5A5A',
        },
        success: '#34C759',
        danger: '#FF453A',
        warn: '#FF9F0A',
      },
    },
  },
  plugins: [],
}
