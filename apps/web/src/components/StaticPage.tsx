import { SiteHeader } from "@/components/site-header/SiteHeader";
import DarkFooter from "@/components/DarkFooter";

interface StaticPageProps {
  title: string;
  children: React.ReactNode;
}

export default function StaticPage({ title, children }: StaticPageProps) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-surface pt-[120px] pb-24">
        <div className="mx-auto max-w-[720px] px-6 md:px-12">
          <h1 className="text-h1 text-text-primary">{title}</h1>
          <div className="mt-8 space-y-4 text-base leading-relaxed text-text-secondary">
            {children}
          </div>
        </div>
      </main>
      <DarkFooter />
    </>
  );
}
