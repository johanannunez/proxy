// apps/web/src/app/(admin)/admin/page.tsx
import type { Metadata } from 'next';
import { fetchDashboardData, fetchGuestIntelligenceInsights } from '@/lib/admin/dashboard-data';
import { fetchDashboardTasks } from '@/lib/admin/dashboard-tasks';
import { PropertyHealthGrid } from './PropertyHealthGrid';
import { AttentionQueue } from './AttentionQueue';
import { DashboardTaskSurface } from './DashboardTaskSurface';
import { GuestPulse } from './GuestPulse';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [{ propertyCards, attentionItems }, tasks] = await Promise.all([
    fetchDashboardData(),
    fetchDashboardTasks(),
  ]);

  // Use address_line1 as the display label; fall back to property name
  const propertyRefs = propertyCards.map((c) => ({
    id: c.id,
    name: c.address ?? c.name,
  }));
  const { ownerUpdates, houseActions } = await fetchGuestIntelligenceInsights(propertyRefs);

  return (
    <div className={styles.page}>
      <div className={styles.midRow}>
        <DashboardTaskSurface tasks={tasks} />
        <AttentionQueue items={attentionItems} />
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Guest Pulse</h2>
        <GuestPulse ownerUpdates={ownerUpdates} houseActions={houseActions} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Property Health</h2>
        <PropertyHealthGrid cards={propertyCards} />
      </section>
    </div>
  );
}
