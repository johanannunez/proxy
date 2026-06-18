import Link from "next/link";
import { Envelope, ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { SearchBar } from "@/components/help/SearchBar";
import { CategoryCard } from "@/components/help/CategoryCard";
import { ArticleCard } from "@/components/help/ArticleCard";

const FAQ_ITEMS = [
  {
    question: "How do I book a property?",
    answer:
      "Browse our properties page, select the one you like, and follow the booking flow. You will receive a confirmation email once your reservation is confirmed.",
  },
  {
    question: "What is the cancellation policy?",
    answer:
      "Cancellation policies vary by property. Check the specific listing for details, or see our cancellation policy page.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Email us at hello@myproxyhost.com or send a message through your owner workspace. We respond within 24 hours on business days.",
  },
  {
    question: "How do I view my payouts?",
    answer:
      "Log in to your owner workspace and navigate to the Payouts page. You can view payout history, download CSV exports, and see upcoming scheduled payouts.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const faqSchemaString = JSON.stringify(faqSchema);

export default async function HelpPage() {
  const supabase = await createClient();

  const [categoriesResult, popularResult] = await Promise.all([
    supabase
      .from("help_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("help_articles")
      .select(
        "id, title, slug, summary, read_time_minutes, tags, category_id, help_categories!inner(slug, name)"
      )
      .eq("status", "published")
      .order("view_count", { ascending: false })
      .limit(6),
  ]);

  const categories = categoriesResult.data ?? [];
  const popularArticles = popularResult.data ?? [];

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--color-off-white)" }}>
      {/* Structured data for SEO */}
      <script
        type="application/ld+json"
        /* Static, build-time JSON-LD from a constant defined above */
        dangerouslySetInnerHTML={{ __html: faqSchemaString }}
      />

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-24"
        style={{
          background:
            "linear-gradient(170deg, rgba(2, 170, 235, 0.06) 0%, rgba(27, 119, 190, 0.03) 40%, transparent 70%)",
        }}
      >
        {/* Decorative orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-0 h-[480px] w-[480px] rounded-full opacity-30 blur-[120px]"
          style={{ background: "var(--color-brand-light)" }}
        />

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <p
            className="text-label mb-4"
            style={{ color: "var(--color-brand)" }}
          >
            Help Center
          </p>
          <h1
            className="text-h1 mb-6"
            style={{ color: "var(--color-text-primary)" }}
          >
            How can we help?
          </h1>
          <p
            className="mx-auto mb-10 max-w-lg text-base leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Search our knowledge base or browse topics below to find the answers
            you need.
          </p>

          <SearchBar />
        </div>
      </section>

      {/* ── Categories ── */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <h2
            className="text-h3 mb-8"
            style={{ color: "var(--color-text-primary)" }}
          >
            Browse by topic
          </h2>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                name={cat.name}
                slug={cat.slug}
                description={cat.description ?? ""}
                icon={cat.icon}
                articleCount={cat.article_count}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Popular Articles ── */}
      {popularArticles.length > 0 && (
        <section
          className="border-t py-20"
          style={{
            borderColor: "var(--color-warm-gray-100)",
            backgroundColor: "var(--color-white)",
          }}
        >
          <div className="mx-auto max-w-5xl px-6">
            <h2
              className="text-h3 mb-8"
              style={{ color: "var(--color-text-primary)" }}
            >
              Popular articles
            </h2>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {popularArticles.map((article) => {
                const cat = article.help_categories as unknown as {
                  slug: string;
                  name: string;
                } | null;

                return (
                  <ArticleCard
                    key={article.id}
                    title={article.title}
                    slug={article.slug}
                    summary={article.summary}
                    categorySlug={cat?.slug ?? ""}
                    categoryName={cat?.name ?? ""}
                    readTimeMinutes={article.read_time_minutes}
                    tags={article.tags as string[] | undefined}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Still Need Help CTA ── */}
      <section
        className="border-t py-20"
        style={{ borderColor: "var(--color-warm-gray-100)" }}
      >
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2
            className="text-h3 mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            Still need help?
          </h2>
          <p
            className="mb-8 text-base leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Our team typically responds within a few hours during business days.
            We are here to help.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/workspace/inbox"
              className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:opacity-80"
              style={{ background: "var(--color-brand-gradient)" }}
            >
              <ChatCircleDots size={18} weight="duotone" />
              Send us a message
            </Link>

            <a
              href="mailto:hello@myproxyhost.com"
              className="inline-flex items-center gap-2.5 rounded-xl border px-6 py-3 text-sm font-semibold transition-colors duration-150 hover:bg-[var(--color-warm-gray-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-primary)",
                backgroundColor: "var(--color-white)",
              }}
            >
              <Envelope size={18} weight="duotone" />
              hello@myproxyhost.com
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
