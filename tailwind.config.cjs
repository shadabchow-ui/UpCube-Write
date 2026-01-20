/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './*.{js,ts,jsx,tsx}',      // root files (your project)
    './**/*.{js,ts,jsx,tsx}',   // any future folders you add
  ],
  theme: {
    extend: {
      maxWidth: {
        editor: '48rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        app: '#f7f8fa',
        surface: '#ffffff',
        ink: '#111827',
        muted: '#6b7280',
        line: '#e5e7eb',
        focus: 'rgba(59,130,246,0.25)',
      },
      borderRadius: {
        xl: '14px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 1px rgba(16, 24, 40, 0.04)',
      },
    },
  },
  plugins: [],
}


