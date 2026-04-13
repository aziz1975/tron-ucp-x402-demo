/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tron: '#EB0029', // TRON Brand Red
        dark: '#111827',
        darker: '#030712'
      }
    },
  },
  plugins: [],
}
