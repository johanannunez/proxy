import StaticPage from "@/components/StaticPage";

export const metadata = {
  title: "Cookie Policy",
  description: "Learn how Proxy uses cookies to improve your browsing experience.",
  alternates: { canonical: "https://www.myproxyhost.com/cookies" },
};

export default function CookiesPage() {
  return (
    <StaticPage title="Cookie Policy">
      <p>
        <em>Last updated: April 2026</em>
      </p>
      <p>
        We use cookies to improve your experience on our website. This policy
        explains what cookies we use and why.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Essential Cookies
      </h2>
      <p>
        These cookies are necessary for the website to function. They enable
        core features like page navigation and secure areas. The website cannot
        function properly without them.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Analytics Cookies
      </h2>
      <p>
        We use Google Analytics to understand how visitors interact with our
        website. This helps us improve our content and user experience. These
        cookies collect anonymous usage data.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Contact
      </h2>
      <p>
        Questions about cookies? Email{" "}
        <a
          href="mailto:hello@myproxyhost.com"
          className="text-brand hover:underline"
        >
          hello@myproxyhost.com
        </a>
        .
      </p>
    </StaticPage>
  );
}
