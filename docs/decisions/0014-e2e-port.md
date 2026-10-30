# 0014: The port for browser tests

## Context

Locally, Playwright reuses a server that is already running on its port. A dev server from
another project on port 3100 was answering the tests, so every test failed for a reason that
had nothing to do with Joe's SIM.

## Choice

The browser tests use port 4317, an unusual port, unless `E2E_PORT` says otherwise. CI still
starts a fresh server every time.

## Reason

Reusing a server keeps local runs fast. An unusual port makes it unlikely that the reused
server belongs to something else.
