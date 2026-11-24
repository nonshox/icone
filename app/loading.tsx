import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-6 py-10"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-56 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </main>
  );
}
