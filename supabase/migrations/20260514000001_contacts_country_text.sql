-- contacts.country was char(2) (ISO alpha-2 only) but the Twibbonize
-- scraper stores full country names (e.g. "Philippines", "Indonesia").
-- Widen to text so both short codes and full names are accepted.

ALTER TABLE contacts ALTER COLUMN country TYPE text;
