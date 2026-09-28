import { executeFuryHeadless, FuryHeadlessError } from './fury-headless.js';

const MAX_HEADLESS_INPUT_BYTES = 256 * 1024;

export interface FuryHeadlessCliWriter {
  write(value: string): unknown;
}

export interface FuryHeadlessCliIo {
  readonly stdin: AsyncIterable<Uint8Array | string>;
  readonly stdout: FuryHeadlessCliWriter;
  readonly stderr: FuryHeadlessCliWriter;
}

export class FuryHeadlessCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FuryHeadlessCliUsageError';
  }
}

export function furyHeadlessCliHelp(): string {
  return `Usage: furypipe headless [--json]

Read one bounded JSON request from stdin and emit one JSON response. The
request format is furypipe-headless-request/v1. Supported operations are eval
and workflow-automation-plan. Both reuse shared analysis cores and never
authorize execution.`;
}

export function parseFuryHeadlessCliArgs(argv: readonly string[]): { readonly help: boolean } {
  let help = false;
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--json') continue;
    throw new FuryHeadlessCliUsageError(`unknown headless option: ${arg}`);
  }
  return { help };
}

async function readBoundedInput(stdin: AsyncIterable<Uint8Array | string>): Promise<string> {
  const chunks: string[] = [];
  let bytes = 0;
  for await (const chunk of stdin) {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    bytes += Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_HEADLESS_INPUT_BYTES) throw new FuryHeadlessError('headless stdin exceeds 256 KiB');
    chunks.push(text);
  }
  return chunks.join('');
}

export async function runFuryHeadlessCli(
  argv: readonly string[],
  io: FuryHeadlessCliIo,
): Promise<number> {
  try {
    const parsed = parseFuryHeadlessCliArgs(argv);
    if (parsed.help) {
      io.stdout.write(furyHeadlessCliHelp() + '\n');
      return 0;
    }
    const text = await readBoundedInput(io.stdin);
    const request = JSON.parse(text) as unknown;
    io.stdout.write(JSON.stringify(executeFuryHeadless(request)) + '\n');
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'headless command failed';
    io.stderr.write(`[furypipe] headless: ${message}\n`);
    return error instanceof FuryHeadlessCliUsageError ? 2 : 1;
  }
}
