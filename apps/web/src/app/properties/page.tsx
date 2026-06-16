"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header/SiteHeader";
import DarkFooter from "@/components/DarkFooter";
import PropertyCard, { type Property } from "@/components/PropertyCard";

const PROPERTIES: Property[] = [
  {
    id: "1",
    name: "Lakeside Villa with Private Dock",
    location: "Lake Tahoe, CA",
    price: 420,
    rating: 4.9,
    reviewCount: 87,
    maxGuests: 8,
    bedrooms: 4,
    image:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80&auto=format",
    type: "vacation",
    featured: true,
  },
  {
    id: "2",
    name: "Downtown Executive Suite",
    location: "Austin, TX",
    price: 185,
    rating: 4.8,
    reviewCount: 124,
    maxGuests: 2,
    bedrooms: 1,
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80&auto=format",
    type: "corporate",
  },
  {
    id: "3",
    name: "Mountain Retreat with Hot Tub",
    location: "Breckenridge, CO",
    price: 375,
    rating: 4.9,
    reviewCount: 56,
    maxGuests: 6,
    bedrooms: 3,
    image:
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80&auto=format",
    type: "vacation",
  },
  {
    id: "4",
    name: "Modern Furnished Loft",
    location: "Nashville, TN",
    price: 165,
    rating: 4.7,
    reviewCount: 203,
    maxGuests: 4,
    bedrooms: 2,
    image:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80&auto=format",
    type: "corporate",
  },
  {
    id: "5",
    name: "Beachfront Bungalow",
    location: "Destin, FL",
    price: 310,
    rating: 4.8,
    reviewCount: 142,
    maxGuests: 6,
    bedrooms: 3,
    image:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80&auto=format",
    type: "vacation",
    featured: true,
  },
  {
    id: "6",
    name: "Corporate Park Residence",
    location: "Denver, CO",
    price: 145,
    rating: 4.6,
    reviewCount: 89,
    maxGuests: 3,
    bedrooms: 2,
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80&auto=format",
    type: "corporate",
  },
];

const FILTERS = ["All", "Vacation", "Corporate", "Featured"] as const;

export default function PropertiesPage() {
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const filtered = PROPERTIES.filter((p) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Featured") return p.featured;
    return p.type === activeFilter.toLowerCase();
  });

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-surface pt-[120px] pb-24">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12 lg:px-16">
          <h1 className="text-h1 text-text-primary">Our Properties</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-text-secondary md:text-lg">
            From weekend escapes to extended corporate stays. Every property
            verified, every detail considered.
          </p>

          {/* Filter Pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${
                  activeFilter === filter
                    ? "bg-gradient-to-r from-brand-light to-brand text-white shadow-md"
                    : "bg-warm-gray-50 text-text-secondary hover:bg-warm-gray-100 hover:text-text-primary"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Property Grid */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {filtered.map((property, i) => (
              <PropertyCard key={property.id} property={property} index={i} />
            ))}
          </div>
        </div>
      </main>
      <DarkFooter />
    </>
  );
}
