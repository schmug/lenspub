// SPDX-License-Identifier: Apache-2.0
//
// A conformance adapter for an engine that is not written in JavaScript.
//
// The vectors are plain JSON precisely so that engines in other languages can
// be tested without porting anything. This adapter is the wiring: it starts
// your engine as a child process and speaks newline-delimited JSON to it over
// stdin and stdout, so the only thing you implement is a read-eval-print loop
// in whatever language your engine is written in.
//
//   LENSPUB_CONFORMANCE_ENGINE="python3 engines/mine/conformance_engine.py" \
//     npm run conformance -- --adapter conformance/adapters/subprocess-adapter.mjs
//
// Protocol. One JSON object per line in each direction, requests answered in
// order. The runner sends:
//
//   {"op":"describe"}
//   {"op":"validateManifest","input":{"document":{...}}}
//   {"op":"resolveAnchor","input":{"content":"...","selector":{...}}}
//   {"op":"interpret","input":{"manifest":{...},"content":{...}}}
//   {"op":"resolvePolicy","input":{"manifest":{...},"domains":[...]}}
//   {"op":"classifyImpact","input":{"change":{...}}}
//   {"op":"disposeProposal","input":{"policy":{...},"proposal":{...}}}
//   {"op":"diff","input":{"from":{...},"to":{...}}}
//
// Your engine answers each with {"ok":true,"result":<value>} or
// {"ok":false,"error":"..."}; an error is reported as a failed vector, never
// swallowed. The reply to "describe" is
// {"ok":true,"result":{"name","version","capabilityTier","roles"}} and is read
// once at startup — declare only the roles you implement, and the suite skips
// the rest rather than crediting you with them.
//
// Write anything you like to stderr; it is passed through for debugging and is
// never parsed.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const command = process.env.LENSPUB_CONFORMANCE_ENGINE;
if (!command) {
  throw new Error(
    'Set LENSPUB_CONFORMANCE_ENGINE to the command that starts your engine, for example:\n' +
    '  LENSPUB_CONFORMANCE_ENGINE="python3 my_engine.py" \\\n' +
    '    npm run conformance -- --adapter conformance/adapters/subprocess-adapter.mjs'
  );
}

const child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'inherit'] });
child.on('error', (err) => {
  throw new Error(`could not start LENSPUB_CONFORMANCE_ENGINE (${command}): ${err.message}`);
});

const lines = createInterface({ input: child.stdout });
const pending = [];
lines.on('line', (line) => {
  const next = pending.shift();
  if (!next) return;
  try {
    next.resolve(JSON.parse(line));
  } catch (err) {
    next.reject(new Error(`engine wrote a line that is not JSON: ${line.slice(0, 200)}`));
  }
});
lines.on('close', () => {
  while (pending.length) pending.shift().reject(new Error('engine closed its stdout before answering'));
});

function call(op, input) {
  return new Promise((resolve, reject) => {
    pending.push({ resolve, reject });
    child.stdin.write(`${JSON.stringify({ op, input })}\n`);
  }).then((reply) => {
    if (!reply || reply.ok !== true) {
      throw new Error(`engine failed "${op}": ${(reply && reply.error) || 'no error given'}`);
    }
    return reply.result;
  });
}

const described = await call('describe', {});
for (const field of ['name', 'version', 'capabilityTier']) {
  if (typeof described[field] !== 'string') throw new Error(`engine's describe reply has no string "${field}"`);
}
if (!Array.isArray(described.roles)) throw new Error("engine's describe reply has no \"roles\" array");

// The child holds the event loop open once the last vector has run.
process.on('exit', () => child.kill());

export default {
  name: described.name,
  version: described.version,
  capabilityTier: described.capabilityTier,
  roles: described.roles,
  validateManifest: (document) => call('validateManifest', { document }),
  resolveAnchor: (input) => call('resolveAnchor', input),
  interpret: (input) => call('interpret', input),
  resolvePolicy: (input) => call('resolvePolicy', input),
  classifyImpact: (input) => call('classifyImpact', input),
  disposeProposal: (input) => call('disposeProposal', input),
  diff: (input) => call('diff', input)
};
