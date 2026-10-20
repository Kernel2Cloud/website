import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().max(70, 'keep titles under ~60 chars so they are not cut off in search results'),
    description: z.string().min(50).max(170),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Kernel2Cloud team'),
    tags: z.array(z.string()).default([]),
    // path under /public (e.g. /blog/my-post.png), 1200x630; falls back to the site image
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    // drafts show in `astro dev` only
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
