import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3ecf8e',
          dark:    '#2ea87a',
        },
      },
    },
  },
  plugins: [],
}

export default config
