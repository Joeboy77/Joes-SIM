# 0030: Translation

## Choice

- Messages are in typed catalogues (`apps/web/src/i18n/messages/`). English is the reference;
  French, Spanish, Portuguese, Arabic, Swahili and Twi have empty catalogues ready for
  translators. Any missing text falls back to English.
- The language is chosen from a menu and remembered on the device. A browser's own language is
  used automatically only once that language is at least 90% translated; otherwise an Arabic
  browser would get right-to-left pages full of English.
- `lang` and `dir` are set on the page before it paints. Layout uses logical directions (start
  and end, not left and right), so Arabic pages mirror correctly; a test checks this.
- Narration already uses its own translatable catalogue (decision 0016).

## Not yet

The site header and footer, theme and language menus, run controls and simulator tabs read
from the catalogue. Other text, and lessons, are still written in the components and MDX
files. They move into catalogues (and lessons into per-language folders) as translators start
on each language. No translations exist yet.
