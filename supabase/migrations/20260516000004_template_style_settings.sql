-- Add bg_color and font_family columns to marketing_templates

ALTER TABLE marketing_templates
  ADD COLUMN IF NOT EXISTS bg_color   VARCHAR(32)  DEFAULT '#F6F6F6',
  ADD COLUMN IF NOT EXISTS font_family TEXT        DEFAULT '-apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif';
