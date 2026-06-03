import StaticPage from "@/components/StaticPage";

export const metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Proxy. Questions about bookings, properties, or listing your home? Email us at hello@myproxyhost.com.",
  alternates: { canonical: "https://www.myproxyhost.com/contact" },
};

export default function ContactPage() {
  return (
    <StaticPage title="Contact Us">
      <p>
        Have a question about a property, a booking, or listing your home with
        us? We&apos;d love to hear from you.
      </p>
      <p>
        <strong>Email:</strong>{" "}
        <a
          href="mailto:hello@myproxyhost.com"
          className="text-brand hover:underline"
        >
          hello@myproxyhost.com
        </a>
      </p>
      <p>
        We typically respond within 24 hours during business days.
      </p>
    </StaticPage>
  );
}
