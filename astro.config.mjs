import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.kernel2cloud.ai',
  trailingSlash: 'always',
  markdown: { shikiConfig: { theme: 'github-light' } },
  integrations: [sitemap()],
});
