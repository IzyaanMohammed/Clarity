/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        'neo': '4px 4px 0px 0px rgba(44,36,27,1)',
        'neo-sm': '2px 2px 0px 0px rgba(44,36,27,1)',
        'neo-hover': '1px 1px 0px 0px rgba(44,36,27,1)',
      },
      borderWidth: {
        '3': '3px',
      }
    },
  },
  plugins: [],
};
