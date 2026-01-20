/** @type {import('tailwindcss').Config} */
<<<<<<< HEAD
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      maxWidth: {
        editor: '48rem', // Grammarly-like centered editor width
=======
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
>>>>>>> 50a93b787304291edc300f2614b23c420e8b3787
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
<<<<<<< HEAD
};
=======
}

>>>>>>> 50a93b787304291edc300f2614b23c420e8b3787

