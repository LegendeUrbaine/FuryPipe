import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
const publishStart = workflow.indexOf('\n  publish:\n');
const releaseStart = workflow.indexOf('\n  release:\n', publishStart);
const publishJob = workflow.slice(publishStart, releaseStart);
const releaseJob = workflow.slice(releaseStart);

describe('Release workflow contract', () => {
  it('installs and verifies FFmpeg in the OIDC publish job before npm publish', () => {
    expect(publishStart).toBeGreaterThanOrEqual(0);
    expect(releaseStart).toBeGreaterThan(publishStart);
    expect(publishJob).toContain('runs-on: ubuntu-24.04');
    expect(publishJob).toContain('environment: release');
    expect(publishJob).toMatch(/id-token:\s*write/u);
    expect(publishJob).toContain('npm view "$NAME@$VERSION" version');
    expect(publishJob).toContain('npm install --global --ignore-scripts npm@12.0.2');
    expect(publishJob).toContain('npm publish --access public --provenance');

    const installStart = publishJob.indexOf('      - name: Install FFmpeg');
    const installEnd = publishJob.indexOf('\n      - ', installStart + 1);
    const publishCommand = publishJob.indexOf('npm publish --access public --provenance');
    const installStep = publishJob.slice(installStart, installEnd);

    expect(installStart).toBeGreaterThanOrEqual(0);
    expect(installEnd).toBeGreaterThan(installStart);
    expect(installStep).toMatch(/sudo apt-get install\s+-y\s+--no-install-recommends\s+ffmpeg/u);
    expect(installStep).toContain('ffmpeg -version');
    expect(publishCommand).toBeGreaterThan(installEnd);
  });

  it('keeps Ubuntu CI FFmpeg installation lean without changing video test coverage', () => {
    const ciWorkflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
    const installStepStart = ciWorkflow.indexOf('      - name: Install FFmpeg (Ubuntu)');
    const installStepEnd = ciWorkflow.indexOf('\n      - ', installStepStart + 1);
    const installStep = ciWorkflow.slice(installStepStart, installStepEnd);

    expect(installStepStart).toBeGreaterThanOrEqual(0);
    expect(installStepEnd).toBeGreaterThan(installStepStart);
    expect(installStep).toMatch(/sudo apt-get install\s+-y\s+--no-install-recommends\s+ffmpeg/u);
    expect(installStep).not.toContain('|| true');
  });

  it('uses versioned curated notes for the matching GitHub Release', () => {
    expect(releaseJob).toContain('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1');
    expect(releaseJob).toContain('RELEASE_NOTES_${GITHUB_REF_NAME#v}.md');
    expect(releaseJob).toContain('--notes-file "$NOTES_FILE"');
    expect(releaseJob).toContain('--generate-notes');
  });
});
