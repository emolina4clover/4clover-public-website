import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://4clover.cl',
  integrations: [
    // global.css ya trae las directivas @tailwind; sin esto el CSS de Tailwind se publicaba dos veces.
    tailwind({ applyBaseStyles: false }),
    // Las páginas privadas (/diagnostico/...) nunca van al sitemap.
    sitemap({ filter: (page) => !page.includes('/diagnostico/') }),
  ],
  output: 'static',
});
