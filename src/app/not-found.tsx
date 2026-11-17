import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center px-8 text-center">
      <p className="text-[48px] font-bold text-primary">404</p>
      <h1 className="text-[20px] font-bold">Səhifə tapılmadı</h1>
      <Link href="/" className="mt-5 rounded-2xl bg-primary px-5 py-3 font-semibold text-white">Əsas səhifəyə qayıt</Link>
    </div>
  );
}
