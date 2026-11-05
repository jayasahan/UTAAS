import { Input } from '../../../components/common/FormControls';
import { OptionSelect } from '../../../components/common/OptionSelect';
import { Button } from '../../../components/common/Button';
import type { useAcademicOptions } from '../useAcademicOptions';
import { academicLabels, personalLabels } from '../model';
import type {
  AcademicInformation,
  FieldError,
  PersonalInformation,
} from '../model';

export function PersonalStep({
  value,
  errors,
  onChange,
  profileAvailable = false,
}: {
  value: PersonalInformation;
  errors: FieldError[];
  onChange: (key: keyof PersonalInformation, value: string) => void;
  profileAvailable?: boolean;
}) {
  return (
    <section aria-labelledby="personal-heading" className="space-y-6">
      <h2 id="personal-heading" className="text-2xl font-bold text-brand">
        Step 1 — Personal & Application Information
      </h2>
      <p className="text-sm text-muted">
        {profileAvailable
          ? 'Untouched name and department fields use the backend development profile. Department contains its returned code, not an invented department name. Any edited values remain local.'
          : 'Enter your staff details for local review. An authenticated backend profile is currently unavailable; local entries are not verified against university records.'}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {(Object.keys(personalLabels) as (keyof PersonalInformation)[]).map(
          (key) => (
            <div
              key={key}
              className={key === 'referenceTitle' ? 'lg:col-span-2' : ''}
            >
              <Input
                id={key}
                label={personalLabels[key]}
                value={value[key]}
                maxLength={200}
                required={key !== 'referenceTitle'}
                {...(errors.find((error) => error.field === key)
                  ? {
                      error: errors.find((error) => error.field === key)!
                        .message,
                    }
                  : {})}
                {...(key === 'referenceTitle'
                  ? {
                      hint: 'Optional private label. Kept in this page only; not sent or saved.',
                    }
                  : {})}
                {...(key === 'designation' || key === 'staffId'
                  ? {
                      hint: 'Not returned by the profile endpoint. Enter locally; this value is not backend-verified.',
                    }
                  : {})}
                onChange={(event) => onChange(key, event.target.value)}
              />
            </div>
          ),
        )}
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
