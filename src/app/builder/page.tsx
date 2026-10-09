import { redirect } from 'next/navigation';

export default function BuilderFallbackPage() {
  // If user accesses /builder directly without parameters, redirect to library
  redirect('/');
}
