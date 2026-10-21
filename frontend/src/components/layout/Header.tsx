export function Header({ workspaceLabel }: { workspaceLabel: string }) {
  return (
    <header className="flex min-h-18 items-center border-b border-slate-200 bg-white px-6 py-5 text-sm text-brand md:px-9">
      University of Ruhuna / {workspaceLabel}
    </header>
  );
}
