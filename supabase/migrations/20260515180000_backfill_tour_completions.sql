-- Backfill: mark all tours as completed for existing users.
--
-- Context: tour gating uses `profiles.completed_tours` JSONB.
-- `shouldShowTour(name)` returns true when `completed_tours[name]` is missing,
-- which means every registered user with an empty `completed_tours` would see
-- tours auto-fire on first visit to each page. We don't want that — existing
-- users should only see tours again if they explicitly click "Restart tutorial"
-- in Settings (which calls `resetAllTours()` and clears this column).
--
-- This migration sets every existing profile's `completed_tours` to all-true.
-- New users created after this migration will get the default empty object
-- and will see tours normally as first-time UX.

UPDATE profiles
SET completed_tours = jsonb_build_object(
  'dashboard', true,
  'projectCreated', true,
  'projectView', true,
  'auditCreation', true,
  'results', true,
  'analytics', true,
  'userDataNudge', true,
  'contextDocNudge', true
)
WHERE created_at < '2026-05-15 18:00:00+00';
