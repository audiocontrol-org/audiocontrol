export function ProgramPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Program Editor</h1>
      <p className="text-sampler-muted">
        Create and edit programs — add keygroups, assign samples, set key and velocity ranges, and tune per-zone parameters.
      </p>
    </div>
  );
}
