# 0027: Share links and preview cards

## Choice

- A share link is `/sim?p=…`, where `p` is the program, inputs, dialect, view and name as short
  JSON compressed with lz-string. No server stores shared programs.
- Opening a link loads the program as unsaved, with **Save as a file**. The link stays in the
  address bar, so reloading reopens it.
- `/og?p=…` draws the preview card (title, dialect, first lines of code) with Next.js's image
  renderer. `/sim` sets Open Graph and Twitter card tags from `p`, so WhatsApp, X and other apps
  show the card. This makes `/sim` a server-rendered page; it still works offline (the service
  worker serves the cached page, and the program comes from the address).
- **`SITE_URL` must be set when deploying** (for example `https://joes-sim.example.org`), because
  preview cards need the site's full address.

## Not yet confirmed

Preview cards were checked by the browser tests (the tags are present and the image is a PNG).
How WhatsApp and X show them can only be checked once the site is deployed at a public address.
