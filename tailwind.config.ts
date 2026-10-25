import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          forest: 'var(--pc-forest)',
          green: 'var(--pc-green)',
          sage: 'var(--pc-sage)',
          sand: 'var(--pc-sand)',
          peach: 'var(--pc-peach)',
          brown: 'var(--pc-brown)',
          ink: 'var(--pc-ink)',
          muted: 'var(--pc-muted)',
          glass: 'var(--pc-glass)',
          'glass-strong': 'var(--pc-glass-strong)',
          'glass-border': 'var(--pc-glass-border)',
        },
      },
      borderRadius: {
        glass: 'var(--pc-radius)',
      },
      backdropBlur: {
        glass: 'var(--pc-blur)',
      },
      boxShadow: {
        glass: 'var(--pc-shadow)',
        highlight: 'var(--pc-highlight)',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
      },
      transitionTimingFunction: {
        paper: 'cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
}

export default config
