-- Backfill plugin prototype audits created after 2026-04-21 that stored
-- 1-hour signed URLs instead of durable storage paths (regression: plugin-prototype-analyze
-- was not updated alongside plugin-analyze in the Apr 21 fix).

UPDATE audits
SET screenshot_url = regexp_replace(
  screenshot_url,
  '^https://[^/]+/storage/v1/object/sign/screenshots/(.+)\?token=.*$',
  '\1'
)
WHERE source = 'plugin'
  AND screenshot_url LIKE 'https://%/storage/v1/object/sign/screenshots/%'
  AND created_at > '2026-04-21 21:39:00+00';

UPDATE audits
SET flow_images = (
  SELECT jsonb_agg(
    CASE
      WHEN elem::text LIKE '"https://%/storage/v1/object/sign/screenshots/%'
      THEN to_jsonb(regexp_replace(
        elem #>> '{}',
        '^https://[^/]+/storage/v1/object/sign/screenshots/(.+)\?token=.*$',
        '\1'
      ))
      ELSE elem
    END
  )
  FROM jsonb_array_elements(flow_images) AS elem
)
WHERE source = 'plugin'
  AND flow_images IS NOT NULL
  AND flow_images::text LIKE '%/storage/v1/object/sign/screenshots/%'
  AND created_at > '2026-04-21 21:39:00+00';
