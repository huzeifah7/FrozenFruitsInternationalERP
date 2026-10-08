import { redirect } from 'next/navigation';

export default function DashboardIndexPage() {
  // Primary redirect is handled at the root level to avoid conflicts.
  redirect('/overview');
}
