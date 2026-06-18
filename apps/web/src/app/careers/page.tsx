import StaticPage from "@/components/StaticPage";

export const metadata = {
  title: "Careers",
  description: "Join Proxy. We're building a better way to book vacation rentals and corporate housing.",
  alternates: { canonical: "https://www.myproxyhost.com/careers" },
};

export default function CareersPage() {
  return (
    <StaticPage title="Careers">
      <p>
        We&apos;re building the future of short-term rentals. If you care about
        quality, hospitality, and doing things the right way, we&apos;d love to
        hear from you.
      </p>
      <p>
        We don&apos;t have open positions listed right now, but we&apos;re
        always interested in meeting talented people. Send us a note at{" "}
        <a
          href="mailto:hello@myproxyhost.com"
          className="text-brand hover:underline"
        >
          hello@myproxyhost.com
        </a>{" "}
        and tell us what you&apos;re great at.
      </p>
    </StaticPage>
  );
}
