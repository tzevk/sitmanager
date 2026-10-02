import { redirect } from 'next/navigation';

/** Assignments now live on the Tests page (assignment tests, unit tests, final exams). */
export default function StudentAssignmentsPage() {
  redirect('/student-portal/dashboard/tests');
}
