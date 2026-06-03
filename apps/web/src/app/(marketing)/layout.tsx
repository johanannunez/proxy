"use client";

import { useRouter } from "next/navigation";
import FloatingActionMenu from "@/components/ui/floating-action-menu";
import { ArrowRight, Monitor, EnvelopeSimple } from "@phosphor-icons/react";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const actions = [
    {
      label: "Request access",
      Icon: <ArrowRight size={15} weight="bold" />,
      onClick: () => router.push("/signup"),
    },
    {
      label: "See the workspace",
      Icon: <Monitor size={15} weight="duotone" />,
      onClick: () => router.push("/#workspace"),
    },
    {
      label: "Get in touch",
      Icon: <EnvelopeSimple size={15} weight="duotone" />,
      onClick: () => { window.location.href = "mailto:hello@myproxyhost.com"; },
    },
  ];

  return (
    <>
      {children}
      <FloatingActionMenu
        options={actions}
        className="z-50"
      />
    </>
  );
}
