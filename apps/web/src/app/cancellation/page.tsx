import StaticPage from "@/components/StaticPage";

export const metadata = {
  title: "Cancellation Policy",
  description: "Flexible cancellation options for vacation rental and corporate housing bookings at Proxy.",
  alternates: { canonical: "https://www.myproxyhost.com/cancellation" },
};

export default function CancellationPage() {
  return (
    <StaticPage title="Cancellation Policy">
      <p>
        <em>Last updated: April 2026</em>
      </p>
      <p>
        We understand plans change. Here is how cancellations work at The
        Proxy Company.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Standard Policy
      </h2>
      <p>
        Most properties offer free cancellation up to 48 hours before check-in.
        After that window, the first night&apos;s rate may be non-refundable.
        Specific terms are shown at booking time.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Extended Stays
      </h2>
      <p>
        Corporate and extended-stay bookings (30+ days) have custom
        cancellation terms agreed upon at booking. Please review your booking
        confirmation for details.
      </p>
      <h2 className="mt-6 text-xl font-bold text-text-primary">
        Questions?
      </h2>
      <p>
        Contact us at{" "}
        <a
          href="mailto:hello@myproxyhost.com"
          className="text-brand hover:underline"
        >
          hello@myproxyhost.com
        </a>{" "}
        for help with a specific booking.
      </p>
    </StaticPage>
  );
}
