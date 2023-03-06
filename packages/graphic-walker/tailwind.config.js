module.exports = {
  content: [
    "./src/**/*.tsx"
  ],
  theme: {
    minWidth: {
      '96': '96px'
    },
    extend: {},
  },
  darkMode: 'class', // or 'media' or 'class
  variants: {
    extend: {
      'backgroundColor': ['disabled']
    },
  },
  plugins: [],
}
