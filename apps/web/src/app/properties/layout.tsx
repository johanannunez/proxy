import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vacation Rentals & Corporate Housing",
  description:
    "Browse verified vacation rentals and furnished corporate residences across the US. Filter by type, location, and amenities. Flexible cancellation included.",
  openGraph: {
    title: "Proxy | Vacation Rentals & Corporate Housing",
    description:
      "Browse verified vacation rentals and furnished corporate residences across the US.",
  },
  alternates: {
    canonical: "https://www.myproxyhost.com/properties",
  },
};

export default function PropertiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
