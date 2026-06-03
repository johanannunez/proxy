import StaticPage from "@/components/StaticPage";

export const metadata = {
  title: "Press",
  description: "Press resources and media inquiries for Proxy, a premium vacation rental and corporate housing platform.",
  alternates: { canonical: "https://www.myproxyhost.com/press" },
};

export default function PressPage() {
  return (
    <StaticPage title="Press">
      <p>
        For press inquiries, partnership requests, or media assets, contact us
        at{" "}
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
