/**
 * Moderation, for whoever runs the site. Requests need `Authorization: Bearer <ADMIN_TOKEN>`;
 * with no token set, every admin request is refused.
 */
import { ApiError, readBody, text, type Env } from "./http";
import { sha256 } from "./identity";

async function authorise(request: Request, env: Env) {
  const token = env.ADMIN_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Compare hashes, so the time taken says nothing about the token.
  if (!token || (await sha256(given)) !== (await sha256(token))) {
    throw new ApiError(401, "Not allowed.");
  }
}

/** Programs that have been reported, most reported first, with the reasons. */
export async function reported(request: Request, env: Env) {
  await authorise(request, env);
  const programs = await env.DB.prepare(
    `SELECT id, nickname, title, description, machine, p, created, reports, hidden, reviewed
     FROM programs WHERE reports > 0 ORDER BY hidden DESC, reports DESC, created DESC LIMIT 100`,
  ).all();
  const reasons = await env.DB.prepare(
    `SELECT program, reason, created FROM reports
     WHERE program IN (SELECT id FROM programs WHERE reports > 0) ORDER BY created DESC LIMIT 500`,
  ).all();
  return { programs: programs.results, reasons: reasons.results };
}

/**
 * `{ kind: "program", id, action: "hide" | "keep" | "delete" }` or
 * `{ kind: "score", challenge, nickname, action: "hide" | "show" }`.
 * Keeping a program shows it again and stops further reports from hiding it.
 */
export async function moderate(request: Request, env: Env) {
  await authorise(request, env);
  const body = await readBody(request);
  const action = body.action;
  if (body.kind === "program") {
    const id = text(body, "id", { max: 20 });
    const sql =
      action === "hide"
        ? "UPDATE programs SET hidden = 1 WHERE id = ?1"
        : action === "keep"
          ? "UPDATE programs SET hidden = 0, reviewed = 1 WHERE id = ?1"
          : action === "delete"
            ? "DELETE FROM programs WHERE id = ?1"
            : null;
    if (!sql) throw new ApiError(400, "The action must be hide, keep or delete.");
    const r = await env.DB.prepare(sql).bind(id).run();
    if (action === "delete")
      await env.DB.prepare("DELETE FROM reports WHERE program = ?1").bind(id).run();
    return { changed: r.meta.changes };
  }
  if (body.kind === "score") {
    const challenge = text(body, "challenge", { max: 80 });
    const nickname = text(body, "nickname", { max: 20 });
    if (action !== "hide" && action !== "show") {
      throw new ApiError(400, "The action must be hide or show.");
    }
    const r = await env.DB.prepare(
      "UPDATE scores SET hidden = ?3 WHERE challenge = ?1 AND nickname = ?2",
    )
      .bind(challenge, nickname, action === "hide" ? 1 : 0)
      .run();
    return { changed: r.meta.changes };
  }
  throw new ApiError(400, "The kind must be program or score.");
}
