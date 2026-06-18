import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FrostedNav from "@/components/FrostedNav";
import DarkFooter from "@/components/DarkFooter";
import { BLOG_POSTS, BLOG_CATEGORIES } from "@/data/blog-posts";

export const metadata: Metadata = {
  title: "Journal: Vacation Rental Tips, Property Investment & Travel Guides",
  description:
    "Expert articles on vacation rental management, property investment, corporate housing, sustainable travel, and destination guides. Insights from Proxy",
  keywords: [
    "vacation rental blog",
    "property management tips",
    "vacation rental investment",
    "corporate housing guide",
    "travel destination guides",
    "short-term rental advice",
  ],
  openGraph: {
    title: "Proxy | Journal",
    description:
      "Expert articles on vacation rental management, property investment, and travel.",
    type: "website",
  },
  alternates: {
    canonical: "https://www.myproxyhost.com/blog",
  },
};

export default function BlogPage() {
  const blogListSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Proxy Journal",
    description:
      "Expert articles on vacation rental management, property investment, corporate housing, and travel guides.",
    url: "https://www.myproxyhost.com/blog",
    publisher: {
      "@type": "Organization",
      name: "Proxy",
      url: "https://www.myproxyhost.com",
    },
    blogPost: BLOG_POSTS.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      url: `https://www.myproxyhost.com/blog/${post.slug}`,
      datePublished: new Date(post.date).toISOString(),
      image: post.image,
      author: {
        "@type": "Organization",
        name: "Proxy",
      },
    })),
  };

  return (
    <>
      <FrostedNav />
      <main className="min-h-screen bg-warm-gray-50 pt-[120px] pb-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListSchema) }}
        />
        <div className="mx-auto max-w-[1280px] px-6 md:px-12 lg:px-16">
          <h1 className="text-h1 text-text-primary">Journal</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-text-secondary md:text-lg">
            Stories, tips, and insights on vacation rentals, property
            investment, and travel.
          </p>

          {/* Category pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {BLOG_CATEGORIES.map((cat) => (
              <span
                key={cat}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  cat === "All"
                    ? "bg-brand text-white"
                    : "bg-warm-gray-100 text-text-secondary hover:bg-warm-gray-200"
                }`}
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Featured post */}
          <Link
            href={`/blog/${BLOG_POSTS[0].slug}`}
            className="group mt-10 block"
          >
            <div className="grid gap-6 md:grid-cols-2 md:gap-10">
              <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-md)]">
                <Image
                  src={BLOG_POSTS[0].image}
                  alt={BLOG_POSTS[0].title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  priority
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-label text-brand">
                  {BLOG_POSTS[0].category}
                </span>
                <h2 className="mt-3 text-h2 text-text-primary transition-colors duration-300 group-hover:text-brand">
                  {BLOG_POSTS[0].title}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-text-secondary">
                  {BLOG_POSTS[0].excerpt}
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-text-tertiary">
                  <time>{BLOG_POSTS[0].date}</time>
                  <span className="h-1 w-1 rounded-full bg-warm-gray-400" />
                  <span>{BLOG_POSTS[0].readTime}</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Post grid */}
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {BLOG_POSTS.slice(1).map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block"
              >
                <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-md)]">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                    {post.category}
                  </span>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
                    <time>{post.date}</time>
                    <span className="h-1 w-1 rounded-full bg-warm-gray-400" />
                    <span>{post.readTime}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold leading-snug text-text-primary transition-colors duration-300 group-hover:text-brand">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {post.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <DarkFooter />
    </>
  );
}
