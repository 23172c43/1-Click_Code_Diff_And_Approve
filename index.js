/**
 * One-click code diff approval.
 *
 * Holds every `write`, `edit`, and `bash` call at `tools/pre-execute` and returns
 * `{ kind: 'ask' }`, so the agent pauses and the Web UI renders its built-in
 * approval composer. The correlated tool call already renders as a diff card
 * (`presentCall` in `@deepseek-ai/dsh-tool-fs`), so the user reviews the actual
 * change and approves with Enter or clicks Reject.
 *
 * No service is injected: listening to a service's event does not require
 * mounting that service (see `@deepseek-ai/dsh-hooks-claude-code`).
 *
 * @module @local/one-click-diff-approve
 */

export const name = 'one-click-diff-approve'

/**
 * Tools that ask for approval. Every other tool passes through untouched.
 * `field` names the argument naming the change, `hint` says what to look at.
 */
const GUARDED = {
  write: { title: 'Write a file', field: 'file_path', hint: 'review the diff' },
  edit: { title: 'Edit a file', field: 'file_path', hint: 'review the diff' },
  bash: { title: 'Run a shell command', field: 'command', hint: 'read the command' },
}

/** Cap the echoed argument so a long command cannot stretch the approval UI. */
const MAX_DETAIL = 200

/**
 * Install the approval gate.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 */
export function apply(ctx) {
  ctx.on('tools/pre-execute', async (exec, next) => {
    const rule = GUARDED[exec.name]
    if (rule === undefined) return next()

    // The approval UI answers on behalf of a session. A call with no agent has
    // no session to answer, so let it run rather than wait forever.
    if (exec.agent === undefined) return next()

    // `arguments` is the lossless parsed JSON the tool is about to run on.
    const raw = exec.arguments?.[rule.field]
    let what = null
    if (typeof raw === 'string') {
      // Mark the cut, so a truncated command never reads as a whole one.
      what = raw.length > MAX_DETAIL ? `${raw.slice(0, MAX_DETAIL)}… (truncated)` : raw
    }

    const reason =
      what === null
        ? `${rule.title} — review and approve to continue.`
        : `${rule.title}: ${what} — ${rule.hint}, then approve.`

    // `reason` is the audit trail. `displayReason` is the prompt the user reads
    // and must include `en`; an absent locale falls back to it.
    return { kind: 'ask', reason, displayReason: { en: reason } }
  })
}
