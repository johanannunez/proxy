import { fetchGuestIntelligenceInsights } from '@/lib/admin/dashboard-data';
import { PulseBoard } from '../../guest-pulse/PulseBoard';

export async function PulseTab({
  propertyId,
  propertyAddress,
}: {
  propertyId: string;
  propertyAddress: string;
}) {
  const { ownerUpdates, houseActions } = await fetchGuestIntelligenceInsights([
    { id: propertyId, name: propertyAddress },
  ]);

  return (
    <div style={{ padding: '24px' }}>
      <PulseBoard
        ownerUpdates={ownerUpdates}
        houseActions={houseActions}
        propertyOptions={[{ id: propertyId, name: propertyAddress }]}
        ownerOptions={[]}
      />
    </div>
  );
}
