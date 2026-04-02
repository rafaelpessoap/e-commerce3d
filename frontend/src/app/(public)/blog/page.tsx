import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Dicas, tutoriais e novidades sobre miniaturas 3D',
};

async function getPosts() {
  try {
    const { data } = await api.get('/blog', { params: { perPage: 20 } });
    return data;
  } catch {
    return { data: [], meta: { total: 0 } };
  }
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Blog</h1>

      {posts.data.length === 0 ? (
        <p className="text-muted-foreground">Nenhum post publicado ainda.</p>
      ) : (
        <div className="space-y-8">
          {posts.data.map((post: any) => (
            <article key={post.id} className="border-b pb-8 last:border-0">
              <Link href={`/blog/${post.slug}`} className="group">
                {post.coverImage && (
                  <div className="relative aspect-[2/1] overflow-hidden rounded-lg mb-4 bg-muted">
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                      sizes="(max-width: 768px) 100vw, 768px"
                    />
                  </div>
                )}
                <h2 className="text-xl font-bold group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
              </Link>
              {post.excerpt && (
                <p className="text-muted-foreground mt-2">{post.excerpt}</p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : ''}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
