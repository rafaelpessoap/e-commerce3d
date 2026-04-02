import Link from 'next/link';
import { SITE_NAME, ROUTES } from '@/lib/constants';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <Link href={ROUTES.home} className="text-2xl font-bold mb-8">
        {SITE_NAME}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
