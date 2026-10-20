import { SITE_URL } from '../consts';

export const breadcrumb = (...items: [name: string, path: string][]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [['Home', '/'], ...items].map(([name, path], i) => ({
    '@type': 'ListItem', position: i + 1, name, item: new URL(path, SITE_URL).href,
  })),
});
