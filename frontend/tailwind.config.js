/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f1b2d',
        card: '#ffffff',
        mist: '#f3f5f9'
      }
    }
  },
  plugins: []
};
