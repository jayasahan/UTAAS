import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useClaimForm } from './useClaimForm';
import { MAX_FILE_BYTES } from './validation';

describe('claim review regressions', () => {
  it.each([
    ['candidates', 'hours', '4', '1.5'],
    ['hours', 'candidates', '1.5', '4'],
    ['candidates', 'hours', '', '0'],
    ['hours', 'candidates', '', '0'],
  ] as const)(
    'clears %s → %s quantity %s and requires a new value',
    (from, to, initial, next) => {
      const { result } = renderHook(useClaimForm);
      if (from === 'hours')
        act(() =>
          result.current.updatePaper('paper-1', 'assessmentUnit', from),
        );
      act(() => {
        result.current.updatePaper('paper-1', 'title', 'Keep this paper');
        result.current.updatePaper('paper-1', 'durationHours', '3');
        result.current.updatePaper('paper-1', 'scriptCount', '12');
        result.current.updatePaper('paper-1', 'assessmentQuantity', initial);
        result.current.setDeclaration(true);
      });
      act(() => result.current.updatePaper('paper-1', 'assessmentUnit', to));
      expect(result.current.form.papers[0]).toMatchObject({
        title: 'Keep this paper',
        durationHours: '3',
        scriptCount: '12',
        assessmentUnit: to,
        assessmentQuantity: '',
      });
      expect(result.current.form.declaration).toBe(false);
      expect(result.current.quantityErrors).toEqual([
        expect.objectContaining({
          field: 'paper-1-assessmentQuantity',
          step: 1,
        }),
      ]);
      act(() =>
        result.current.updatePaper('paper-1', 'assessmentQuantity', next),
      );
      expect(result.current.quantityErrors).toEqual([]);
    },
  );
  it('changes only the selected row and revalidates candidate integers', () => {
    const { result } = renderHook(useClaimForm);
    act(() => result.current.addPaper());
    act(() => {
      result.current.updatePaper('paper-1', 'assessmentQuantity', '9');
      result.current.updatePaper('paper-2', 'assessmentQuantity', '7');
    });
    act(() => result.current.updatePaper('paper-2', 'assessmentUnit', 'hours'));
    expect(result.current.form.papers[0]).toMatchObject({
      assessmentUnit: 'candidates',
      assessmentQuantity: '9',
    });
    expect(result.current.form.papers[1]).toMatchObject({
      assessmentUnit: 'hours',
      assessmentQuantity: '',
    });
    act(() =>
      result.current.updatePaper('paper-2', 'assessmentQuantity', '1.5'),
    );
    expect(result.current.quantityErrors).toEqual([]);
    act(() =>
      result.current.updatePaper('paper-2', 'assessmentUnit', 'candidates'),
    );
    act(() =>
      result.current.updatePaper('paper-2', 'assessmentQuantity', '1.5'),
    );
    expect(result.current.quantityErrors[0]?.message).toMatch(/whole number/);
    act(() => result.current.removePaper('paper-2'));
    expect(result.current.quantityErrors).toEqual([]);
  });
  it('preserves selection and each document category through additions/removals', () => {
    const { result } = renderHook(useClaimForm);
    act(() => result.current.setDocumentCategory('EXAM_TIMETABLE'));
    act(() =>
      result.current.selectDocuments(
        [new File(['a'], 'schedule.pdf', { type: 'application/pdf' })],
        result.current.form.selectedDocumentCategory,
      ),
    );
    act(() => result.current.setDocumentCategory('ATTENDANCE_MARKS_SHEET'));
    act(() =>
      result.current.selectDocuments(
        [new File(['b'], 'marks.png', { type: 'image/png' })],
        result.current.form.selectedDocumentCategory,
      ),
    );
    expect(result.current.form.documents.map((doc) => doc.category)).toEqual([
      'EXAM_TIMETABLE',
      'ATTENDANCE_MARKS_SHEET',
    ]);
    act(() =>
      result.current.removeDocument(result.current.form.documents[0]!.id),
    );
    expect(result.current.form.selectedDocumentCategory).toBe(
      'ATTENDANCE_MARKS_SHEET',
    );
    expect(result.current.form.documents[0]?.category).toBe(
      'ATTENDANCE_MARKS_SHEET',
    );
  });
  it('accepts exactly ten files, rejects an eleventh and allows replacement after removal', () => {
    const { result } = renderHook(useClaimForm);
    const files = Array.from(
      { length: 11 },
      (_, index) =>
        new File(['x'], `file-${index}.pdf`, { type: 'application/pdf' }),
    );
    act(() => result.current.selectDocuments(files, 'APPOINTMENT_LETTER'));
    expect(result.current.form.documents).toHaveLength(10);
    expect(result.current.fileErrors).toEqual([
      'Select no more than 10 documents.',
    ]);
    expect(
      new Set(result.current.form.documents.map((doc) => doc.id)).size,
    ).toBe(10);
    act(() =>
      result.current.removeDocument(result.current.form.documents[0]!.id),
    );
    act(() => result.current.selectDocuments([files[10]!], 'EXAM_TIMETABLE'));
    expect(result.current.form.documents).toHaveLength(10);
    expect(result.current.fileErrors).toEqual([]);
    expect(result.current.form.documents[9]?.category).toBe('EXAM_TIMETABLE');
  });
  it('counts previously uploaded documents against the ten-file local limit', () => {
    const { result } = renderHook(useClaimForm);
    act(() =>
      result.current.selectDocuments(
        [new File(['x'], 'eleventh.pdf', { type: 'application/pdf' })],
        'APPOINTMENT_LETTER',
        10,
      ),
    );
    expect(result.current.form.documents).toEqual([]);
    expect(result.current.fileErrors).toEqual([
      'Select no more than 10 documents.',
    ]);
  });
  it('rejects invalid files without discarding an existing valid selection', () => {
    const { result } = renderHook(useClaimForm);
    act(() =>
      result.current.selectDocuments(
        [new File(['x'], 'valid.pdf', { type: 'application/pdf' })],
        'APPOINTMENT_LETTER',
      ),
    );
    const invalid = [
      new File([], 'empty.pdf', { type: 'application/pdf' }),
      new File(['x'], 'mismatch.exe', { type: 'image/png' }),
      new File(['x'], 'vector.svg', { type: 'image/svg+xml' }),
      new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'large.pdf', {
        type: 'application/pdf',
      }),
    ];
    act(() => result.current.selectDocuments(invalid, 'EXAM_TIMETABLE'));
    expect(result.current.form.documents.map((doc) => doc.file.name)).toEqual([
      'valid.pdf',
    ]);
    expect(result.current.fileErrors).toHaveLength(4);
  });
});
