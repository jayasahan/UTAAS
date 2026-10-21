import { useCallback, useRef, useState } from 'react';
import type { StaffProfile } from '../../auth/contracts';
import { createForm, createPaper } from './model';
import type {
  AcademicInformation,
  DocumentCategory,
  FieldError,
  PaperRow,
  PersonalInformation,
} from './model';
import { MAX_DOCUMENTS, validateFile, validateStep } from './validation';

export function useClaimForm() {
  const [form, setForm] = useState(createForm);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [quantityReentry, setQuantityReentry] = useState<string[]>([]);
  const nextId = useRef(2);
  const editedPersonal = useRef(new Set<keyof PersonalInformation>());
  const applyProfile = useCallback((profile: StaffProfile | null) => {
    setForm((old) => {
      const personal = { ...old.personal };
      if (!editedPersonal.current.has('fullName'))
        personal.fullName = profile?.fullName ?? '';
      if (!editedPersonal.current.has('department'))
        personal.department = profile?.departmentCode ?? '';
      if (
        personal.fullName === old.personal.fullName &&
        personal.department === old.personal.department
      )
        return old;
      return { ...old, personal, declaration: false };
    });
  }, []);
  const changed = () => setErrors([]);
  function updatePersonal(key: keyof PersonalInformation, value: string) {
    editedPersonal.current.add(key);
    setForm((old) => ({
      ...old,
      declaration: false,
      personal: { ...old.personal, [key]: value },
    }));
    changed();
  }
  function updateAcademic(key: keyof AcademicInformation, value: string) {
    setForm((old) => ({
      ...old,
      declaration: false,
      academic: { ...old.academic, [key]: value },
    }));
    changed();
  }
  function updatePaper(
    id: string,
    key: keyof Omit<PaperRow, 'id'>,
    value: string,
  ) {
    const current = form.papers.find((row) => row.id === id);
    if (key === 'assessmentUnit') {
      if (!current || current.assessmentUnit === value) return;
      setQuantityReentry((old) => [
        ...new Set([...old, `${id}-assessmentQuantity`]),
      ]);
      setAnnouncement(
        'Assessment unit changed. Enter a new quantity in the selected unit.',
      );
    }
    setForm((old) => ({
      ...old,
      declaration: false,
      papers: old.papers.map((row) =>
        row.id === id
          ? {
              ...row,
              [key]: value,
              ...(key === 'assessmentUnit' ? { assessmentQuantity: '' } : {}),
            }
          : row,
      ),
    }));
    changed();
  }
  function addPaper() {
    const id = `paper-${nextId.current++}`;
    setForm((old) => ({
      ...old,
      declaration: false,
      papers: [...old.papers, createPaper(id)],
    }));
    setAnnouncement('Paper row added.');
    changed();
    return `${id}-title`;
  }
  function removePaper(id: string) {
    setQuantityReentry((old) =>
      old.filter((field) => field !== `${id}-assessmentQuantity`),
    );
    setForm((old) => ({
      ...old,
      declaration: false,
      papers: old.papers.filter((row) => row.id !== id),
    }));
    setAnnouncement('Paper row removed.');
    changed();
  }
  function selectDocuments(files: File[], category: DocumentCategory) {
    const failures: string[] = [];
    const selected = [...form.documents];
    for (const file of files) {
      const problem = validateFile(file);
      if (problem) {
        failures.push(`${file.name}: ${problem}`);
        continue;
      }
      if (
        selected.some(
          (doc) =>
            doc.file.name === file.name &&
            doc.file.size === file.size &&
            doc.file.lastModified === file.lastModified,
        )
      ) {
        failures.push(`${file.name}: already selected.`);
        continue;
      }
      if (selected.length >= MAX_DOCUMENTS) {
        failures.push('Select no more than 10 documents.');
        continue;
      }
      selected.push({ id: `document-${nextId.current++}`, file, category });
    }
    setForm((old) => ({ ...old, declaration: false, documents: selected }));
    setFileErrors(failures);
    changed();
    setAnnouncement(
      `${selected.length} documents locally selected; none uploaded.`,
    );
  }
  function removeDocument(id: string) {
    setForm((old) => ({
      ...old,
      declaration: false,
      documents: old.documents.filter((doc) => doc.id !== id),
    }));
    setFileErrors([]);
    changed();
    setAnnouncement('Local document removed.');
  }
  const restore = useCallback(
    (saved: Omit<ReturnType<typeof createForm>, 'documents'>) => {
      setForm((old) => ({ ...old, ...saved, documents: [] }));
      editedPersonal.current = new Set(
        Object.keys(saved.personal) as (keyof PersonalInformation)[],
      );
      nextId.current = Math.max(
        2,
        ...saved.papers.map((_, index) => index + 2),
      );
      setErrors([]);
      setStep(0);
    },
    [],
  );
  function navigate(target: number): boolean {
    if (target > step) {
      const found = Array.from({ length: target }, (_, index) =>
        validateStep(form, index),
      ).flat();
      if (found.length) {
        // Keep summary links on the first invalid, visible step.
        setErrors(found.filter((error) => error.step === found[0]!.step));
        setStep(found[0]!.step);
        return false;
      }
    }
    setErrors([]);
    setStep(target);
    return true;
  }
  return {
    form,
    restore,
    applyProfile,
    step,
    errors,
    fileErrors,
    // Inline revalidation after a unit change; summary focus stays reserved for navigation/validation.
    quantityErrors: validateStep(form, 1).filter((error) =>
      quantityReentry.includes(error.field),
    ),
    announcement,
    setErrors,
    updatePersonal,
    updateAcademic,
    updatePaper,
    addPaper,
    removePaper,
    selectDocuments,
    removeDocument,
    setDocumentCategory: (selectedDocumentCategory: DocumentCategory) =>
      setForm((old) => ({ ...old, selectedDocumentCategory })),
    navigate,
    setDeclaration: (declaration: boolean) => {
      setForm((old) => ({ ...old, declaration }));
      changed();
    },
  };
}
