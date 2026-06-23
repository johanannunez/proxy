import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header/SiteHeader";
import DarkFooter from "@/components/DarkFooter";
import { BLOG_POSTS, getPostBySlug } from "@/data/blog-posts";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords,
    openGraph: {
      title: `Proxy | ${post.title}`,
      description: post.excerpt,
      type: "article",
      publishedTime: new Date(post.date).toISOString(),
      images: [{ url: post.image, width: 1200, height: 630 }],
      section: post.category,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.image],
    },
    alternates: {
      canonical: `https://www.myproxyhost.com/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.image,
    datePublished: new Date(post.date).toISOString(),
    dateModified: new Date(post.date).toISOString(),
    author: {
      "@type": "Organization",
      name: "Proxy",
      url: "https://www.myproxyhost.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Proxy",
      url: "https://www.myproxyhost.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.myproxyhost.com/brand/logo-mark-v2.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.myproxyhost.com/blog/${slug}`,
    },
    keywords: post.keywords.join(", "),
    articleSection: post.category,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.myproxyhost.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Journal",
        item: "https://www.myproxyhost.com/blog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `https://www.myproxyhost.com/blog/${slug}`,
      },
    ],
  };

  // Find related posts (same category, excluding current)
  const relatedPosts = BLOG_POSTS.filter(
    (p) => p.category === post.category && p.slug !== post.slug
  ).slice(0, 2);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-surface pt-[120px] pb-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([articleSchema, breadcrumbSchema]),
          }}
        />
        <article className="mx-auto max-w-[720px] px-6">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-sm text-text-tertiary"
          >
            <Link href="/" className="hover:text-brand">
              Home
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-brand">
              Journal
            </Link>
            <span>/</span>
            <span className="text-text-secondary">{post.category}</span>
          </nav>

          <h1 className="mt-6 text-3xl font-bold leading-tight text-text-primary md:text-4xl">
            {post.title}
          </h1>

          <div className="mt-4 flex items-center gap-3 text-sm text-text-tertiary">
            <span className="font-semibold uppercase tracking-wider text-brand text-xs">
              {post.category}
            </span>
            <span className="h-1 w-1 rounded-full bg-warm-gray-400" />
            <time>{post.date}</time>
            <span className="h-1 w-1 rounded-full bg-warm-gray-400" />
            <span>{post.readTime}</span>
          </div>

          <div className="relative mt-8 aspect-[2/1] overflow-hidden rounded-[var(--radius-md)]">
            <Image
              src={post.image}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
              priority
            />
          </div>

          <div className="prose prose-lg mt-10 max-w-none text-text-secondary">
            {post.body.split("\n\n").map((block, i) => {
              if (block.startsWith("## ")) {
                return (
                  <h2
                    key={i}
                    className="mt-8 mb-3 text-xl font-bold text-text-primary"
                  >
                    {block.replace("## ", "")}
                  </h2>
                );
              }
              if (block === "---") {
                return (
                  <hr key={i} className="my-8 border-warm-gray-200" />
                );
              }
              // Handle inline links in markdown format [text](url)
              const parts = block.split(/(\[[^\]]+\]\([^)]+\))/g);
              return (
                <p key={i} className="mb-4 leading-relaxed">
                  {parts.map((part, j) => {
                    const linkMatch = part.match(
                      /\[([^\]]+)\]\(([^)]+)\)/
                    );
                    if (linkMatch) {
                      return (
                        <Link
                          key={j}
                          href={linkMatch[2]}
                          className="font-medium text-brand underline decoration-brand/30 hover:decoration-brand"
                        >
                          {linkMatch[1]}
                        </Link>
                      );
                    }
                    return part;
                  })}
                </p>
              );
            })}
          </div>
        </article>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <section className="mx-auto mt-16 max-w-[1280px] px-6 md:px-12 lg:px-16">
            <h2 className="text-h3 text-text-primary">Related Articles</h2>
            <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/blog/${rp.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-md)]">
                    <Image
                      src={rp.image}
                      alt={rp.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="mt-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                      {rp.category}
                    </span>
                    <h3 className="mt-1 text-lg font-semibold leading-snug text-text-primary transition-colors duration-300 group-hover:text-brand">
                      {rp.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {rp.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <DarkFooter />
    </>
  );
}
