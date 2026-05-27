export type ProjectType =
  | 'furnishing'
  | 'renovation'
  | 'onboarding'
  | 'vendor_work'
  | 'launch_prep'
  | 'internal'
  | 'idea'
  | 'feature_build'
  | 'employee_onboarding'
  | 'cleaner_onboarding'
  | 'vendor_onboarding';

export type ProjectStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'archived';

export type ProjectVisibility = 'internal' | 'portal_visible';

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  projectType: ProjectType;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  ownerUserId: string | null;
  ownerUserName: string | null;
  targetDate: string | null;
  linkedContactId: string | null;
  linkedContactName: string | null;
  linkedContactProfileId: string | null;
  linkedPropertyId: string | null;
  linkedPropertyName: string | null;
  archivedAt: string | null;
  emoji: string | null;
  color: string | null;
  taskCount: number;
  taskDoneCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSavedView = {
  key: string;
  name: string;
  sortOrder: number;
  count: number;
};

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  furnishing: 'Furnishing',
  renovation: 'Renovation',
  onboarding: 'Onboarding',
  vendor_work: 'Vendor Work',
  launch_prep: 'Launch Prep',
  internal: 'Internal',
  idea: 'Idea',
  feature_build: 'Feature build',
  employee_onboarding: 'Employee onboarding',
  cleaner_onboarding: 'Cleaner onboarding',
  vendor_onboarding: 'Vendor onboarding',
};

export const PROJECT_TYPE_EMOJI: Record<ProjectType, string> = {
  furnishing: '🛋️',
  renovation: '🏗️',
  onboarding: '🚪',
  vendor_work: '🤝',
  launch_prep: '🚀',
  internal: '📋',
  idea: '💡',
  feature_build: '🛠',
  employee_onboarding: '👋',
  cleaner_onboarding: '🧼',
  vendor_onboarding: '🤝',
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  archived: 'Archived',
};

export const PROJECT_VISIBILITY_LABEL: Record<ProjectVisibility, string> = {
  internal: 'Internal',
  portal_visible: 'Visible in portal',
};

export const CLIENT_PROJECT_TYPES: ProjectType[] = [
  'furnishing',
  'renovation',
  'onboarding',
  'vendor_work',
  'launch_prep',
  'internal',
];
