// apps/web/src/app/(admin)/admin/guest-pulse/page.tsx
import type { Metadata } from 'next';
import { fetchPulsePageData, fetchGuestIntelligenceInsights } from '@/lib/admin/dashboard-data';
import { PulseBoard } from './PulseBoard';

export const metadata: Metadata = { title: 'Guest Pulse' };
export const dynamic = 'force-dynamic';

export default async function GuestPulsePage() {
  const { propertyRefs, ownerOptions } = await fetchPulsePageData();
  const { ownerUpdates, houseActions } = await fetchGuestIntelligenceInsights(propertyRefs);

  return (
    <div style={{ padding: '28px 32px' }}>
      <PulseBoard
        ownerUpdates={ownerUpdates}
        houseActions={houseActions}
        propertyOptions={propertyRefs}
        ownerOptions={ownerOptions}
      />
    </div>
  );
}
