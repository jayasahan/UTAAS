import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { paperStructureFixture } from '../../../test/paperStructureFixture';
import {
  ApiError,
  createApiClient,
  type ApiClient,
} from '../../../services/apiClient';
import { createForm } from '../model';
import { PaymentTable } from '../components/PaymentTable';
import {
  decodePaperStructure,
  selectionKey,
  structureSelection,
} from './contracts';
import { settingAvailability, settingQuotaErrors } from './quotas';
import { PaperStructurePanel } from './PaperStructurePanel';
import { usePaperStructure } from './usePaperStructure';

const selection = {
  courseCode: 'EC5060',
  academicYear: '2026',
  semester: '1',
  examType: 'Final',
};
function clientFor(response: unknown = paperStructureFixture()): ApiClient {
  return {
    get: vi.fn(async (_path, decode) => decode(response)),
    post: vi.fn(),
    upload: vi.fn(),
  };
}
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => vi.unstubAllGlobals());

describe('paper structure decoding and quota rules', () => {
  it('decodes actual decimal-string weights, identity, registrant and both claimant shapes', () => {
    const data = decodePaperStructure(paperStructureFixture());
    expect(data.exists).toBe(true);
    if (!data.exists) throw new Error('expected registration');
    expect(data.paperStructure).toMatchObject({
      ...selection,
      essayWeightPercent: 75,
      mcqWeightPercent: 25,
      totalCandidates: 80,
    });
    expect(data.registeredBy.name).toBe('Dr. Registrar');
    expect(data.claimsBreakdown.setting.claimants[0]).toMatchObject({
      examinerId: 'other-examiner',
      questionsClaimed: 3,
    });
    expect(data.claimsBreakdown.scriptMarking.claimants[0]).toMatchObject({
      scriptsMarked: 80,
      questionsMarked: 3,
    });
    expect(data.registeredBy).not.toHaveProperty('email');
  });
  it('treats exists:false as unregistered without manufacturing a structure or quota', () => {
    expect(
      decodePaperStructure({
        exists: false,
        message: 'First submission registers this paper.',
      }),
    ).toEqual({
      exists: false,
      message: 'First submission registers this paper.',
    });
  });
  it.each([null, {}, { exists: 'false' }, { exists: true }, { exists: false }])(
    'rejects malformed response %j',
    (value) => {
      expect(() => decodePaperStructure(value)).toThrow();
    },
  );
  it.each([
    ['totalQuestions', -1],
    ['totalCandidates', '80'],
    ['paperDurationHours', Infinity],
    ['essayWeightPercent', 'not-a-number'],
  ])('rejects malformed registered quantity %s', (field, value) => {
    const fixture = paperStructureFixture();
    expect(() =>
      decodePaperStructure({
        ...fixture,
        paperStructure: { ...fixture.paperStructure, [field]: value },
      }),
    ).toThrow();
  });
  it('rejects inconsistent setting balances before they can disable controls', () => {
    const fixture = paperStructureFixture();
    expect(() =>
      decodePaperStructure({
        ...fixture,
        claimsBreakdown: {
          ...fixture.claimsBreakdown,
          setting: {
            ...fixture.claimsBreakdown.setting,
            remainingQuestions: 5,
          },
        },
      }),
    ).toThrow(/Inconsistent/);
  });
  it('normalizes all four selections and ignores unrelated academic fields', () => {
    expect(
      structureSelection({
        ...selection,
        courseCode: ' ec5060 ',
        degreeProgramme: 'BSc',
      }),
    ).toEqual(selection);
    expect(selectionKey(structureSelection(selection))).not.toBe(
      selectionKey({ ...selection, examType: 'Repeat' }),
    );
    expect(structureSelection({ ...selection, semester: '' })).toBeNull();
  });
  it('disables whole-paper setting with even a partial claim by another examiner', () => {
    const data = decodePaperStructure(paperStructureFixture());
    expect(settingAvailability(data, 'me')).toEqual({
      remaining: 2,
      wholePaperAvailable: false,
    });
    const papers = createForm().papers;
    papers[0]!.settingCount = '1';
    expect(settingQuotaErrors(papers, data, 'me')).toEqual([
      expect.objectContaining({
        field: 'paper-1-settingCount',
        step: 1,
        message: expect.stringContaining('only 2 remain'),
      }),
    ]);
    papers[0]!.settingCount = '0';
    expect(settingQuotaErrors(papers, data, 'me')).toEqual([]);
  });
  it('excludes the authenticated applicant by ID rather than name for draft/correction availability', () => {
    const fixture = paperStructureFixture();
    fixture.claimsBreakdown.setting.claimants[0]!.examinerId = 'me';
    fixture.claimsBreakdown.setting.claimants[0]!.questionsClaimed = 5;
    fixture.claimsBreakdown.setting.claimedQuestions = 5;
    fixture.claimsBreakdown.setting.remainingQuestions = 0;
    fixture.claimsBreakdown.setting.isFullPaperClaimed = true;
    expect(settingAvailability(decodePaperStructure(fixture), 'me')).toEqual({
      remaining: 5,
      wholePaperAvailable: true,
    });
    expect(
      settingAvailability(decodePaperStructure(fixture), 'someone-else')
        ?.wholePaperAvailable,
    ).toBe(false);
  });
  it('does not infer a quota from missing registration, failed loading or missing examiner identity', () => {
    expect(settingAvailability(null, 'me')).toBeNull();
    expect(
      settingAvailability({ exists: false, message: 'Unregistered' }, 'me'),
    ).toBeNull();
    expect(
      settingAvailability(decodePaperStructure(paperStructureFixture())),
    ).toBeNull();
  });
  it('accepts a preserved partial setting share within quota and rejects a share over quota', () => {
    const data = decodePaperStructure(paperStructureFixture());
    const paper = {
      id: 'shared-row',
      settingCount: '0',
      settingShare: { isShared: true, questionsClaimed: 2 },
    };
    expect(settingQuotaErrors([paper], data, 'me')).toEqual([]);
    paper.settingShare.questionsClaimed = 3;
    expect(settingQuotaErrors([paper], data, 'me')[0]?.message).toContain(
      'Shared setting exceeds',
    );
  });
});

describe('paper structure query lifecycle', () => {
  it('does not query incomplete selections or anonymous sessions', () => {
    const client = clientFor();
    const { result, rerender } = renderHook(
      ({ academic, active }) =>
        usePaperStructure(active ? client : null, academic),
      {
        initialProps: {
          academic: { ...selection, semester: '' },
          active: true,
        },
      },
    );
    expect(result.current.status).toBe('idle');
    expect(client.get).not.toHaveBeenCalled();
    rerender({ academic: selection, active: false });
    expect(client.get).not.toHaveBeenCalled();
  });
  it('uses the authenticated client with encoded-query arguments and loads without post calls', async () => {
    const client = clientFor();
    const { result } = renderHook(() => usePaperStructure(client, selection));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(client.get).toHaveBeenCalledWith(
      '/requests/paper-marking/paper-structure',
      decodePaperStructure,
      expect.any(AbortSignal),
      selection,
    );
    expect(client.post).not.toHaveBeenCalled();
  });
  it.each(['courseCode', 'academicYear', 'semester', 'examType'] as const)(
    'refreshes on %s changes and clears old information immediately',
    async (field) => {
      const client = clientFor();
      vi.mocked(client.get).mockImplementation(
        async (_path, decode, _signal, query) =>
          decode({
            ...paperStructureFixture(),
            paperStructure: {
              ...paperStructureFixture().paperStructure,
              ...query,
            },
          }),
      );
      const { result, rerender } = renderHook(
        (academic) => usePaperStructure(client, academic),
        { initialProps: selection },
      );
      await waitFor(() => expect(result.current.status).toBe('ready'));
      const changed = {
        ...selection,
        [field]: field === 'courseCode' ? 'EC5070' : 'Changed selection',
      };
      rerender(changed);
      expect(result.current.data).toBeNull();
      await waitFor(() => expect(result.current.status).toBe('ready'));
      expect(client.get).toHaveBeenLastCalledWith(
        expect.any(String),
        decodePaperStructure,
        expect.any(AbortSignal),
        changed,
      );
    },
  );
  it('does not refetch for unrelated personal/programme/role edits', async () => {
    const client = clientFor();
    const { result, rerender } = renderHook(
      (academic) => usePaperStructure(client, academic),
      { initialProps: { ...selection, degreeProgramme: 'BSc' } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ ...selection, degreeProgramme: 'MSc' });
    expect(client.get).toHaveBeenCalledTimes(1);
  });
  it('aborts previous queries and ignores stale completions even when the transport ignores abort', async () => {
    const old = deferred();
    const next = deferred();
    const client: ApiClient = {
      get: vi.fn(async (_path, decode, _signal, query) =>
        decode(
          await (query?.courseCode === 'EC5060' ? old.promise : next.promise),
        ),
      ),
      post: vi.fn(),
      upload: vi.fn(),
    };
    const { result, rerender } = renderHook(
      (academic) => usePaperStructure(client, academic),
      { initialProps: selection },
    );
    const firstSignal = vi.mocked(client.get).mock.calls[0]![2]!;
    rerender({ ...selection, courseCode: 'EC5070' });
    expect(firstSignal.aborted).toBe(true);
    await act(async () =>
      next.resolve({
        ...paperStructureFixture(),
        paperStructure: {
          ...paperStructureFixture().paperStructure,
          courseCode: 'EC5070',
        },
      }),
    );
    expect(
      result.current.data?.exists &&
        result.current.data.paperStructure.courseCode,
    ).toBe('EC5070');
    await act(async () => old.resolve(paperStructureFixture()));
    expect(
      result.current.data?.exists &&
        result.current.data.paperStructure.courseCode,
    ).toBe('EC5070');
  });
  it('hides a ready response when a parent selection is cleared', async () => {
    const client = clientFor();
    const { result, rerender } = renderHook(
      (academic) => usePaperStructure(client, academic),
      { initialProps: selection },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ ...selection, courseCode: '' });
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
  });
  it('rejects registered structure identity mismatches', async () => {
    const fixture = paperStructureFixture();
    const client = clientFor({
      ...fixture,
      paperStructure: { ...fixture.paperStructure, courseCode: 'EC9999' },
    });
    const { result } = renderHook(() => usePaperStructure(client, selection));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });
  it('refreshes after a relevant save and retries API failures', async () => {
    const client = clientFor();
    vi.mocked(client.get).mockRejectedValueOnce(new ApiError('network'));
    const { result } = renderHook(() => usePaperStructure(client, selection));
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.refresh());
    await waitFor(() => expect(client.get).toHaveBeenCalledTimes(3));
  });
  it.each([
    'Paper Setting quota exceeded.',
    ['Paper Setting quota exceeded.', 'Choose fewer questions.'],
  ])(
    'surfaces backend validation messages in string and array format: %j',
    async (message) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ message }), { status: 400 }),
          ),
      );
      const client = createApiClient(
        'https://api.example.test/api/v1',
        () => 'test-token',
        vi.fn(),
      );
      const { result } = renderHook(() => usePaperStructure(client, selection));
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.message).toBe(
        Array.isArray(message) ? message.join(' ') : message,
      );
      const request = vi.mocked(fetch).mock.calls[0]!;
      expect(new URL(String(request[0])).searchParams.get('courseCode')).toBe(
        'EC5060',
      );
      expect(new Headers(request[1]?.headers).get('Authorization')).toBe(
        'Bearer test-token',
      );
    },
  );
});

describe('paper structure display and unavailable inputs', () => {
  it('displays the registered structure, registrar, examiner claims, balances and contract limits', () => {
    render(
      <PaperStructurePanel
        resource={{
          status: 'ready',
          data: decodePaperStructure(paperStructureFixture()),
          message: '',
        }}
        onRefresh={vi.fn()}
        examinerId="me"
      />,
    );
    expect(screen.getByText('Dr. Registrar')).toBeVisible();
    expect(screen.getByText('Total questions')).toBeVisible();
    expect(screen.getByText('Total candidates')).toBeVisible();
    expect(screen.getByText('Reported remaining questions: 2')).toBeVisible();
    expect(screen.getByText('Whole-paper setting unavailable')).toBeVisible();
    expect(
      screen.getByText('Marking availability requires server confirmation'),
    ).toBeVisible();
    expect(
      screen.getByRole('table', { name: 'Existing examiner setting claims' }),
    ).toHaveTextContent('UT-SETTING');
    expect(
      screen.getByRole('table', { name: 'Existing examiner marking claims' }),
    ).toHaveTextContent('UT-MARKING');
    expect(screen.queryByText('other@example.test')).not.toBeInTheDocument();
  });
  it('shows first registration guidance with no fake quotas or registration mutation', () => {
    render(
      <PaperStructurePanel
        resource={{
          status: 'ready',
          data: { exists: false, message: 'No structure registered yet.' },
          message: '',
        }}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText('No registered paper structure')).toBeVisible();
    expect(
      screen.getByText(/first submission establishes the structure/i),
    ).toBeVisible();
    expect(screen.queryByText('Total questions')).not.toBeInTheDocument();
  });
  it('shows loading and errors with a working retry control', () => {
    const refresh = vi.fn();
    const { rerender } = render(
      <PaperStructurePanel
        resource={{
          status: 'loading',
          data: null,
          message: 'Loading structure',
        }}
        onRefresh={refresh}
      />,
    );
    expect(screen.getByText('Loading structure')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Refresh paper structure' }),
    ).toBeDisabled();
    rerender(
      <PaperStructurePanel
        resource={{
          status: 'error',
          data: null,
          message: 'Quota check unavailable',
        }}
        onRefresh={refresh}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry paper structure' }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });
  it('disables a new whole-paper claim but allows an invalid restored value to be cleared', () => {
    const props = {
      papers: createForm().papers,
      errors: [],
      onChange: vi.fn(),
      onAdd: vi.fn(),
      onRemove: vi.fn(),
      durations: [],
      durationsReady: true,
      settingUnavailable: true,
    };
    const { rerender } = render(<PaymentTable {...props} />);
    expect(screen.getByLabelText(/^Papers set/)).toBeDisabled();
    expect(screen.getByLabelText(/^Scripts marked/)).toBeEnabled();
    props.papers[0]!.settingCount = '1';
    rerender(<PaymentTable {...props} />);
    expect(screen.getByLabelText(/^Papers set/)).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/^Papers set/), {
      target: { value: '0' },
    });
    expect(props.onChange).toHaveBeenCalledWith('paper-1', 'settingCount', '0');
  });
});
