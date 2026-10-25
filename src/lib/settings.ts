import type { WorkspaceSettings } from './types';

/** Product defaults from the committed SQL tracking-policy seed, independent of fixtures. */
export const DEFAULT_TRACKING_SETTINGS: WorkspaceSettings = {
  reminderDays: [7, 3, 1],
  acknowledgmentDays: 2,
  reviewDays: 3,
  emailNotifications: false,
};
