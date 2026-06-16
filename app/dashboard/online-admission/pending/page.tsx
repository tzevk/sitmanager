import { redirect } from 'next/navigation';

export default function PendingAdmissionRedirect() {
  redirect('/dashboard/online-admission');
}
