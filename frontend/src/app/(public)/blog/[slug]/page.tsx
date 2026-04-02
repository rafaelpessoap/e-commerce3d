import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api-client';
import { EmptyState } from '@/components/shared/empty-state';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data } = await api.get(`/blog/${slug}`);
    return {
      title: data.data.title,
      description: data.data.excerpt ?? data.data.title,
    };
  } catch {
    return { title: 'Post' };
  }
}

async function getPost(slug: string) {
  try {
    const { data } = await api.get(`/blog/${slug}`);
    return data.data;
  } catch {
    return null;
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Post não encontrado" description="O post que você procura não existe." />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao blog
      </Link>

      {post.coverImage && (
        <div className="relative aspect-[2/1] overflow-hidden rounded-lg mb-8 bg-muted">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      <h1 className="text-3xl sm:text-4xl font-bold mb-4">{post.title}</h1>

      <p className="text-sm text-muted-foreground mb-8">
        {post.publishedAt
          ? new Date(post.publishedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })
          : ''}
      </p>

      <div
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
