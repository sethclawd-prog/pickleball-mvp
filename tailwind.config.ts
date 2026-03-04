import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        ink: 'var(--ink)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        warm: 'var(--warm)',
        success: 'var(--success)',
        danger: 'var(--danger)'
      },
      boxShadow: {
        card: '0 8px 30px rgba(6, 35, 38, 0.12)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
};

export default config;
