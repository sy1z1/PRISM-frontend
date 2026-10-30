import { getStoredAuthUser } from '../services/authStorage';
import type { StoredUser } from '../services/authStorage';

export type { StoredUser };

export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  COUNCIL_ADMIN: 'Council Admin',
  MAINTENANCE_WORKER: 'Maintenance Worker',
  DATA_ENTRY: 'Data Entry'
} as const;

export const MANAGEMENT_ROLES = [ROLES.COUNCIL_ADMIN, ROLES.SUPER_ADMIN];

export const isManagementRole = (role?: string | null) =>
  role === ROLES.COUNCIL_ADMIN || role === ROLES.SUPER_ADMIN;

export const getStoredUser = (): StoredUser | null => getStoredAuthUser();