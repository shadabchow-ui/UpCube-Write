/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './*.{js,ts,jsx,tsx}',          // <-- your App.tsx, Editor.tsx, main.tsx are here
    './languagetool-master/**/*.{js,ts,jsx,tsx,html}', // optional, safe to include
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
