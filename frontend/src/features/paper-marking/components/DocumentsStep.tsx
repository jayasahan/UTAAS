import { Button } from '../../../components/common/Button';
import { Input, Select } from '../../../components/common/FormControls';
import type { DocumentCategory, FieldError, LocalDocument } from '../model';
import type { PersistedDocument } from '../persistence';

import { documentLabels } from '../model';
export function DocumentsStep({
  documents,
  errors,
  fileErrors,
  onSelect,
  onRemove,
  category,
  onCategoryChange,
  uploadedDocuments,
  uploadStatus,
  uploadErrors,
  onUpload,
  onRemoveUploaded,
  uploadsEnabled,
  correctionMode = false,
}: {
  documents: LocalDocument[];
  errors: FieldError[];
  fileErrors: string[];
  onSelect: (files: File[], category: DocumentCategory) => void;
  onRemove: (id: string) => void;
  category: DocumentCategory;
  onCategoryChange: (category: DocumentCategory) => void;
  uploadedDocuments: PersistedDocument[];
  uploadStatus: Readonly<Record<string, 'uploading' | 'error'>>;
  uploadErrors: Readonly<Record<string, string>>;
  onUpload: (document: LocalDocument) => void;
  onRemoveUploaded: (url: string) => void;
  uploadsEnabled: boolean;
  correctionMode?: boolean;
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
        Select PDF, PNG, or JPEG evidence, then upload each file to the
        authenticated backend. Upload confirmation is separate from saving or
        {correctionMode
          ? ' resubmitting this returned request.'
          : ' submitting the claim.'}
      </p>
      <Select
        label="Document category"
        value={category}
        onChange={(event) =>
          onCategoryChange(event.target.value as DocumentCategory)
        }
      >
        {!Object.hasOwn(documentLabels, category) && (
          <option value={category}>{category}</option>
        )}
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
          hint="PDF, PNG or JPEG; up to 10 MiB per file and 10 files. The server enforces the file-size limit."
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
                  {(doc.file.size / 1024).toFixed(1)} KiB ·{' '}
                  {uploadStatus[doc.id] === 'uploading'
                    ? 'Uploading'
                    : uploadStatus[doc.id] === 'error'
                      ? 'Upload failed'
                      : 'Not uploaded'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  pending={uploadStatus[doc.id] === 'uploading'}
                  disabled={
                    !uploadsEnabled || uploadStatus[doc.id] === 'uploading'
                  }
                  aria-describedby="upload-status-note"
                  onClick={() => onUpload(doc)}
                >
                  {uploadStatus[doc.id] === 'error' ? 'Retry upload' : 'Upload'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={uploadStatus[doc.id] === 'uploading'}
                  aria-label={`Remove ${doc.file.name}`}
                  onClick={() => onRemove(doc.id)}
                >
                  Remove
                </Button>
              </div>
              {uploadErrors[doc.id] && (
                <p role="alert" className="w-full text-sm text-danger">
                  {uploadErrors[doc.id]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p id="upload-status-note" className="text-sm text-muted">
        Uploads require a signed-in lecturer session. Successfully uploaded
        references are included with the next successful{' '}
        {correctionMode
          ? 'correction save or resubmission.'
          : 'draft save or claim submission.'}
      </p>
      {uploadedDocuments.length > 0 && (
        <section
          aria-labelledby="uploaded-documents-heading"
          className="space-y-3"
        >
          <h3
            id="uploaded-documents-heading"
            className="font-semibold text-brand"
          >
            Uploaded supporting documents ({uploadedDocuments.length})
          </h3>
          <ul className="space-y-3">
            {uploadedDocuments.map((doc) => (
              <li
                key={doc.url}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-success p-4"
              >
                <div className="min-w-0 break-all">
                  <p className="font-semibold">{doc.name}</p>
                  <p className="text-sm text-muted">
                    {documentLabels[doc.documentType as DocumentCategory] ??
                      doc.documentType}{' '}
                    · Server upload confirmed ·{' '}
                    {doc.attachedToClaim
                      ? correctionMode
                        ? 'Attached to the returned request'
                        : 'Attached to the saved draft'
                      : correctionMode
                        ? 'Will be attached when corrections are saved or resubmitted'
                        : 'Will be attached on Save Draft or Submit'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${doc.name} from claim`}
                  onClick={() => onRemoveUploaded(doc.url)}
                >
                  Remove from claim
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Removing a reference detaches it from the next saved or submitted
            claim. The backend currently has no file-delete endpoint.
          </p>
        </section>
      )}
    </section>
  );
}
