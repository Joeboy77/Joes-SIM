/** The Cloudflare Worker: routes requests, and sweeps old rate-limit counters once a day. */
import type { Env } from "./http";
import { sweep } from "./limits";
import { handle } from "./router";

export default {
  fetch: (request, env) => handle(request, env),
  scheduled: async (_, env) => {
    await sweep(env, Date.now());
  },
} satisfies ExportedHandler<Env>;
