"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useTransition, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { List, X, SignOut, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { PLATFORM_NAV, activeNavItem } from "./nav";
import { signOut } from "@/app/(workspace)/workspace/actions";
import styles from "./PlatformShell.module.css";

type PlatformUser = { name: string; email: string };

export function PlatformShell({ user, children }: { user: PlatformUser; children: ReactNode }) {
  const pathname = usePathname();
  const active = activeNavItem(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "UTC" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const renderNav = () => (
    <>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandText}>
          <span className={styles.brandName}>Proxy</span>
          <span className={styles.brandEyebrow}>Platform</span>
        </span>
      </div>

      <nav className={styles.nav} aria-label="Platform sections">
        {PLATFORM_NAV.map((group) => (
          <div key={group.label ?? "primary"} className={styles.navGroup}>
            {group.label && <p className={styles.navGroupLabel}>{group.label}</p>}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = active?.href === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.navLink}
                  data-active={isActive || undefined}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} weight="duotone" className={styles.navIcon} />
                  <span className={styles.navLabel}>{item.label}</span>
                  {item.soon && <span className={styles.soonChip}>Soon</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.railFooter}>
        <div className={styles.userCard}>
          <span className={styles.userAvatar} aria-hidden="true">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className={styles.userMeta}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>Superadmin</span>
          </span>
        </div>
        <div className={styles.footerActions}>
          <Link href="/admin" className={styles.footerLink}>
            <ArrowSquareOut size={16} weight="duotone" />
            Exit to admin
          </Link>
          <button
            type="button"
            className={styles.footerLink}
            data-variant="signout"
            disabled={signingOut}
            onClick={() => startSignOut(() => signOut())}
          >
            <SignOut size={16} weight="duotone" />
            {signingOut ? "Signing out" : "Sign out"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div data-platform-root className={styles.root}>
      <aside className={styles.rail}>{renderNav()}</aside>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className={styles.drawer}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
            >
              <button
                type="button"
                className={styles.drawerClose}
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={18} weight="bold" />
              </button>
              {renderNav()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <List size={20} weight="bold" />
          </button>
          <div className={styles.topbarTitle}>
            <h1 className={styles.topbarHeading}>{active?.label ?? "Platform"}</h1>
            {active?.blurb && <p className={styles.topbarBlurb}>{active.blurb}</p>}
          </div>
          <div className={styles.clock} title="Coordinated Universal Time">
            <span className={styles.clockDot} aria-hidden="true" />
            <span className="pc-mono">{clock ?? "--:--:--"}</span>
            <span className={styles.clockZone}>UTC</span>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
