import { FormField, Input } from '../../../components/common/FormControls';
import { OptionSelect } from '../../../components/common/OptionSelect';
import { Button } from '../../../components/common/Button';
import type { useAcademicOptions } from '../useAcademicOptions';
import { academicLabels, personalLabels } from '../model';
import type {
  AcademicInformation,
  FieldError,
  PersonalInformation,
} from '../model';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_STAFF_MEMBERS,
} from '../academicOptions';

export function SelectableInput({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  error,
  required,
  hint,
  maxLength = 200,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  required?: boolean | undefined;
  hint?: string | undefined;
  maxLength?: number | undefined;
}) {
  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <div className="relative flex items-center w-full">
        <input
          id={id}
          type="text"
          value={value}
          required={required}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className="field-control pr-8 w-full"
          onChange={(event) => onChange(event.target.value)}
        />
        <select
          id={`${id}-dropdown`}
          aria-label="Select preset"
          tabIndex={-1}
          value={options.some((opt) => opt.value === value) ? value : ''}
          className="absolute right-1 w-6 h-7 text-xs bg-transparent border-none text-slate-500 hover:text-slate-800 cursor-pointer focus:outline-none"
          onChange={(event) => {
            if (event.target.value !== '') {
              onChange(event.target.value);
            }
          }}
        >
          <option value="" disabled hidden>
            ▼
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </FormField>
  );
}

export function PersonalStep({
  value,
  errors,
  onChange,
  profileAvailable = false,
  choices,
}: {
  value: PersonalInformation;
  errors: FieldError[];
  onChange: (key: keyof PersonalInformation, value: string) => void;
  profileAvailable?: boolean;
  choices?: ReturnType<typeof useAcademicOptions> | undefined;
}) {
  const designationList = choices?.data?.designations ?? DEFAULT_DESIGNATIONS;
  const departmentList = choices?.data?.departments ?? DEFAULT_DEPARTMENTS;
  const staffList = choices?.data?.staffMembers ?? DEFAULT_STAFF_MEMBERS;

  const designationOptions = [
    ...designationList.map((d) => ({ value: d, label: d })),
    ...(value.designation && !designationList.includes(value.designation)
      ? [{ value: value.designation, label: value.designation }]
      : []),
  ];

  const departmentOptions = [
    ...departmentList.map((d) => ({ value: d.code, label: d.label })),
    ...(value.department &&
    !departmentList.some(
      (d) => d.code === value.department || d.label === value.department,
    )
      ? [{ value: value.department, label: value.department }]
      : []),
  ];

  const designationError = errors.find((e) => e.field === 'designation')?.message;
  const departmentError = errors.find((e) => e.field === 'department')?.message;
  const fullNameError = errors.find((e) => e.field === 'fullName')?.message;
  const staffIdError = errors.find((e) => e.field === 'staffId')?.message;
  const refTitleError = errors.find((e) => e.field === 'referenceTitle')?.message;

  return (
    <section aria-labelledby="personal-heading" className="space-y-6">
      <h2 id="personal-heading" className="text-2xl font-bold text-brand">
        Step 1 — Personal & Application Information
      </h2>
      <p className="text-sm text-muted">
        {profileAvailable
          ? 'Untouched name, department, designation, and staff ID use your university profile. Any edited values remain local.'
          : 'Enter your staff details for review. An authenticated backend profile is currently unavailable; local entries are not verified against university records.'}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Input
            id="fullName"
            label={personalLabels.fullName}
            value={value.fullName}
            maxLength={200}
            required
            {...(fullNameError ? { error: fullNameError } : {})}
            onChange={(event) => onChange('fullName', event.target.value)}
          />
        </div>

        <div>
          <SelectableInput
            id="designation"
            label={personalLabels.designation}
            value={value.designation}
            options={designationOptions}
            placeholder="Select designation"
            required
            hint={
              profileAvailable && value.designation
                ? 'Loaded from your university profile.'
                : 'Select your academic or administrative designation.'
            }
            {...(designationError ? { error: designationError } : {})}
            onChange={(val) => onChange('designation', val)}
          />
        </div>

        <div>
          <SelectableInput
            id="department"
            label={personalLabels.department}
            value={value.department}
            options={departmentOptions}
            placeholder="Select department"
            required
            hint={
              profileAvailable && value.department
                ? 'Loaded from your university profile.'
                : 'Select your department from the dropdown.'
            }
            {...(departmentError ? { error: departmentError } : {})}
            onChange={(val) => onChange('department', val)}
          />
        </div>

        <div>
          <SelectableInput
            id="staffId"
            label={personalLabels.staffId}
            value={value.staffId}
            options={staffList.map((s) => ({
              value: s.staffId,
              label: `${s.staffId} — ${s.fullName} (${s.departmentCode})`,
            }))}
            placeholder="Type or select staff ID"
            required
            maxLength={50}
            hint={
              profileAvailable && value.staffId
                ? 'Loaded from your university profile. Type or select another ID.'
                : 'Type your staff ID or select from the staff directory.'
            }
            {...(staffIdError ? { error: staffIdError } : {})}
            onChange={(val) => {
              onChange('staffId', val);
              const matched = staffList.find(
                (s) => s.staffId.toLowerCase() === val.trim().toLowerCase(),
              );
              if (matched) {
                if (!value.fullName) onChange('fullName', matched.fullName);
                if (!value.designation) onChange('designation', matched.designation);
                if (!value.department) onChange('department', matched.departmentCode);
              }
            }}
          />
        </div>

        <div className="lg:col-span-2">
          <Input
            id="referenceTitle"
            label={personalLabels.referenceTitle}
            value={value.referenceTitle}
            maxLength={200}
            hint="Optional private label. Kept in this page only; not sent or saved."
            {...(refTitleError ? { error: refTitleError } : {})}
            onChange={(event) => onChange('referenceTitle', event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
export function AcademicFields({
  value,
  errors,
  onChange,
  onCourseChange,
  choices,
}: {
  value: AcademicInformation;
  errors: FieldError[];
  onChange: (key: keyof AcademicInformation, value: string) => void;
  onCourseChange: (code: string, title: string) => void;
  choices: ReturnType<typeof useAcademicOptions>;
}) {
  const options = choices.data;
  const fieldChoices = {
    academicYear: options?.academicYears ?? [],
    semester: options?.semesters ?? [],
    degreeProgramme: options?.degreeProgrammes ?? [],
    examType: options?.examTypes ?? [],
    examinerRole: options?.examinerRoles ?? [],
  };
  const selectCourse = (code: string) => {
    const course = choices.courses.find((course) => course.code === code);
    onCourseChange(course?.code ?? '', course?.title ?? '');
  };
  const selectedCourse = choices.courses.find(
    (course) => course.code === value.courseCode,
  );
  const courseTitleValue = value.courseTitle
    ? selectedCourse?.title === value.courseTitle
      ? value.courseCode
      : '__current-course-title__'
    : '';
  const loading = choices.status === 'loading';
  const missingChoices =
    options &&
    (Object.values(fieldChoices).some((entries) => entries.length === 0) ||
      options.paperDurations.length === 0);
  return (
    <fieldset
      id="academic-options"
      tabIndex={-1}
      className="grid gap-4 lg:grid-cols-2"
      aria-busy={loading}
    >
      <legend className="mb-4 font-semibold text-brand">
        Academic & examination information
      </legend>
      {choices.status !== 'ready' && (
        <div
          className="space-y-3 lg:col-span-2"
          role={choices.status === 'error' ? 'alert' : 'status'}
        >
          <p className="text-sm text-muted">
            {loading ? 'Loading academic choices…' : choices.message}
          </p>
          {(choices.status === 'error' ||
            (choices.status === 'unavailable' && choices.errorKind)) && (
            <Button variant="secondary" onClick={choices.retry}>
              Retry academic choices
            </Button>
          )}
        </div>
      )}
      {choices.status === 'ready' && missingChoices && (
        <div className="space-y-3 lg:col-span-2" role="status">
          <p className="text-sm text-muted">
            Some academic choices are currently unavailable. Your current values
            are preserved.
          </p>
          <Button variant="secondary" onClick={choices.retry}>
            Retry academic choices
          </Button>
        </div>
      )}
      {(Object.keys(academicLabels) as (keyof AcademicInformation)[]).map(
        (key) => {
          const error = errors.find((error) => error.field === key)?.message;
          const courseField = key === 'courseCode' || key === 'courseTitle';
          const entries = courseField
            ? choices.courses.map((course) => ({
                value: course.code,
                label: key === 'courseCode' ? course.code : course.title,
              }))
            : fieldChoices[key].map((value) => ({ value, label: value }));
          return (
            <OptionSelect
              key={key}
              id={key}
              label={academicLabels[key]}
              value={key === 'courseTitle' ? courseTitleValue : value[key]}
              {...(key === 'courseTitle'
                ? { currentLabel: value.courseTitle }
                : {})}
              options={entries}
              placeholder={
                loading
                  ? 'Loading choices…'
                  : entries.length === 0
                    ? 'No choices available'
                    : `Select ${academicLabels[key].toLowerCase()}`
              }
              disabled={choices.status !== 'ready' || entries.length === 0}
              required
              {...(error ? { error } : {})}
              {...(courseField && choices.courseMessage
                ? { hint: choices.courseMessage }
                : {})}
              {...(!courseField &&
              !loading &&
              value[key] &&
              !entries.some((entry) => entry.value === value[key])
                ? {
                    hint: 'Your current value is preserved. Choose an available value before continuing.',
                  }
                : {})}
              onChange={(event) =>
                courseField
                  ? selectCourse(event.target.value)
                  : onChange(key, event.target.value)
              }
            />
          );
        },
      )}
      {choices.status === 'ready' &&
        choices.courseMessage &&
        value.semester && (
          <div className="lg:col-span-2">
            <Button variant="secondary" onClick={choices.retry}>
              Retry course choices
            </Button>
          </div>
        )}
    </fieldset>
  );
}
