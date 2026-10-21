import { Input } from '../../../components/common/FormControls';
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
}: {
  value: PersonalInformation;
  errors: FieldError[];
  onChange: (key: keyof PersonalInformation, value: string) => void;
}) {
  return (
    <section aria-labelledby="personal-heading" className="space-y-6">
      <h2 id="personal-heading" className="text-2xl font-bold text-brand">
        Step 1 — Personal & Application Information
      </h2>
      <p className="text-sm text-muted">
        Enter your staff details for local review. These values are not verified
        against university records. An authenticated profile is not connected.
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
}: {
  value: AcademicInformation;
  errors: FieldError[];
  onChange: (key: keyof AcademicInformation, value: string) => void;
}) {
  return (
    <fieldset className="grid gap-4 lg:grid-cols-2">
      <legend className="mb-4 font-semibold text-brand">
        Academic & examination information
      </legend>
      {(Object.keys(academicLabels) as (keyof AcademicInformation)[]).map(
        (key) => (
          <Input
            key={key}
            id={key}
            label={academicLabels[key]}
            value={value[key]}
            required
            maxLength={200}
            {...(errors.find((error) => error.field === key)
              ? { error: errors.find((error) => error.field === key)!.message }
              : {})}
            onChange={(event) => onChange(key, event.target.value)}
          />
        ),
      )}
    </fieldset>
  );
}
