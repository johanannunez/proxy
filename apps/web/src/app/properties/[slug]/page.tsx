import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import FrostedNav from "@/components/FrostedNav";
import DarkFooter from "@/components/DarkFooter";
import HospitableBookingWidget from "@/components/HospitableBookingWidget";
import BookingWidgetParamSync from "@/components/BookingWidgetParamSync";
import { getProperty, getProperties } from "@/lib/hospitable";
import { MapPin, Bed, Bathtub, Users } from "@phosphor-icons/react/dist/ssr";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const properties = await getProperties();
  return properties.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug);
  const name = property?.public_name ?? property?.name ?? "Property";
  const city = property?.address?.city ?? "Tri-Cities";

  return {
    title: `Proxy | ${name}`,
    description: `Book ${name} directly in ${city}, WA. No platform fees, best rates guaranteed.`,
    openGraph: {
      title: `Proxy | ${name}`,
      description: `Premium vacation rental in ${city}, WA. Book direct.`,
      type: "website",
    },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const property = await getProperty(slug);

  if (!property) notFound();

  const name = property.public_name ?? property.name;
  const city = property.address?.city ?? "Tri-Cities";
  const state = property.address?.state ?? "WA";
  const location = [city, state].filter(Boolean).join(", ");
  const maxGuests = property.capacity?.max ?? 2;
  const bedrooms = property.capacity?.bedrooms ?? 1;
  const bathrooms = property.capacity?.bathrooms ?? 1;
  const image =
    property.picture ??
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1920&q=80&auto=format";

  return (
    <>
      <FrostedNav />
      <main>
        {/* Hero */}
        <section className="relative h-[60vh] min-h-[420px] overflow-hidden bg-warm-gray-200 pt-[72px]">
          <Image
            src={image}
            alt={name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </section>

        {/* Content */}
        <section className="py-12">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-6 md:px-12 lg:grid-cols-[1fr_400px] lg:px-16">
            {/* Left: Details */}
            <div>
              <p className="text-label mb-2 text-brand">{location}</p>
              <h1 className="text-h1 text-text-primary">{name}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <MapPin size={16} weight="bold" className="text-brand" />
                  {location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={16} weight="bold" className="text-brand" />
                  Up to {maxGuests} guests
                </span>
                <span className="flex items-center gap-1.5">
                  <Bed size={16} weight="bold" className="text-brand" />
                  {bedrooms} {bedrooms === 1 ? "bedroom" : "bedrooms"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Bathtub size={16} weight="bold" className="text-brand" />
                  {bathrooms} {bathrooms === 1 ? "bathroom" : "bathrooms"}
                </span>
              </div>

              <div className="mt-8 border-t border-warm-gray-100 pt-8">
                <h2 className="text-h3 mb-3 text-text-primary">
                  About this home
                </h2>
                <p className="leading-relaxed text-text-secondary">
                  A beautifully appointed home in the heart of the Tri-Cities.
                  Every detail has been considered to ensure a memorable stay.
                </p>
              </div>

              <div className="mt-8 border-t border-warm-gray-100 pt-8">
                <h2 className="text-h3 mb-4 text-text-primary">Amenities</h2>
                <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary sm:grid-cols-3">
                  {[
                    "WiFi",
                    "Full kitchen",
                    "Washer & dryer",
                    "Air conditioning",
                    "Smart TV",
                    "Free parking",
                    "Patio / outdoor space",
                    "Self check-in",
                    "Work-from-home setup",
                  ].map((amenity) => (
                    <span key={amenity} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Booking Widget */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Suspense fallback={null}>
                <BookingWidgetParamSync />
              </Suspense>
              <div className="rounded-[var(--radius-lg)] border border-warm-gray-200 bg-[var(--color-white)] p-1 shadow-[var(--shadow-xl)]">
                <HospitableBookingWidget propertyId={slug} />
              </div>
              <p className="mt-3 text-center text-xs text-text-tertiary">
                Best rates guaranteed when you book direct.
              </p>
            </div>
          </div>
        </section>
      </main>
      <DarkFooter />
    </>
  );
}
