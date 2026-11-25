import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PersonalStep } from './components/InformationStep';
import { PaymentTable } from './components/PaymentTable';
import { createForm, createPaper } from './model';
import type { PersonalInformation, PaperRow } from './model';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_QUANTITY_PRESETS,
  DEFAULT_STAFF_MEMBERS,
} from './academicOptions';

function ControlledPersonalStep({
  initial,
  onChangeSpy,
}: {
  initial: PersonalInformation;
  onChangeSpy?: (...args: unknown[]) => void;
}) {
  const [personal, setPersonal] = useState(initial);
  return (
    <PersonalStep
      value={personal}
      errors={[]}
      onChange={(key, val) => {
        onChangeSpy?.(key, val);
        setPersonal((prev) => ({ ...prev, [key]: val }));
      }}
      profileAvailable={false}
    />
  );
}

function ControlledPaymentTable({
  initialPaper,
  onChangeSpy,
}: {
  initialPaper: PaperRow;
  onChangeSpy?: (...args: unknown[]) => void;
}) {
  const [papers, setPapers] = useState<PaperRow[]>([initialPaper]);
  return (
    <PaymentTable
      papers={papers}
      durations={[{ hours: 3, label: '3 hours', rate: 1500 }]}
      durationsReady={true}
      settingUnavailable={false}
      quantityPresets={DEFAULT_QUANTITY_PRESETS}
      errors={[]}
      onChange={(rowId, key, val) => {
        onChangeSpy?.(rowId, key, val);
        setPapers((prev) =>
          prev.map((row) => (row.id === rowId ? { ...row, [key]: val } : row)),
        );
      }}
      onAdd={() => {}}
      onRemove={() => {}}
      onShareChange={() => {}}
    />
  );
}

describe('Quantity selector and Personal information dropdowns', () => {
  it('allows typing and preset dropdown selection for Designation, Department, and Staff ID', async () => {
    const user = userEvent.setup();
    const handlePersonalChange = vi.fn();
    const form = createForm();

    render(
      <ControlledPersonalStep
        initial={form.personal}
        onChangeSpy={handlePersonalChange}
      />,
    );

    // 1. Designation: direct typing and dropdown selection
    const designationInput = screen.getByRole('textbox', { name: /designation/i });
    expect(designationInput).toBeInTheDocument();
    await user.type(designationInput, 'Lecturer');
    expect(designationInput).toHaveValue('Lecturer');

    const designationDropdown = screen.getByLabelText('Select preset', { selector: '#designation-dropdown' });
    expect(designationDropdown).toBeInTheDocument();
    const sampleDesignation = DEFAULT_DESIGNATIONS[1]!;
    await user.selectOptions(designationDropdown, sampleDesignation);
    expect(handlePersonalChange).toHaveBeenCalledWith('designation', sampleDesignation);
    expect(designationInput).toHaveValue(sampleDesignation);

    // 2. Department: direct typing and dropdown selection
    const departmentInput = screen.getByRole('textbox', { name: /department/i });
    expect(departmentInput).toBeInTheDocument();
    await user.type(departmentInput, 'CEE');
    expect(departmentInput).toHaveValue('CEE');

    const departmentDropdown = screen.getByLabelText('Select preset', { selector: '#department-dropdown' });
    expect(departmentDropdown).toBeInTheDocument();
    const sampleDept = DEFAULT_DEPARTMENTS[1]!;
    await user.selectOptions(departmentDropdown, sampleDept.code);
    expect(handlePersonalChange).toHaveBeenCalledWith('department', sampleDept.code);
    expect(departmentInput).toHaveValue(sampleDept.code);

    // 3. Staff ID: dropdown selection auto-fills related personal fields if empty
    await user.clear(designationInput);
    await user.clear(departmentInput);

    const staffIdInput = screen.getByRole('textbox', { name: /staff id/i });
    expect(staffIdInput).toBeInTheDocument();

    const staffIdDropdown = screen.getByLabelText('Select preset', { selector: '#staffId-dropdown' });
    expect(staffIdDropdown).toBeInTheDocument();

    const sampleStaff = DEFAULT_STAFF_MEMBERS[0]!;
    await user.selectOptions(staffIdDropdown, sampleStaff.staffId);

    expect(handlePersonalChange).toHaveBeenCalledWith('staffId', sampleStaff.staffId);
    expect(handlePersonalChange).toHaveBeenCalledWith('fullName', sampleStaff.fullName);
    expect(handlePersonalChange).toHaveBeenCalledWith('designation', sampleStaff.designation);
    expect(handlePersonalChange).toHaveBeenCalledWith('department', sampleStaff.departmentCode);
    expect(staffIdInput).toHaveValue(sampleStaff.staffId);
  });

  it('allows typing and preset dropdown selection for paper quantities in PaymentTable', async () => {
    const user = userEvent.setup();
    const handlePaperChange = vi.fn();
    const paper = createPaper('paper-1');

    render(
      <ControlledPaymentTable
        initialPaper={paper}
        onChangeSpy={handlePaperChange}
      />,
    );

    // 1. Papers set: typing and dropdown preset
    const papersSetInput = screen.getByRole('textbox', { name: /papers set — paper 1/i });
    expect(papersSetInput).toBeInTheDocument();
    await user.clear(papersSetInput);
    await user.type(papersSetInput, '4');
    expect(papersSetInput).toHaveValue('4');

    const papersSetDropdown = screen.getByLabelText('Select preset', { selector: `#${paper.id}-settingCount-dropdown` });
    expect(papersSetDropdown).toBeInTheDocument();
    await user.selectOptions(papersSetDropdown, '3');
    expect(handlePaperChange).toHaveBeenCalledWith(paper.id, 'settingCount', '3');
    expect(papersSetInput).toHaveValue('3');

    // 2. Papers moderated
    const moderatedInput = screen.getByRole('textbox', { name: /papers moderated — paper 1/i });
    const moderatedDropdown = screen.getByLabelText('Select preset', { selector: `#${paper.id}-moderationCount-dropdown` });
    await user.selectOptions(moderatedDropdown, '2');
    expect(handlePaperChange).toHaveBeenCalledWith(paper.id, 'moderationCount', '2');
    expect(moderatedInput).toHaveValue('2');

    // 3. Papers translated
    const translatedInput = screen.getByRole('textbox', { name: /papers translated — paper 1/i });
    const translatedDropdown = screen.getByLabelText('Select preset', { selector: `#${paper.id}-translationCount-dropdown` });
    await user.selectOptions(translatedDropdown, '1');
    expect(handlePaperChange).toHaveBeenCalledWith(paper.id, 'translationCount', '1');
    expect(translatedInput).toHaveValue('1');

    // 4. Scripts marked: dropdown preset
    const scriptsInput = screen.getByRole('textbox', { name: /scripts marked — paper 1/i });
    const scriptsDropdown = screen.getByLabelText('Select preset', { selector: `#${paper.id}-scriptCount-dropdown` });
    await user.selectOptions(scriptsDropdown, '50');
    expect(handlePaperChange).toHaveBeenCalledWith(paper.id, 'scriptCount', '50');
    expect(scriptsInput).toHaveValue('50');

    // 5. Assessment candidates: dropdown preset
    const assessmentInput = screen.getByRole('textbox', { name: /assessment candidates — paper 1/i });
    const assessmentDropdown = screen.getByLabelText('Select preset', { selector: `#${paper.id}-assessmentQuantity-dropdown` });
    await user.selectOptions(assessmentDropdown, '100');
    expect(handlePaperChange).toHaveBeenCalledWith(paper.id, 'assessmentQuantity', '100');
    expect(assessmentInput).toHaveValue('100');
  });
});
