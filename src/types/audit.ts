/**
 * Shared audit-related types used across components and hooks.
 * This file is the canonical source for types that were previously
 * scattered in component files (e.g. UploadModal.tsx).
 */

export interface UploadPersona {
  id: string;
  name: string;
  description: string;
}
