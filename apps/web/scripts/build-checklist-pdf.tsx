/**
 * Build the downloadable Parcel cleaning checklist PDF.
 *
 * Run with: pnpm --filter web gen:checklist-pdf
 *
 * Source: `src/app/(workspace)/workspace/cleaning-checklist/modules.ts`
 * Output: `public/cleaning-checklist.pdf`
 *
 * This is a TSX script (not a Next.js server component) executed via
 * `tsx`. It imports the shared MODULES data, renders a React PDF
 * document with Parcel branding, and writes it to disk. Re-run after
 * any edit to modules.ts to keep the PDF in sync with the web page.
 *
 * Layout:
 *   Page 1       — Full-bleed brand-blue cover with white logo + type
 *   Pages 2-N    — White module pages with the brand mark fixed at
 *                  the bottom-center footer
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import {
  Document,
  Page,
  Image,
  Text,
  View,
  StyleSheet,
  renderToFile,
} from "@react-pdf/renderer";
import { MODULES, TOTAL_ITEMS } from "../src/app/(workspace)/workspace/cleaning-checklist/modules";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(
  __dirname,
  "..",
  "public",
  "cleaning-checklist.pdf",
);

/**
 * Absolute paths to the brand assets embedded in every page of the
 * PDF. react-pdf's `<Image>` accepts a file-system path when running
 * in Node (which is how this script executes).
 */
const logoFullColorPath = path.resolve(
  __dirname,
  "..",
  "public",
  "brand",
  "logo-full-color.png",
);
const logoWhitePath = path.resolve(
  __dirname,
  "..",
  "public",
  "brand",
  "logo-white.png",
);
const logoMarkPath = path.resolve(
  __dirname,
  "..",
  "public",
  "brand",
  "logo-mark.png",
);

/* ───── Brand tokens ───── */

const BRAND_BLUE = "#02aaeb";
const BRAND_BLUE_DARK = "#1b77be";
const BRAND_BLUE_DEEP = "#0b5a94"; // darker variant used for the cover floor
const TEXT_PRIMARY = "#141414";
const TEXT_SECONDARY = "#4a4a4a";
const TEXT_TERTIARY = "#7a7a7a";
const BORDER = "#e5e5e5";
const ACCENT_TINT = "#e7f7fd";
const WHITE_90 = "#ffffff";
const WHITE_72 = "rgba(255, 255, 255, 0.78)";
const WHITE_55 = "rgba(255, 255, 255, 0.58)";
const WHITE_12 = "rgba(255, 255, 255, 0.16)";

const styles = StyleSheet.create({
  /* ═══ COVER PAGE ═══
     Full-bleed brand-blue background. No padding on the Page itself;
     we use a nested View with generous padding for content. */
  coverPage: {
    padding: 0,
    backgroundColor: BRAND_BLUE_DARK,
    fontFamily: "Helvetica",
    color: WHITE_90,
  },
  coverInner: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 56,
    paddingBottom: 48,
  },
  coverLogoWhite: {
    /* Full lockup in white, large on the cover. Aspect ~1.093. */
    width: 220,
    height: 201,
    marginLeft: -18,
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 38,
    fontFamily: "Helvetica-Bold",
    color: WHITE_90,
    letterSpacing: -0.6,
    lineHeight: 1.1,
    marginBottom: 18,
    marginTop: 28,
  },
  coverLede: {
    fontSize: 12,
    color: WHITE_72,
    lineHeight: 1.6,
    marginBottom: 32,
    maxWidth: 460,
  },

  /* Stats row on the cover. Top and bottom dividers are rendered as
     explicit <View> elements below — react-pdf's `border` shorthand
     parser mis-renders rgba() into a green-tinted blue on a blue
     background, so we avoid the shorthand entirely. */
  coverStatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 22,
  },
  coverDivider: {
    width: "100%",
    height: 0.8,
    backgroundColor: "#ffffff",
    opacity: 0.28,
  },
  coverStat: {
    flexDirection: "column",
  },
  coverStatLabel: {
    fontSize: 7,
    color: WHITE_55,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  coverStatValue: {
    fontSize: 12,
    color: WHITE_90,
    fontFamily: "Helvetica-Bold",
  },
  coverStatVerticalDivider: {
    width: 0.8,
    height: 26,
    backgroundColor: "#ffffff",
    opacity: 0.22,
  },

  /* "The few rules that matter" card on the blue cover.
     White-tinted translucent surface so the blue still breathes
     through but the text stays legible. Left accent rendered as a
     separate View so we avoid the shorthand `borderLeft` that
     mis-renders on blue. */
  coverRules: {
    marginTop: 28,
    flexDirection: "row",
    backgroundColor: WHITE_12,
    borderRadius: 8,
    overflow: "hidden",
  },
  coverRulesAccent: {
    width: 2,
    backgroundColor: "#ffffff",
  },
  coverRulesBody: {
    flex: 1,
    padding: 18,
  },
  coverRulesTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: WHITE_90,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  coverRulesItem: {
    fontSize: 10.5,
    color: WHITE_90,
    marginBottom: 5,
    lineHeight: 1.45,
  },

  /* Cover footer — small attribution strip at the very bottom. */
  coverFooter: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverFooterLabel: {
    fontSize: 8,
    color: WHITE_55,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  coverFooterUrl: {
    fontSize: 8,
    color: WHITE_55,
    letterSpacing: 0.6,
  },

  /* ═══ CONTENT PAGES ═══ */
  contentPage: {
    paddingTop: 52,
    paddingBottom: 70,
    paddingHorizontal: 48,
    fontSize: 10,
    color: TEXT_PRIMARY,
    lineHeight: 1.45,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },

  /* Footer brand mark — absolute-positioned, `fixed` so it repeats
     on every content page break. Bottom-center placement reads like
     a running brand anchor without stealing attention from content. */
  footerWrap: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerMark: {
    width: 18,
    height: 16,
  },

  /* Module section */
  module: {
    marginTop: 18,
  },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 4,
    borderBottom: `1px solid ${BORDER}`,
    paddingBottom: 6,
  },
  moduleNumber: {
    fontSize: 8,
    color: BRAND_BLUE_DARK,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  moduleTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
    flex: 1,
  },
  moduleCount: {
    fontSize: 8,
    color: TEXT_TERTIARY,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  moduleSubtitle: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    marginTop: 4,
    marginBottom: 10,
    fontStyle: "italic",
    lineHeight: 1.5,
    maxWidth: 480,
  },

  /* Item row */
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
    paddingVertical: 3,
  },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 0.8,
    borderStyle: "solid",
    borderColor: TEXT_PRIMARY,
    borderRadius: 1,
    marginTop: 2,
  },
  itemText: {
    fontSize: 9.5,
    color: TEXT_PRIMARY,
    flex: 1,
    lineHeight: 1.5,
  },
  itemOnlyIf: {
    fontSize: 7.5,
    color: TEXT_TERTIARY,
    fontStyle: "italic",
    marginLeft: 4,
  },
});

/* Unused imports kept here so future typo-fixes don't break things */
void BRAND_BLUE;
void BRAND_BLUE_DEEP;
void ACCENT_TINT;
void logoFullColorPath;
void logoWhitePath;

function ChecklistDocument() {
  return (
    <Document
      title="Parcel Turnover Cleaning Checklist"
      author="The Parcel Company"
      subject="Turnover cleaning standards"
      creator="Parcel Portal"
    >
      {/* ═══ PAGE 1 — COVER (full-bleed brand blue) ═══ */}
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverInner}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoWhitePath} style={styles.coverLogoWhite} />

          <Text style={styles.coverTitle}>
            Turnover cleaning{"\n"}checklist
          </Text>

          <Text style={styles.coverLede}>
            Every step we expect a Parcel home to meet before the next
            guest checks in. Use this when you&apos;re turning over the
            home yourself instead of scheduling our cleaning team. Some
            items only apply to certain properties, and those are
            marked along the way.
          </Text>

          {/* Stats strip with explicit thin-View dividers top + bottom */}
          <View style={styles.coverDivider} />
          <View style={styles.coverStatRow}>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>ITEMS</Text>
              <Text style={styles.coverStatValue}>{TOTAL_ITEMS}</Text>
            </View>
            <View style={styles.coverStatVerticalDivider} />
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>MODULES</Text>
              <Text style={styles.coverStatValue}>{MODULES.length}</Text>
            </View>
            <View style={styles.coverStatVerticalDivider} />
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>THERMOSTAT</Text>
              <Text style={styles.coverStatValue}>70°F on exit</Text>
            </View>
            <View style={styles.coverStatVerticalDivider} />
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>LAST STEP</Text>
              <Text style={styles.coverStatValue}>Locked-door photo</Text>
            </View>
          </View>
          <View style={styles.coverDivider} />

          {/* Rules card — accent bar is a sibling View so the color
              renders cleanly without react-pdf's border shorthand
              parser turning it green. */}
          <View style={styles.coverRules}>
            <View style={styles.coverRulesAccent} />
            <View style={styles.coverRulesBody}>
              <Text style={styles.coverRulesTitle}>
                THE FEW RULES THAT MATTER
              </Text>
              <Text style={styles.coverRulesItem}>
                • Refill every supply to 100%. Nothing should drop below
                75% before a guest arrives.
              </Text>
              <Text style={styles.coverRulesItem}>
                • Check sheets and pillowcases carefully. Even one hair
                makes the bed feel unclean to a guest.
              </Text>
              <Text style={styles.coverRulesItem}>
                • Thermostat to 70°F, lights off, windows closed, and
                all doors locked when you leave.
              </Text>
              <Text style={styles.coverRulesItem}>
                • Before and after photos are optional, but helpful if
                anything gets flagged later.
              </Text>
            </View>
          </View>
        </View>

        {/* Cover footer strip */}
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterLabel}>THE PARCEL COMPANY</Text>
          <Text style={styles.coverFooterUrl}>theparcelco.com</Text>
        </View>
      </Page>

      {/* ═══ PAGES 2+ — CONTENT (white, module list) ═══ */}
      <Page size="LETTER" style={styles.contentPage} wrap>
        {/* Footer brand mark — fixed, repeats on every content page */}
        <View style={styles.footerWrap} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoMarkPath} style={styles.footerMark} />
        </View>

        {MODULES.map((module, i) => (
          <View key={module.id} style={styles.module} wrap={false}>
            <View style={styles.moduleHeader}>
              <Text style={styles.moduleNumber}>
                {String(i + 1).padStart(2, "0")}
              </Text>
              <Text style={styles.moduleTitle}>{module.title}</Text>
              <Text style={styles.moduleCount}>
                {module.items.length} items
              </Text>
            </View>
            <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>
            {module.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.checkbox} />
                <Text style={styles.itemText}>
                  {item.text}
                  {item.onlyIf ? (
                    <Text style={styles.itemOnlyIf}>
                      {"  "}(only if {item.onlyIf})
                    </Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

async function main() {
  // Suppress the noisy React 19 warning about renderToStream
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("renderToStream")) return;
    originalWarn(...args);
  };

  console.log(`[checklist-pdf] writing ${outputPath}`);
  await renderToFile(<ChecklistDocument />, outputPath);
  console.log(
    `[checklist-pdf] done · ${TOTAL_ITEMS} items across ${MODULES.length} modules`,
  );
  console.warn = originalWarn;
}

main().catch((err) => {
  console.error("[checklist-pdf] failed:", err);
  process.exit(1);
});
