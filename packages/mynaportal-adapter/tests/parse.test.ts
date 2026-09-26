import { expect, test } from 'bun:test';
import { parseMedicationXml } from '../src/index.ts';

const sample = await Bun.file(new URL('../fixtures/synthetic-yzk-if-002.xml', import.meta.url)).text();

test('parses official YZK-IF-002 medication fields without asserting origin', () => {
  const result = parseMedicationXml(sample);
  expect(result.provenance).toBe('unverified-user-import');
  expect(result.patientName).toBe('山田 花子（架空）');
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0]).toMatchObject({ drugCode: '100101001', dispensedAt: '2026-09-04', institutionName: '架空みなと薬局' });
});

test('rejects malformed or ambiguous source values', () => {
  expect(() => parseMedicationXml(sample.replace('100101001', '123'))).toThrow('9-digit');
  expect(() => parseMedicationXml(sample.replace('20260904', '20260230'))).toThrow('Invalid DiDate');
  expect(() => parseMedicationXml('<!DOCTYPE x><Message/>')).toThrow('DTD');
});
