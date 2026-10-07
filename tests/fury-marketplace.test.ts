import { createHash, generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  createFuryMarketplaceManifest,
  createFuryMarketplaceCatalog,
  planFuryMarketplaceTransition,
  planFuryMarketplaceOperation,
  signFuryMarketplaceManifest,
  verifyFuryMarketplaceSource,
  verifyFuryMarketplaceSignature,
} from '../src/fury-marketplace.js';

const permissions = Object.freeze({
  network: 'none' as const,
  filesystem: 'none' as const,
  subprocess: 'none' as const,
  credentials: 'none' as const,
  externalWrites: Object.freeze([]),
  database: 'none' as const,
  browser: 'none' as const,
  provider: 'none' as const,
  cloud: 'none' as const,
});

function fixture() {
  return createFuryMarketplaceManifest({
    id: 'example-skill',
    name: 'Example Skill',
    version: '1.2.3',
    capabilityType: 'skill',
    sourceUrl: 'https://github.com/example/example-skill/archive/0123456789abcdef.tar.gz',
    sourceSha256: 'a'.repeat(64),
    license: 'MIT',
    author: 'Example',
    permissions,
    dependencies: ['core-runtime@1'],
    documentation: ['https://github.com/example/example-skill'],
    trust: 'VERIFIED',
  });
}

describe('Fury Marketplace foundation', () => {
  it('creates deterministic non-executable manifests', () => {
    const a = fixture();
    const b = fixture();
    expect(a.manifestDigestSha256).toBe(b.manifestDigestSha256);
    expect(a).toMatchObject({
      format: 'furypipe-marketplace-manifest/v1',
      executionAuthorized: false,
      trust: 'VERIFIED',
      compatibility: [],
    });
  });

  it('verifies trusted Ed25519 signatures and still requires operator approval', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const manifest = fixture();
    const signature = signFuryMarketplaceManifest(
      manifest,
      privateKey.export({ format: 'pem', type: 'pkcs8' }),
      'marketplace-root-2026',
    );
    const trustedKeys = [{
      keyId: 'marketplace-root-2026',
      publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }),
      trust: 'VERIFIED' as const,
    }];

    expect(verifyFuryMarketplaceSignature(manifest, signature, trustedKeys)).toMatchObject({
      verified: true,
      trust: 'VERIFIED',
    });

    const plan = planFuryMarketplaceTransition({
      action: 'INSTALL',
      manifest,
      signature,
      trustedKeys,
    });
    expect(plan).toMatchObject({
      state: 'READY_FOR_APPROVAL',
      signatureVerified: true,
      requiresOperatorApproval: true,
      networkAuthorized: false,
      filesystemAuthorized: false,
      executionAuthorized: false,
    });
  });

  it('rejects untrusted signatures and restricted packages', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const base = fixture();
    const signature = signFuryMarketplaceManifest(
      base,
      privateKey.export({ format: 'pem', type: 'pkcs8' }),
      'unknown-key',
    );
    expect(planFuryMarketplaceTransition({
      action: 'INSTALL',
      manifest: base,
      signature,
      trustedKeys: [],
    }).state).toBe('REJECTED');

    const restricted = createFuryMarketplaceManifest({
      ...base,
      trust: 'RESTRICTED',
    });
    const keys = generateKeyPairSync('ed25519');
    const restrictedSignature = signFuryMarketplaceManifest(
      restricted,
      keys.privateKey.export({ format: 'pem', type: 'pkcs8' }),
      'verified-key',
    );
    expect(planFuryMarketplaceTransition({
      action: 'INSTALL',
      manifest: restricted,
      signature: restrictedSignature,
      trustedKeys: [{
        keyId: 'verified-key',
        publicKeyPem: keys.publicKey.export({ format: 'pem', type: 'spki' }),
        trust: 'VERIFIED',
      }],
    }).state).toBe('REJECTED');
  });

  it('rejects unsafe sources, malformed hashes and invalid lifecycle transitions', () => {
    expect(() => createFuryMarketplaceManifest({
      ...fixture(),
      sourceUrl: 'http://example.test/skill.tgz',
    })).toThrow(/HTTPS/u);
    expect(() => createFuryMarketplaceManifest({
      ...fixture(),
      sourceSha256: 'abc',
    })).toThrow(/SHA-256/u);
    expect(() => createFuryMarketplaceManifest({
      ...fixture(),
      capabilityType: 'root-shell' as never,
    })).toThrow(/capabilityType/u);
    expect(() => createFuryMarketplaceManifest({
      ...fixture(),
      permissions: { ...permissions, network: 'root' as never },
    })).toThrow(/permissions\.network/u);

    const keys = generateKeyPairSync('ed25519');
    const manifest = fixture();
    const signature = signFuryMarketplaceManifest(
      manifest,
      keys.privateKey.export({ format: 'pem', type: 'pkcs8' }),
      'root',
    );
    const trustedKeys = [{
      keyId: 'root',
      publicKeyPem: keys.publicKey.export({ format: 'pem', type: 'spki' }),
      trust: 'VERIFIED' as const,
    }];
    expect(() => planFuryMarketplaceTransition({
      action: 'UPDATE',
      manifest,
      signature,
      trustedKeys,
    })).toThrow(/current version/u);
  });

  it('rejects forged metadata and keeps catalog, source verification and isolated operations approval-only', () => {
    const source = 'verified marketplace package bytes';
    const manifest = createFuryMarketplaceManifest({
      ...fixture(),
      sourceSha256: createHash('sha256').update(source).digest('hex'),
      compatibility: ['node>=22', 'windows'],
    });
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
    const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' });
    const signature = signFuryMarketplaceManifest(manifest, privateKeyPem, 'verified-root');
    const trustedKeys = [{ keyId: 'verified-root', publicKeyPem, trust: 'VERIFIED' as const }];
    const catalog = createFuryMarketplaceCatalog({ entries: [{ manifest, signature }], trustedKeys });
    const entry = catalog.find('example-skill', '1.2.3');
    expect(entry).toBeDefined();
    expect(catalog.snapshot()).toMatchObject({ format: 'furypipe-marketplace-catalog/v1', state: 'READY', count: 1, networkAuthorized: false, executionAuthorized: false });

    const sourceVerification = verifyFuryMarketplaceSource({ manifest, signature, trustedKeys, source });
    expect(sourceVerification).toMatchObject({
      format: 'furypipe-marketplace-source-verification/v1', verified: true, hashMatches: true, signatureVerified: true,
      compatibility: ['node>=22', 'windows'], networkAuthorized: false, filesystemAuthorized: false, executionAuthorized: false,
    });
    expect(planFuryMarketplaceOperation({ action: 'DOWNLOAD', entry: entry! })).toMatchObject({
      state: 'READY_FOR_APPROVAL', sourceHashVerified: false, isolation: 'staged-verification-required', requiresOperatorApproval: true,
    });
    expect(planFuryMarketplaceOperation({ action: 'INSTALL', entry: entry! }).state).toBe('REJECTED');
    expect(planFuryMarketplaceOperation({ action: 'INSTALL', entry: entry!, sourceVerification: sourceVerification })).toMatchObject({ state: 'READY_FOR_APPROVAL', sourceHashVerified: true });
    expect(planFuryMarketplaceOperation({ action: 'UNINSTALL', entry: entry!, currentVersion: '1.0.0' })).toMatchObject({ action: 'UNINSTALL', state: 'READY_FOR_APPROVAL', filesystemAuthorized: false });

    const forged = { ...manifest, permissions: { ...permissions, network: 'arbitrary' as const } };
    expect(verifyFuryMarketplaceSignature(forged, signature, trustedKeys)).toMatchObject({ verified: false, reason: 'manifest digest does not match its metadata' });
    expect(() => signFuryMarketplaceManifest(forged, privateKeyPem, 'verified-root')).toThrow(/digest does not match/u);
    expect(verifyFuryMarketplaceSource({ manifest, signature, trustedKeys, source: 'tampered bytes' })).toMatchObject({ verified: false, signatureVerified: true, hashMatches: false });
  });
});
