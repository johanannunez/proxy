import type { ReactNode } from 'react';
import { PageTitle } from '@/components/admin/chrome/PageTitle';
import {
  fetchContactFilterOptions,
  fetchContactSavedViewsWithCounts,
} from '@/lib/admin/people-list';
import { fetchContactSources } from '@/lib/admin/contact-sources';
import { createClient } from '@/lib/supabase/server';
import { SavedViewsTabs } from './SavedViewsTabs';
import { ContactsViewSwitcher } from './ContactsViewSwitcher';
import { ContactFilterBar } from './ContactFilterBar';
import { ContactsFiltersProvider } from './ContactsFiltersProvider';
import { BoardToolsProvider } from './BoardToolsContext';
import styles from './ContactsLayout.module.css';

export const dynamic = 'force-dynamic';

const CONTACTS_VIEW_KEYS = ['lead-pipeline', 'onboarding', 'active-owners', 'offboarding', 'archived'];

export default async function PeopleLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const [{ data: authData }, allViews, filterOptions, allSources] =
    await Promise.all([
      supabase.auth.getUser(),
      fetchContactSavedViewsWithCounts(),
      fetchContactFilterOptions(),
      fetchContactSources(),
    ]);
  const currentUserId = authData.user?.id ?? null;

  const views = allViews.filter((v) => {
    if (!v.isPersonal) return CONTACTS_VIEW_KEYS.includes(v.key);
    const baseView = v.searchParams?.view;
    return baseView ? CONTACTS_VIEW_KEYS.includes(baseView) : true;
  });

  return (
    <ContactsFiltersProvider>
      <BoardToolsProvider>
        <div className={styles.shell}>
          <PageTitle
            title="People"
            subtitle="Global directory for owners, vendors, and Proxy team members"
          />
          <ContactsViewSwitcher />
          <div className={styles.boardNav}>
            <div className={styles.tabsRail}>
              <SavedViewsTabs views={views} />
            </div>
            <div className={styles.boardNavRight}>
              <ContactFilterBar
                filterOptions={filterOptions}
                views={views}
                allSources={allSources}
                currentUserId={currentUserId}
              />
            </div>
          </div>
          <div className={styles.content}>{children}</div>
        </div>
      </BoardToolsProvider>
    </ContactsFiltersProvider>
  );
}
