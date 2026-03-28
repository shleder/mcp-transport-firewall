import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

interface BenchmarkCase {
  id?: unknown;
  kind?: unknown;
  repeat?: unknown;
  expectedCode?: unknown;
  auth?: {
    type?: unknown;
    scopes?: unknown;
  };
  request?: {
    jsonrpc?: unknown;
    method?: unknown;
  };
}

describe('stdio evidence corpus', () => {
  const corpusPath = path.join(process.cwd(), 'examples', 'evidence-corpus.json');
  const parsed = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as {
    cases?: BenchmarkCase[];
  };
  const cases = Array.isArray(parsed.cases) ? parsed.cases : [];

  it('keeps unique case identifiers and valid baseline shape', () => {
    expect(cases.length).toBeGreaterThanOrEqual(12);

    const ids = cases.map((entry) => entry.id);
    expect(ids.every((value) => typeof value === 'string' && value.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);

    for (const benchmarkCase of cases) {
      expect(benchmarkCase.request?.jsonrpc).toBe('2.0');
      expect(benchmarkCase.request?.method).toBe('tools/call');
      expect(typeof benchmarkCase.auth?.type).toBe('string');
      expect(benchmarkCase.kind === 'allow' || benchmarkCase.kind === 'block').toBe(true);

      if (benchmarkCase.kind === 'allow') {
        expect(Number.isInteger(benchmarkCase.repeat)).toBe(true);
        expect((benchmarkCase.repeat as number) >= 2).toBe(true);
      } else {
        expect(typeof benchmarkCase.expectedCode).toBe('string');
        expect((benchmarkCase.expectedCode as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('retains coverage for expanded trust-gate categories', () => {
    const expectedCodes = new Set(
      cases
        .map((benchmarkCase) => benchmarkCase.expectedCode)
        .filter((value): value is string => typeof value === 'string')
    );
    const caseIds = new Set(
      cases
        .map((benchmarkCase) => benchmarkCase.id)
        .filter((value): value is string => typeof value === 'string')
    );

    expect(caseIds.has('allow-open-file-cache')).toBe(true);
    expect(caseIds.has('allow-list-directory-cache')).toBe(true);
    expect(caseIds.has('allow-search-alias-cache')).toBe(true);
    expect(expectedCodes.has('MISSING_SCOPE')).toBe(true);
    expect(expectedCodes.has('CROSS_TOOL_HIJACK_ATTEMPT')).toBe(true);
    expect(expectedCodes.has('PREFLIGHT_REQUIRED')).toBe(true);
    expect(expectedCodes.has('PREFLIGHT_NOT_FOUND')).toBe(true);
    expect(expectedCodes.has('EPISTEMIC_CONTRADICTION_DETECTED')).toBe(true);
  });
});
