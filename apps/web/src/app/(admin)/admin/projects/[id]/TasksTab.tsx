// TasksTab stub — will be replaced by the shared TasksTab component from Plan B.
// Until Plan B merges, this renders a placeholder with the project's current task count.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- tasks parent_type/parent_id columns not yet in generated Supabase types
import { createClient } from '@/lib/supabase/server';
import styles from './TasksTab.module.css';

type Props = { projectId: string; taskCount?: number; taskDoneCount?: number };

export async function TasksTab({ projectId, taskDoneCount = 0 }: Props) {
  // Fetch tasks for this project
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status, due_at, created_at')
    .eq('parent_type', 'project')
    .eq('parent_id', projectId)
    .order('created_at', { ascending: false });

  const tasks = (data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    due_at: string | null;
    created_at: string;
  }>;

  if (tasks.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <span className={styles.icon}>✅</span>
          <p className={styles.heading}>No tasks yet</p>
          <p className={styles.sub}>
            Tasks created for this project will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.list}>
        {tasks.map((t) => (
          <div key={t.id} className={styles.taskRow}>
            <span
              className={`${styles.statusDot} ${t.status === 'done' ? styles.done : ''}`}
            />
            <span className={styles.title}>{t.title}</span>
            <span className={`${styles.statusPill} ${styles[`s_${t.status}`]}`}>
              {t.status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
      <p className={styles.summary}>
        {taskDoneCount || tasks.filter((t) => t.status === 'done').length} of {tasks.length} complete
      </p>
    </div>
  );
}
