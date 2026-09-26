import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createManagedPlaywrightBrowserRuntime,
  FURY_BROWSER_PINNED_TRANSPORT_FORMAT,
  type BrowserPinnedNetworkTransport,
  type BrowserPinnedTransportRequest,
  type BrowserPinnedTransportResponse,
} from '../src/browser-playwright-host-node.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FixtureTransport implements BrowserPinnedNetworkTransport {
  readonly format = FURY_BROWSER_PINNED_TRANSPORT_FORMAT;
  readonly requests: { url: string; method: string; bodyBytes: number; addresses: readonly string[] }[] = [];

  async request(input: BrowserPinnedTransportRequest): Promise<BrowserPinnedTransportResponse> {
    this.requests.push({
      url: input.url,
      method: input.method,
      bodyBytes: input.body?.byteLength ?? 0,
      addresses: Object.freeze([...(input.resolvedAddresses ?? [])]),
    });
    const url = new URL(input.url);
    let status = 200;
    let statusText = 'OK';
    let headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' };
    let body = '';

    if (url.pathname === '/') {
      body = `<!doctype html><html><body>
        <h1>Fury Browser QA</h1>
        <input id="name" value="">
        <select id="choice"><option value="a">A</option><option value="b">B</option></select>
        <button id="api" onclick="fetch('/api',{method:'POST',body:'ping'}).catch(()=>{})">API</button>
        <a id="next" href="/next">Next</a>
        <form id="form" action="/submitted" method="get">
          <input id="q" name="q" value="">
          <button type="submit">Submit</button>
        </form>
        <form id="upload" action="/upload" method="post" enctype="multipart/form-data">
          <input id="file" type="file" name="file" onchange="this.form.requestSubmit()">
          <button type="submit">Upload</button>
        </form>
        <script>setTimeout(()=>fetch('/late').catch(()=>{}),150)</script>
      </body></html>`;
    } else if (url.pathname === '/next') {
      body = '<!doctype html><html><body><h1>Next page</h1></body></html>';
    } else if (url.pathname === '/submitted') {
      body = `<!doctype html><html><body><h1>Submitted</h1><p id="query">${url.searchParams.get('q') ?? ''}</p></body></html>`;
    } else if (url.pathname === '/upload') {
      body = '<!doctype html><html><body><h1>Uploaded</h1></body></html>';
    } else if (url.pathname === '/api') {
      status = 204;
      statusText = 'No Content';
      headers = {};
      body = '';
    } else if (url.pathname === '/file.txt') {
      headers = {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': 'attachment; filename="browser-qa.txt"',
      };
      body = 'browser download';
    } else if (url.pathname === '/late') {
      headers = { 'content-type': 'text/plain' };
      body = 'late';
    } else {
      status = 404;
      statusText = 'Not Found';
      headers = { 'content-type': 'text/plain' };
      body = 'not found';
    }

    return Object.freeze({
      status,
      statusText,
      headers: Object.freeze(headers),
      body: new TextEncoder().encode(body),
      url: input.url,
      address: input.resolvedAddresses?.[0] ?? '93.184.216.34',
    });
  }
}

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'furypipe-browser-host-qa-'));
  const downloadRoot = join(root, 'downloads');
  const uploadRoot = join(root, 'uploads');
  await mkdir(downloadRoot, { recursive: true });
  await mkdir(uploadRoot, { recursive: true });
  const uploadFile = join(uploadRoot, 'input.txt');
  await writeFile(uploadFile, 'browser upload', 'utf8');

  const transport = new FixtureTransport();
  const resolveHostname = async (): Promise<readonly string[]> => Object.freeze(['93.184.216.34']);
  const runtime = createManagedPlaywrightBrowserRuntime({
    policy: {
      policyId: 'browser-host-qa',
      allowedOrigins: ['https://browser.qa'],
      allowedActions: [
        'navigate', 'click', 'fill', 'select', 'keyboard', 'submit', 'upload',
        'download', 'screenshot', 'extract_text', 'accessibility_snapshot',
        'wait', 'inspect_url',
      ],
      maxActionTtlMs: 10_000,
      maxTimeoutMs: 15_000,
      maxObservationBytes: 128 * 1024,
      maxDownloadBytes: 2 * 1024 * 1024,
      maxUploadBytes: 2 * 1024 * 1024,
    },
    resolveHostname,
    downloadsRoot: downloadRoot,
    uploadRoots: [uploadRoot],
    playwright: {
      headless: true,
      actionTimeoutMs: 5_000,
      navigationTimeoutMs: 10_000,
      networkTransport: transport,
    },
  });

  const checks: string[] = [];
  try {
    const session = await runtime.createSession('browser-qa');
    const page = await runtime.createPage(session);

    const nav = await runtime.authorize({ action: 'navigate', session, page, url: 'https://browser.qa/' });
    const navResult = await runtime.invoke(nav);
    assert(navResult.receipt.outcome === 'succeeded', 'navigate failed');
    checks.push('navigate');

    const textPermit = await runtime.authorize({ action: 'extract_text', session, page });
    const text = await runtime.invoke(textPermit);
    assert(text.observation?.text.includes('Fury Browser QA'), 'text extraction failed');
    checks.push('extract-text');

    const a11yPermit = await runtime.authorize({ action: 'accessibility_snapshot', session, page });
    const a11y = await runtime.invoke(a11yPermit);
    assert((a11y.observation?.text ?? '').includes('Fury Browser QA'), 'accessibility snapshot failed');
    checks.push('accessibility');

    const fill = await runtime.authorize({ action: 'fill', session, page, selector: '#q', value: 'hello' });
    assert((await runtime.invoke(fill)).receipt.outcome === 'succeeded', 'fill failed');
    const select = await runtime.authorize({ action: 'select', session, page, selector: '#choice', value: 'b' });
    assert((await runtime.invoke(select)).receipt.outcome === 'succeeded', 'select failed');
    const keyboard = await runtime.authorize({ action: 'keyboard', session, page, key: 'Tab' });
    assert((await runtime.invoke(keyboard)).receipt.outcome === 'succeeded', 'keyboard failed');
    checks.push('form-controls');

    const api = await runtime.authorize({ action: 'click', session, page, selector: '#api' });
    assert((await runtime.invoke(api)).receipt.outcome === 'succeeded', 'governed fetch click failed');
    assert(transport.requests.some((request) => new URL(request.url).pathname === '/api'), 'governed fetch was not routed through pinned transport');
    checks.push('governed-fetch');

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert(!transport.requests.some((request) => new URL(request.url).pathname === '/late'), 'background network escaped the action permit');
    checks.push('background-network-block');

    const screenshotPermit = await runtime.authorize({ action: 'screenshot', session, page });
    const screenshot = await runtime.invoke(screenshotPermit);
    assert((screenshot.artifact?.bytes.byteLength ?? 0) > 100, 'screenshot failed');
    checks.push('screenshot');

    const clickNext = await runtime.authorize({ action: 'click', session, page, selector: '#next' });
    const next = await runtime.invoke(clickNext);
    assert(next.receipt.outcome === 'succeeded', 'click navigation failed');
    const nextTextPermit = await runtime.authorize({ action: 'extract_text', session, page });
    const nextText = await runtime.invoke(nextTextPermit);
    assert(nextText.observation?.text.includes('Next page'), 'redirect/navigation result not visible');
    checks.push('click-navigation');

    const navBack = await runtime.authorize({ action: 'navigate', session, page, url: 'https://browser.qa/' });
    assert((await runtime.invoke(navBack)).receipt.outcome === 'succeeded', 'navigate back failed');

    const fillSubmit = await runtime.authorize({ action: 'fill', session, page, selector: '#q', value: 'submitted-value' });
    assert((await runtime.invoke(fillSubmit)).receipt.outcome === 'succeeded', 'submit fill failed');
    const submitPermit = await runtime.authorize({ action: 'submit', session, page, formScope: '#form' });
    assert((await runtime.invoke(submitPermit)).receipt.outcome === 'succeeded', 'submit failed');
    const submittedTextPermit = await runtime.authorize({ action: 'extract_text', session, page });
    const submittedText = await runtime.invoke(submittedTextPermit);
    assert(submittedText.observation?.text.includes('submitted-value'), 'submitted form value missing');
    checks.push('submit-navigation');

    const navUpload = await runtime.authorize({ action: 'navigate', session, page, url: 'https://browser.qa/' });
    assert((await runtime.invoke(navUpload)).receipt.outcome === 'succeeded', 'navigate before upload failed');
    const uploadPermit = await runtime.authorize({
      action: 'upload',
      session,
      page,
      filePath: uploadFile,
      destinationOrigin: 'https://browser.qa',
      formScope: '#upload',
    });
    const upload = await runtime.invoke(uploadPermit);
    assert(upload.receipt.outcome === 'succeeded', 'upload failed');
    assert(transport.requests.some((request) => new URL(request.url).pathname === '/upload' && request.method === 'POST' && request.bodyBytes > 0), 'upload body did not traverse pinned transport');
    checks.push('upload');

    const downloadPermit = await runtime.authorize({
      action: 'download',
      session,
      page,
      url: 'https://browser.qa/file.txt',
    });
    const download = await runtime.invoke(downloadPermit);
    assert(download.receipt.outcome === 'succeeded', 'download failed');
    assert(download.download?.filename === 'browser-qa.txt', 'download filename mismatch');
    assert(await readFile(download.download?.path ?? '', 'utf8') === 'browser download', 'download content mismatch');
    checks.push('download');

    const inspectPermit = await runtime.authorize({ action: 'inspect_url', session, page });
    assert((await runtime.invoke(inspectPermit)).receipt.outcome === 'succeeded', 'inspect URL failed');
    checks.push('inspect-url');

    await runtime.closeSession(session);

    const artifactRoot = join(process.cwd(), 'artifacts', 'browser-playwright-host-qa');
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(join(artifactRoot, 'report.json'), JSON.stringify({
      format: 'furypipe-browser-playwright-host-qa/v1',
      sourceCommit: process.env.FURYPIPE_SOURCE_COMMIT ?? null,
      checks,
      checkCount: checks.length,
      networkRequests: transport.requests.map((request) => ({
        url: request.url,
        method: request.method,
        bodyBytes: request.bodyBytes,
        addressCount: request.addresses.length,
      })),
      result: 'PASS',
    }, null, 2) + '\n');
    console.log(`FuryPipe Playwright browser host QA passed: ${checks.length}/${checks.length}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
