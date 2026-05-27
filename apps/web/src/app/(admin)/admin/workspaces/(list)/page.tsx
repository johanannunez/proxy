import { fetchWorkspaceGallery } from '@/lib/admin/workspace-gallery';
import { WorkspaceGallery } from './WorkspaceGallery';

type Props = {
  searchParams: Promise<{
    display?: string;
    view?: string;
    q?: string;
  }>;
};

export default async function WorkspacesPage({ searchParams }: Props) {
  const { display, view, q } = await searchParams;
  const { cards, counts, activeView } = await fetchWorkspaceGallery({
    view,
    search: q,
  });

  return (
    <WorkspaceGallery
      cards={cards}
      counts={counts}
      activeView={activeView}
      displayMode={display === 'list' ? 'list' : 'gallery'}
      search={q ?? ''}
    />
  );
}
