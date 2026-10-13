// Ephemeral, side-effect-free MCP stdio fixture for the Gateway MCP runtime smoke.
import { McpServer, fromJsonSchema } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

const server = new McpServer({ name: 'furypipe-mcp-runtime-fixture', version: '1.0.0' });
const noInput = fromJsonSchema({ type: 'object', properties: {}, additionalProperties: false });

server.registerTool('echo', {
  description: 'Echo a short message back.',
  inputSchema: fromJsonSchema({
    type: 'object',
    properties: { message: { type: 'string', maxLength: 200 } },
    required: ['message'],
    additionalProperties: false,
  }),
  outputSchema: fromJsonSchema({
    type: 'object',
    properties: { echoed: { type: 'string' } },
    required: ['echoed'],
    additionalProperties: false,
  }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async ({ message }) => ({
  content: [{ type: 'text', text: `echo:${message}` }],
  structuredContent: { echoed: `echo:${message}` },
}));

server.registerTool('get_test_value', {
  description: 'Return a fixed synthetic test value.',
  inputSchema: noInput,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async () => ({ content: [{ type: 'text', text: 'test-value-42' }] }));

server.registerTool('list_test_items', {
  description: 'List fixed synthetic test items.',
  inputSchema: noInput,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async () => ({ content: [{ type: 'text', text: JSON.stringify(['alpha', 'beta', 'gamma']) }] }));

const handle = serveStdio(() => server);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  try { await handle.close(); } finally { process.exit(0); }
}
process.stdin.once('end', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
