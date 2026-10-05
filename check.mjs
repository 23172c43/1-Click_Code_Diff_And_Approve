/**
 * Runnable self-check for the approval gate. No framework, no deps:
 *   node check.mjs
 *
 * The plugin only needs `ctx.on`, so a two-line fake context exercises the real
 * `apply` against every branch.
 */
import assert from 'node:assert/strict'
import { apply, name } from './index.js'

/** Collect the listener `apply` registers and return it. */
function fakeCtx() {
  const listeners = []
  apply({ on: (event, fn) => listeners.push({ event, fn }) })
  assert.equal(listeners.length, 1, 'expected exactly one listener')
  assert.equal(listeners[0].event, 'tools/pre-execute')
  return listeners[0].fn
}

const preExecute = fakeCtx()
const agent = { id: 'agent-1' }
const ALLOW = { kind: 'allow' }

/** Run one call through the gate and return the decision. */
const gate = async (exec) => {
  let passedThrough = false
  const decision = await preExecute(exec, async () => {
    passedThrough = true
    return ALLOW
  })
  return { decision, passedThrough }
}

// 1. A guarded tool with a session asks instead of running.
const write = await gate({
  name: 'write',
  arguments: { file_path: 'src/app.js', content: 'console.log(1)' },
  agent,
})
assert.equal(write.decision.kind, 'ask')
assert.equal(write.passedThrough, false, 'must not run before approval')
assert.match(write.decision.reason, /src\/app\.js/)
assert.ok(write.decision.displayReason.en, 'displayReason.en is required')

// 2. `edit` is guarded too.
assert.equal(
  (await gate({ name: 'edit', arguments: { file_path: 'a.ts' }, agent })).decision.kind,
  'ask',
)

// 3. `bash` is guarded and shows the command, not a file path.
const bashAsk = await gate({ name: 'bash', arguments: { command: 'rm -rf src/' }, agent })
assert.equal(bashAsk.decision.kind, 'ask')
assert.equal(bashAsk.passedThrough, false, 'must not run before approval')
assert.match(bashAsk.decision.reason, /rm -rf src\//, 'reason must show the command')
assert.doesNotMatch(bashAsk.decision.reason, /review the diff/, 'bash has no diff to review')

// 4. Unguarded tools pass straight through to the next listener.
const read = await gate({ name: 'read', arguments: { file_path: 'a.js' }, agent })
assert.equal(read.passedThrough, true)
assert.equal(read.decision, ALLOW)

// 5. A call with no agent has no session to answer it, so it must not hang.
const orphan = await gate({ name: 'write', arguments: { file_path: 'a.js' } })
assert.equal(orphan.passedThrough, true)

// 6. Missing/malformed file_path still asks, just without the path.
const bare = await gate({ name: 'write', arguments: {}, agent })
assert.equal(bare.decision.kind, 'ask')
assert.doesNotMatch(bare.decision.reason, /undefined/)

// 7. A long command is truncated AND marked, so a cut command cannot read as whole.
const long = await gate({
  name: 'bash',
  arguments: { command: 'echo ' + 'x'.repeat(500) },
  agent,
})
assert.ok(long.decision.reason.length < 300, `reason must stay short, got ${long.decision.reason.length}`)
assert.match(long.decision.reason, /truncated/, 'a cut command must say so')

// 8. A command just under the cap is shown in full, with no truncation mark.
const exact = await gate({
  name: 'bash',
  arguments: { command: 'ls '.repeat(10) },
  agent,
})
assert.doesNotMatch(exact.decision.reason, /truncated/)

// 9. Arguments must not be mutated — the log records what the model sent.
const args = { file_path: 'src/app.js', content: 'x' }
const snapshot = structuredClone(args)
await gate({ name: 'write', arguments: args, agent })
assert.deepEqual(args, snapshot, 'plugin must not rewrite arguments')

console.log(`ok — ${name}: 9 checks passed`)
