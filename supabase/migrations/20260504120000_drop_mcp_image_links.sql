-- Drop the mcp_image_links table used by the old get_screenshots short-URL flow.
-- The /i/<id> redirect approach is replaced by inline base64 delivery via
-- the new list_screenshots + get_screenshot_images MCP tools.
DROP TABLE IF EXISTS public.mcp_image_links;
