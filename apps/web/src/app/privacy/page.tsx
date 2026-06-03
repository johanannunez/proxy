import StaticPage from "@/components/StaticPage";

export const metadata = {
  title: "Privacy Policy",
  description: "How Proxy collects, uses, and protects your personal information when you use our platform.",
  alternates: { canonical: "https://www.myproxyhost.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy Policy">
      <p>
        <em>Last updated: April 2026</em>
      </p>
      <p>
        Proxy respects your privacy. This policy explains what
        information we collect, how we use it, and your rights regarding your
        data.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Information We Collect
      </h2>
      <p>
        We collect information you provide directly, such as your name and email
        when you make an inquiry or booking. We also collect usage data through
        analytics to improve our services.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        How We Use Your Information
      </h2>
      <p>
        Your information is used to process bookings, respond to inquiries, and
        improve our platform. We do not sell your personal data to third parties.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Contact
      </h2>
      <p>
        Privacy questions? Email{" "}
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
