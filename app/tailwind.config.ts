import type { Config } from 'tailwindcss'
import preset from '../shared/tailwind-preset'

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../shared/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
}

export default config
