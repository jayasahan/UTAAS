import { describe, expect, it } from 'vitest';
import {
  decodeCurrentProposal,
  decodeConsensusResult,
  disagreementError,
  examFrom,
  examKey,
  proposalKey,
  verifyResult,
  responseAllowed,
} from './contracts';
import { consensusFixture } from '../../test/consensusFixture';

describe('lecturer consensus contracts', () => {
  it('decodes actual lookup and POST result shapes and normalizes only examination identity', () => {
    const fixture = consensusFixture();
    const result = decodeCurrentProposal({
      exists: true,
      paperStructure: fixture.structure,
      hodProportionDivision: fixture.structure.hodProportionDivision,
    });
    expect(result.exam).toEqual(fixture.exam);
    expect(proposalKey(result)).toContain(
      fixture.structure.hodProportionDivision.setAt,
    );
    expect(examFrom({ ...fixture.exam, courseCode: ' ec5060 ' })).toEqual(
      fixture.exam,
    );
    expect(examKey(result.exam)).toBe(examKey(fixture.exam));
    expect(
      decodeConsensusResult({
        status: 'AWAITING_OTHER_EXAMINERS',
        message: 'Recorded',
        paperStructure: fixture.structure,
      }).proposal,
    ).toEqual(result);
  });
  it('does not fabricate a missing proposal or incomplete examination identity', () => {
    expect(decodeCurrentProposal({ exists: false })).toEqual({
      exists: false,
      exam: null,
      record: { state: 'missing' },
    });
    expect(examFrom({ semester: '1' })).toBeNull();
    const fixture = consensusFixture();
    expect(
      decodeCurrentProposal({
        exists: true,
        paperStructure: fixture.structure,
        hodProportionDivision: null,
      }).record.state,
    ).toBe('missing');
  });
  it.each([
    {},
    { exists: 'true' },
    { exists: true },
    { exists: true, paperStructure: { courseCode: 'EC5060' } },
  ])('rejects malformed lookup data %j', (value) => {
    expect(() => decodeCurrentProposal(value)).toThrow();
  });
  it('rejects duplicate identity records and malformed consensus records', () => {
    const { structure } = consensusFixture();
    const response = { lecturerId: 'me', agreed: true };
    expect(() =>
      decodeCurrentProposal({
        exists: true,
        paperStructure: structure,
        hodProportionDivision: {
          ...structure.hodProportionDivision,
          responses: [response, response],
        },
      }),
    ).toThrow(/Duplicate/);
    expect(() =>
      decodeCurrentProposal({
        exists: true,
        paperStructure: structure,
        hodProportionDivision: { responses: 'not-an-array' },
      }),
    ).toThrow();
  });
  it.each(['', '   ', '!!?', 'ab'])(
    'requires a meaningful disagreement: %j',
    (comment) => {
      expect(disagreementError(comment)).toContain('at least 3');
    },
  );
  it.each(['Please reconsider the essay weight.', 'වෙනස් කරන්න', '75% essay'])(
    'accepts meaningful Unicode feedback: %j',
    (comment) => {
      expect(disagreementError(comment)).toBe('');
    },
  );
  it('requires proposal timing, percentages and response records before enabling a mutation', () => {
    const fixture = consensusFixture();
    const full = decodeCurrentProposal({
      exists: true,
      paperStructure: fixture.structure,
      hodProportionDivision: fixture.structure.hodProportionDivision,
    });
    expect(responseAllowed(fixture.detail, full)).toBe(true);
    const missing = decodeCurrentProposal({
      exists: true,
      paperStructure: fixture.structure,
      hodProportionDivision: { status: 'AWAITING_LECTURER_CONSENSUS' },
    });
    expect(responseAllowed(fixture.detail, missing)).toBe(false);
  });
  it('verifies returned own response, proposal identity and outcome instead of accepting a success status alone', () => {
    const fixture = consensusFixture();
    fixture.structure.hodProportionDivision.responses.push({
      lecturerId: fixture.viewer.id,
      lecturerName: 'Lecturer',
      agreed: true,
      comments: '',
      respondedAt: '2026-11-01T10:00:00.000Z',
    });
    const result = decodeConsensusResult({
      status: 'AWAITING_OTHER_EXAMINERS',
      message: 'Recorded',
      paperStructure: fixture.structure,
    });
    const payload = { ...fixture.exam, agreed: true };
    expect(() =>
      verifyResult(
        result,
        payload,
        proposalKey(result.proposal),
        fixture.viewer.id,
      ),
    ).not.toThrow();
    expect(() =>
      verifyResult(
        result,
        { ...payload, agreed: false },
        proposalKey(result.proposal),
        fixture.viewer.id,
      ),
    ).toThrow();
    expect(() =>
      verifyResult(result, payload, 'different-proposal', fixture.viewer.id),
    ).toThrow();
    expect(() =>
      verifyResult(
        result,
        payload,
        proposalKey(result.proposal),
        'other-person',
      ),
    ).toThrow();
    expect(() =>
      decodeConsensusResult({ status: 'MADE_UP_SUCCESS' }),
    ).toThrow();
  });
});
