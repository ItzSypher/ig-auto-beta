import Link from "next/link";

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-neutral-700">{children}</p>;
}

export function UL({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-neutral-700">
      {items.map((it) => (
        <li key={it}>{it}</li>
      ))}
    </ul>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <Link
        href="/"
        className="text-[13px] text-neutral-500 underline hover:text-neutral-900"
      >
        ← IG Auto
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">
        {title}
      </h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Última atualização: {updated}
      </p>
      <div className="mt-8 space-y-8">{children}</div>
    </div>
  );
}
