import type { ReactNode } from 'react';
import { PageTitle } from '@/components/admin/chrome/PageTitle';

export const dynamic = 'force-dynamic';

export default async function WorkspacesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageTitle
        title="Workspaces"
        subtitle="Owner relationships, people, properties, and operating context"
      />
      {children}
    </>
  );
}
