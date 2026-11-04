import type { StaffProfile } from '../../auth/contracts';
import { useRequestResource } from '../requests/useRequestResource';
import { decodeAcademicOptions, semesterNumber } from './academicOptions';

export function useAcademicOptions(
  profile: StaffProfile | null,
  semester: string,
) {
  const enabled =
    profile?.role === 'LECTURER' &&
    Boolean(profile.departmentId || profile.departmentCode);
  const selectedSemester = semesterNumber(semester);
  const query: Record<string, string> = {};
  // Local personal-information edits never determine authorization or query scope.
  if (profile?.departmentId) query.departmentId = profile.departmentId;
  else if (profile?.departmentCode)
    query.departmentCode = profile.departmentCode;
  if (selectedSemester !== null) query.semester = String(selectedSemester);
  const resource = useRequestResource(
    enabled ? '/requests/paper-marking/options/form-dropdowns' : null,
    decodeAcademicOptions,
    query,
  );
  const data = resource.data;
  const departmentMismatch = Boolean(
    data?.userDepartmentCode &&
    profile?.departmentCode &&
    data.userDepartmentCode.toUpperCase() !==
      profile.departmentCode.toUpperCase(),
  );
  const courses =
    data?.coursesVerified && !departmentMismatch && selectedSemester !== null
      ? data.courseModules.filter(
          (course) => course.semester === selectedSemester,
        )
      : [];
  const courseMessage =
    selectedSemester === null
      ? 'Select a semester before choosing a course.'
      : departmentMismatch || (data && !data.coursesVerified)
        ? 'Course choices could not be verified for your department and semester. Retry or contact your administrator.'
        : resource.status === 'ready' && courses.length === 0
          ? 'No courses are available for your department and semester.'
          : '';
  return {
    ...resource,
    message: !enabled
      ? 'A verified lecturer department is required to load academic choices.'
      : resource.message,
    courses,
    courseMessage,
  };
}
