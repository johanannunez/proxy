"use client";

import { useEffect, useState } from "react";

function formatTime(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
      timeZoneName: "short",
    }).format(new Date());
  } catch {
    return "";
  }
}

export function OwnerLocalTime({ timezone }: { timezone: string | null }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!timezone) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTime(formatTime(timezone));
    const id = setInterval(() => setTime(formatTime(timezone)), 60_000);
    return () => clearInterval(id);
  }, [timezone]);

  if (!timezone || !time) return null;

  return (
    <span
      className="text-[11px] tabular-nums"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      {time}
    </span>
  );
}
