import { redirect } from "next/navigation";
import { createLocalSession, type ProjectRole } from "@/lib/auth/session";

type SignInPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Sign In</h1>
        <p className="mt-2 text-sm text-slate-600">
          Local auth scaffold for post-onboarding routes.
        </p>
        <form action={signInAction} className="mt-6 space-y-4">
          <input name="next" type="hidden" value={next ?? ""} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              User ID
            </span>
            <input
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
              defaultValue="user_001"
              name="userId"
              type="text"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Role
            </span>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
              defaultValue="user"
              name="role"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Project ID
            </span>
            <input
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
              defaultValue="demo-project"
              name="projectId"
              type="text"
            />
          </label>
          <button
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            type="submit"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}

async function signInAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") ?? "").trim();
  const rawRole = String(formData.get("role") ?? "user");
  const projectId = String(formData.get("projectId") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();
  const role: ProjectRole = rawRole === "admin" ? "admin" : "user";

  if (!userId || !projectId) {
    redirect("/sign-in");
  }

  await createLocalSession({ userId, role, projectId });

  const safeNext = next.startsWith("/") ? next : "";
  redirect(safeNext || `/projects/${projectId}`);
}
