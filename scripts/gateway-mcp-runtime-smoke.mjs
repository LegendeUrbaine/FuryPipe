// End-to-end MCP runtime smoke through the real local Gateway CLI.
// Path: `furypipe gateway start` -> one-time bootstrap -> loopback cookie ->
// WebSocket -> tools.* commands -> governed tool bridge -> MCP Direct stdio
// client -> ephemeral fixture server. Nothing on that path is mocked.
// The fixture tools are side-effect free; no provider or network is used.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

const ROOT = process.cwd();
const CLI = path.join(ROOT, 'bin', 'cli.js');
const FIXTURE = path.join(ROOT, 'scripts', 'fixtures', 'mcp-runtime-stdio-server.mjs');
const SOURCE_ID = 'qa-runtime-fixture';
const OUTPUT_DIR = process.env.FURYPIPE_VALIDATION_OUTPUT_DIR?.trim();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startGateway(workspace) {
  const toolConfig = path.join(workspace, 'tools.json');
  await writeFile(toolConfig, JSON.stringify({
    format: 'furypipe-gateway-local-tool-config/v1',
    allowDisplayResult: true,
    sources: [{
      sourceId: SOURCE_ID,
      transport: 'stdio',
      trust: 'trusted',
      command: process.execPath,
      args: [FIXTURE],
      policy: { governedReadTools: ['echo', 'list_test_items'], operatorApprovalTools: ['get_test_value'] },
    }],
  }));
  const home = path.join(workspace, 'home');
  await mkdir(home);
  const child = spawn(process.execPath, [CLI, 'gateway', 'start', '--json'], {
    cwd: ROOT,
    env: {
      // Inherited FuryPipe settings (config file, host, WebChat state, memory)
      // must not leak into this isolated run.
      ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('FURYPIPE_'))),
      HOME: home,
      USERPROFILE: home,
      FURYPIPE_GATEWAY_HOST: '127.0.0.1',
      FURYPIPE_GATEWAY_PORT: String(await freePort()),
      FURYPIPE_WEBCHAT_MCP_CONFIG: toolConfig,
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  const deadline = Date.now() + 20_000;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Gateway exited early: ${stderr.slice(-1_000)}`);
      const end = stdout.lastIndexOf('}');
      if (end > 0) {
        try {
          return { child, envelope: JSON.parse(stdout.slice(stdout.indexOf('{'), end + 1)) };
        } catch { /* envelope still streaming */ }
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Gateway readiness timeout');
  } catch (error) {
    // The caller never receives this child, so stop it here.
    await stopGateway(child).catch(() => undefined);
    throw error;
  }
}

async function stopGateway(child) {
  if (child.exitCode !== null) return 'already-exited';
  const closed = once(child, 'close');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5_000);
  const [code, signal] = await closed;
  clearTimeout(timer);
  return signal ?? `exit-${code}`;
}

class Session {
  constructor(ws, connectionId) {
    this.ws = ws;
    this.connectionId = connectionId;
    this.sequence = 0;
    this.frames = [];
    this.waiters = [];
    ws.on('message', (raw) => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      this.frames.push(message.type);
      for (const waiter of [...this.waiters]) waiter(message);
    });
  }

  command(commandName, input, permissions = ['process']) {
    this.sequence += 1;
    const messageId = `qa-mcp-${this.sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { done(); reject(new Error(`${commandName} timed out`)); }, 30_000);
      const done = () => { clearTimeout(timer); this.waiters = this.waiters.filter((entry) => entry !== waiter); };
      const waiter = (message) => {
        if (message.type === 'command-admission' && message.admission?.outcome !== 'eligible') {
          done();
          resolve({ admission: message.admission });
        } else if (message.type === 'error') {
          done();
          resolve({ error: message });
        } else if ((message.type === 'execution-command-result' || message.type === 'state-command-result') && message.commandName === commandName) {
          done();
          resolve(message.result);
        }
      };
      this.waiters.push(waiter);
      this.ws.send(JSON.stringify({
        format: 'furypipe-gateway-message/v1',
        messageId,
        connectionId: this.connectionId,
        sequence: this.sequence,
        type: 'command',
        sentAt: Date.now(),
        payload: { commandName, declaredPluginPermissions: permissions, input },
      }));
    });
  }
}

async function connect(envelope) {
  const origin = envelope.origin;
  const bootstrap = await fetch(new URL('/gateway/local-bootstrap/v1', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ format: envelope.bootstrap.format, code: envelope.bootstrap.code }),
  });
  assert(bootstrap.status === 204, `bootstrap returned HTTP ${bootstrap.status}`);
  const cookie = String(bootstrap.headers.get('set-cookie') ?? '').split(';')[0];
  const replay = await fetch(new URL('/gateway/local-bootstrap/v1', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ format: envelope.bootstrap.format, code: envelope.bootstrap.code }),
  });
  const ws = new WebSocket(envelope.websocketUrl, 'furypipe.gateway.v1', { headers: { origin, cookie } });
  const hello = await new Promise((resolve, reject) => {
    ws.once('message', (raw) => resolve(JSON.parse(String(raw))));
    ws.once('error', reject);
  });
  assert(hello.type === 'connected', `unexpected handshake ${JSON.stringify(hello).slice(0, 300)}`);
  return { session: new Session(ws, hello.connectionId), bootstrapReplayStatus: replay.status };
}

function displayText(execution) {
  const value = execution?.displayResult?.value;
  const content = Array.isArray(value?.content) ? value.content : [];
  return content.map((part) => part?.text).filter((text) => typeof text === 'string').join('');
}

async function main() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'furypipe-gateway-mcp-'));
  let gateway;
  try {
    gateway = await startGateway(workspace);
    const { envelope } = gateway;
    assert(envelope.status === 'ready' && envelope.tools?.enabled === true, 'Gateway did not enable the MCP source');
    assert(new URL(envelope.origin).hostname === '127.0.0.1', 'Gateway is not loopback-only');
    const { session, bootstrapReplayStatus } = await connect(envelope);

    const sources = await session.command('tools.sources.inspect', {}, []);
    const inspection = await session.command('tools.source.inspect.stdio', { sourceId: SOURCE_ID });
    const inventory = JSON.stringify(inspection?.result ?? {});

    // Governed read tool: policy approves, execution yields a receipt.
    const echoProposal = await session.command('tools.propose.stdio', { sourceId: SOURCE_ID, toolName: 'echo', arguments: { message: 'furypipe' } });
    const echoExecution = await session.command('tools.execute.stdio', { proposalId: echoProposal?.result?.proposalId });
    const echoReplay = await session.command('tools.execute.stdio', { proposalId: echoProposal?.result?.proposalId });

    // Operator-approval tool: execution is refused until explicit approval.
    const valueProposal = await session.command('tools.propose.stdio', { sourceId: SOURCE_ID, toolName: 'get_test_value', arguments: {} });
    const valueEarly = await session.command('tools.execute.stdio', { proposalId: valueProposal?.result?.proposalId });
    const valueApproval = await session.command('tools.approve', { proposalId: valueProposal?.result?.proposalId });
    const valueExecution = await session.command('tools.execute.stdio', { proposalId: valueProposal?.result?.proposalId });

    const listProposal = await session.command('tools.propose.stdio', { sourceId: SOURCE_ID, toolName: 'list_test_items', arguments: {} });
    const listExecution = await session.command('tools.execute.stdio', { proposalId: listProposal?.result?.proposalId });

    // Invalid arguments are refused before any call.
    const badArgs = await session.command('tools.propose.stdio', { sourceId: SOURCE_ID, toolName: 'echo', arguments: { message: 7 } });
    // Without the declared process permission the command is not admitted.
    const noPermission = await session.command('tools.source.inspect.stdio', { sourceId: SOURCE_ID }, []);

    session.ws.close();
    await once(session.ws, 'close');
    const shutdown = await stopGateway(gateway.child);

    const receipt = echoExecution?.result?.receipt;
    const checks = {
      connection: typeof session.connectionId === 'string' && session.connectionId.length > 0,
      bootstrapOneTime: bootstrapReplayStatus === 401 || bootstrapReplayStatus === 403,
      discovery: sources?.status === 'ok' && JSON.stringify(sources.result).includes(SOURCE_ID),
      inventory: inspection?.status === 'ok' && ['echo', 'get_test_value', 'list_test_items'].every((name) => inventory.includes(name)),
      riskClassified: typeof echoProposal?.result?.riskClass === 'string',
      governedReadAutoApproved: echoProposal?.result?.status === 'approved' && echoProposal.result.approvalKind === 'governed_policy',
      toolCall: echoExecution?.status === 'ok' && echoExecution.result?.status === 'completed',
      toolResponse: displayText(echoExecution?.result) === 'echo:furypipe',
      receipt: Boolean(receipt) && receipt.executed === true && receipt.succeeded === true,
      outputSchemaVerified: receipt?.verified === true,
      replayRefused: echoReplay?.status === 'rejected' && echoReplay.error?.code === 'tool-proposal-missing-or-expired',
      approvalRequired: valueProposal?.result?.status === 'approval-required' && valueEarly?.error?.code === 'tool-proposal-not-approved',
      operatorApproval: valueApproval?.status === 'ok' && valueApproval.result?.approvalKind === 'operator',
      approvedExecution: valueExecution?.result?.status === 'completed' && displayText(valueExecution.result) === 'test-value-42',
      listExecution: listExecution?.result?.status === 'completed' && displayText(listExecution.result).includes('gamma'),
      invalidArgumentsRefused: badArgs?.error?.code === 'tool-arguments-invalid',
      permissionRequired: noPermission?.admission?.reason === 'plugin-permission-mismatch',
      disconnect: shutdown !== 'already-exited',
    };
    const evidence = {
      format: 'furypipe-gateway-mcp-runtime-smoke/v1',
      status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
      sourceCommit: process.env.FURYPIPE_SOURCE_COMMIT?.trim() || 'not-bound',
      platform: { os: process.platform, node: process.version },
      levels: {
        DISCOVERED: checks.discovery && checks.inventory,
        CONNECTED: checks.inventory,
        AUTHORIZED: checks.governedReadAutoApproved && checks.operatorApproval,
        EXECUTED: checks.toolCall && checks.approvedExecution,
        VERIFIED: checks.toolResponse && checks.receipt && checks.outputSchemaVerified,
      },
      checks,
      observations: {
        echoRisk: echoProposal?.result?.riskClass,
        echoPolicy: echoProposal?.result?.policy?.outcome,
        valuePolicy: valueProposal?.result?.policy?.outcome,
        replay: echoReplay?.error?.code ?? echoReplay?.status,
        early: valueEarly?.error?.code,
        badArgs: badArgs?.error?.code ?? badArgs?.result?.status,
        noPermission: noPermission?.admission?.reason ?? noPermission?.admission?.outcome,
        receiptKeys: receipt ? Object.keys(receipt).sort() : [],
        executionState: echoExecution?.result?.state,
        bootstrapReplayStatus,
        shutdown,
      },
      fixture: 'scripts/fixtures/mcp-runtime-stdio-server.mjs (side-effect free)',
    };
    if (OUTPUT_DIR) {
      await mkdir(OUTPUT_DIR, { recursive: true });
      await writeFile(path.join(OUTPUT_DIR, 'gateway-mcp-runtime.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    }
    console.log(JSON.stringify(evidence, null, 2));
    if (evidence.status !== 'PASS') process.exitCode = 1;
  } finally {
    if (gateway) await stopGateway(gateway.child).catch(() => undefined);
    await rm(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
