interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="text-3xl font-bold text-brand">
        {title}
      </h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-slate-600">{description}</p>
      </div>
    </section>
  );
}
