import { redirect } from 'next/navigation';

/** Climate monitoring was consolidated into House Management. */
export default function ClimateRedirectPage() {
  redirect('/dashboard/houses');
}
