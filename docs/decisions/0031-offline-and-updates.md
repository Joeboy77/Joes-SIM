# 0031: Full offline use and updates

## Choice (replaces the first step in 0026)

- The service worker is served from `/sw.js` by a route built once per build, with that build's
  version and the list of every page. A new deploy therefore has a new worker.
- When it installs, it caches every page (about 85) and every build file those pages use. After
  one visit, the simulator, lessons, challenges, teacher packs, docs, embeds and share links all
  work offline; a browser test turns the network off and uses each of them.
- A new version waits. The app shows **A new version of Joe's SIM is ready** with **Reload** and
  **Later**, and switches only when the learner chooses, so nothing changes in the middle of a
  task. (The first install also changes the page's controller; that does not reload the page.)
- A web app manifest and original icons (including a maskable one) make Joe's SIM installable.
