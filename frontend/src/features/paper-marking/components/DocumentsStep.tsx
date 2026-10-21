import { Button } from '../../../components/common/Button';
import { Input, Select } from '../../../components/common/FormControls';
import type { DocumentCategory, FieldError, LocalDocument } from '../model';

import { documentLabels } from '../model';
export function DocumentsStep({
  documents,
  errors,
  fileErrors,
  onSelect,
  onRemove,
  category,
  onCategoryChange,
}: {
  documents: LocalDocument[];
  errors: FieldError[];
  fileErrors: string[];
  onSelect: (files: File[], category: DocumentCategory) => void;
  onRemove: (id: string) => void;
  category: DocumentCategory;
  onCategoryChange: (category: DocumentCategory) => void;
}) {
  const messages = [
    ...errors
      .filter((error) => error.field === 'documents')
      .map((error) => error.message),
    ...fileErrors,
  ];
  return (
    <section aria-labelledby="documents-heading" className="space-y-6">
      <h2 id="documents-heading" className="text-2xl font-bold text-brand">
        Supporting documents
      </h2>
      <p>
        Choose supporting evidence for local review. Documents are not uploaded
        or saved.
      </p>
      <Select
        label="Document category"
        value={category}
        onChange={(event) =>
          onCategoryChange(event.target.value as DocumentCategory)
        }
      >
        {(Object.keys(documentLabels) as DocumentCategory[]).map((key) => (
          <option key={key} value={key}>
            {documentLabels[key]}
          </option>
        ))}
      </Select>
      <div className="rounded-control bg-blue-50 p-6">
        <Input
          id="documents"
          label="Select supporting documents"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          multiple
          hint="PDF, PNG or JPEG; up to 10 MiB per file and 10 files. These are local selection limits; server upload policy remains unconfirmed."
          {...(messages.length ? { error: messages.join(' ') } : {})}
          onChange={(event) => {
            onSelect(Array.from(event.target.files ?? []), category);
            event.target.value = '';
          }}
        />
      </div>
      {fileErrors.length > 0 && (
        <div role="alert">
          <p className="font-semibold text-danger">
            Some files could not be selected. Review the file field errors.
          </p>
        </div>
      )}
      <h3 className="font-semibold text-brand">
        Locally selected documents ({documents.length})
      </h3>
      {documents.length === 0 ? (
        <p className="text-sm text-muted">No documents selected.</p>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border p-4"
            >
              <div className="min-w-0 break-all">
                <p className="font-semibold">{doc.file.name}</p>
                <p className="text-sm text-muted">
                  {documentLabels[doc.category]} ·{' '}
                  {(doc.file.size / 1024).toFixed(1)} KiB · Not uploaded
                </p>
              </div>
              <Button
                variant="ghost"
                aria-label={`Remove ${doc.file.name}`}
                onClick={() => onRemove(doc.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
