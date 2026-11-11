/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#175747',
        'primary-hover': '#104033',
        'background-light': '#F3F4F6',
        'background-dark': '#111827',
        'surface-light': '#FFFFFF',
        'surface-dark': '#1F2937',
        'text-light': '#111827',
        'text-dark': '#F9FAFB',
        'text-muted-light': '#4B5563',
        'text-muted-dark': '#9CA3AF',
        // Tokens del auto-diagnóstico (valores OKLCH en src/styles/diagnostico.css)
        dg: {
          canvas: 'oklch(var(--dg-canvas) / <alpha-value>)',
          surface: 'oklch(var(--dg-surface) / <alpha-value>)',
          sunken: 'oklch(var(--dg-sunken) / <alpha-value>)',
          line: 'oklch(var(--dg-line) / <alpha-value>)',
          control: 'oklch(var(--dg-control) / <alpha-value>)',
          ink: 'oklch(var(--dg-ink) / <alpha-value>)',
          muted: 'oklch(var(--dg-muted) / <alpha-value>)',
          brand: 'oklch(var(--dg-brand) / <alpha-value>)',
          'brand-strong': 'oklch(var(--dg-brand-strong) / <alpha-value>)',
          'brand-soft': 'oklch(var(--dg-brand-soft) / <alpha-value>)',
          'on-brand': 'oklch(var(--dg-on-brand) / <alpha-value>)',
          accent: 'oklch(var(--dg-accent) / <alpha-value>)',
          danger: 'oklch(var(--dg-danger) / <alpha-value>)',
          'danger-soft': 'oklch(var(--dg-danger-soft) / <alpha-value>)',
          hero: 'oklch(var(--dg-hero) / <alpha-value>)',
          'on-hero': 'oklch(var(--dg-on-hero) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right': {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'fade-in-left': 'fade-in-left 0.6s ease-out forwards',
        'fade-in-right': 'fade-in-right 0.6s ease-out forwards',
        'scale-in': 'scale-in 0.5s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        'gradient-shift': 'gradient-shift 4s ease infinite',
      },
    },
  },
  plugins: [],
};
