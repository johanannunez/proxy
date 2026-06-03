import StaticPage from "@/components/StaticPage";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of service for using Proxy platform for vacation rental and corporate housing bookings.",
  alternates: { canonical: "https://www.myproxyhost.com/terms" },
};

export default function TermsPage() {
  return (
    <StaticPage title="Terms of Service">
      <p>
        <em>Last updated: April 2026</em>
      </p>
      <p>
        By using Proxy website and services, you agree to these
        terms. Please read them carefully.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Use of Service
      </h2>
      <p>
        Proxy provides a platform connecting guests with property
        owners. We are not a party to rental agreements between guests and
        property owners.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Bookings and Payments
      </h2>
      <p>
        All bookings are subject to availability and property owner approval.
        Payment terms are set at the time of booking and are non-negotiable
        after confirmation.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Contact
      </h2>
      <p>
        Questions about these terms? Email{" "}
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
