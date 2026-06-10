-- Backfill plugin audits that stored 1-hour signed URLs instead of durable storage paths.
-- Extracts the path segment from the signed URL (between /screenshots/ and ?token=)
-- so the web app's signed-URL refresh logic can regenerate them on demand.

-- Fix screenshot_url
UPDATE audits
SET screenshot_url = regexp_replace(
  screenshot_url,
  '^https://[^/]+/storage/v1/object/sign/screenshots/(.+)\?token=.*$',
  '\1'
)
WHERE source = 'plugin'
  AND screenshot_url LIKE 'https://%/storage/v1/object/sign/screenshots/%';

-- Fix each element in flow_images JSONB array
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
  AND flow_images::text LIKE '%/storage/v1/object/sign/screenshots/%';
