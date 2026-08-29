// SPDX-License-Identifier: Apache-2.0
//
// Self-test fixture: the smallest possible engine that speaks the
// newline-delimited JSON protocol of conformance/adapters/subprocess-adapter.mjs.
// It delegates every operation to ./mock-spec-literal.mjs, so what it proves is
// the transport rather than any interpretation logic: an engine in another
// language reaching identical verdicts through the same wire format.
//
// It happens to be JavaScript because the suite's own tests must run with no
// toolchain beyond Node. Read it as the shape of the loop to write, not as a
// reason to write it in this language.

import { createInterface } from 'node:readline';
import engine from './mock-spec-literal.mjs';

const DESCRIBE = {
  name: engine.name,
  version: engine.version,
  capabilityTier: engine.capabilityTier,
  roles: engine.roles
};

const reply = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    reply({ ok: false, error: `unparseable request: ${err.message}` });
    continue;
  }
  try {
    if (request.op === 'describe') {
      reply({ ok: true, result: DESCRIBE });
    } else if (typeof engine[request.op] === 'function') {
      const input = request.op === 'validateManifest' ? request.input.document : request.input;
      reply({ ok: true, result: await engine[request.op](input) });
    } else {
      reply({ ok: false, error: `unsupported op "${request.op}"` });
    }
  } catch (err) {
    reply({ ok: false, error: err.message });
  }
}
