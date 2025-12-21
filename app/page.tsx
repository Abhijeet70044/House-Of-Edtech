"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type Item = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  category?: string | null;
  location?: string | null;
  minStock: number;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ItemPayload = Omit<Item, "id" | "createdAt" | "updatedAt">;

const INPUT_BASE =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-indigo-200";

async function jsonFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "amber" | "green" }) {
  const map = {
    gray: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-700",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = user?.role === "ADMIN";
  const canEdit = Boolean(user); // users can edit (optimistic updates enabled)

  const itemForm = useForm<ItemPayload>({
    defaultValues: {
      name: "",
      sku: "",
      quantity: 0,
      category: "",
      location: "",
      minStock: 0,
      notes: "",
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    const init = async () => {
      try {
        const data = await jsonFetch<{ user: User | null }>("/api/auth/me");
        setUser(data.user);
        await loadItems();
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadItems = async () => {
    const data = await jsonFetch<{ items: Item[] }>("/api/items");
    setItems(data.items);
  };

  const handleAuth = async (form: { email: string; password: string; name?: string }) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await jsonFetch<{ user: User }>(endpoint, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setUser(data.user);
      await loadItems();
      setActionMessage(
        mode === "login" ? "Welcome back — inventory synced." : "Account created — you are signed in.",
      );
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateItem = async (payload: ItemPayload) => {
    if (!isAdmin) {
      setActionMessage("Sign in as admin to add items.");
      return;
    }

    setSubmitting(true);
    setActionMessage(null);
    try {
      const data = await jsonFetch<{ item: Item }>("/api/items", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setItems((prev) => [data.item, ...prev]);
      itemForm.reset({ ...payload, name: "", sku: "", quantity: 0, notes: "" });
      setActionMessage("Item added.");
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : "Could not create item.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItem = async (id: string, payload: Partial<Item>) => {
    if (!canEdit) {
      setActionMessage("Sign in to update items.");
      return;
    }

    setActionMessage(null);

    // Optimistic update
    const previous = items;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...payload } : it)),
    );

    try {
      await jsonFetch(`/api/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setActionMessage("Item updated.");
    } catch (err: unknown) {
      // revert on failure
      setItems(previous);
      setActionMessage(err instanceof Error ? err.message : "Could not update item.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!isAdmin) {
      setActionMessage("Sign in as admin to delete items.");
      return;
    }

    setActionMessage(null);
    try {
      await jsonFetch(`/api/items/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      setActionMessage("Item removed.");
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : "Could not delete item.");
    }
  };

  const handleLogout = async () => {
    await jsonFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setItems([]);
  };

  const lowStockCount = useMemo(
    () => items.filter((item) => item.quantity <= item.minStock).length,
    [items],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <p className="text-sm font-medium">Loading StockPilot…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-500">StockPilot</p>
            <h1 className="text-3xl font-semibold">Inventory control without the busywork.</h1>
            <p className="text-sm text-slate-600">
              CRUD app built with Next.js 16, TypeScript, Tailwind, Prisma & JWT auth.
            </p>
          </div>
          {user ? (
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <div className="h-8 w-8 rounded-full bg-indigo-100 text-center text-sm font-semibold text-indigo-600 leading-8">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </div>
              <div className="text-sm">
                <p className="font-medium">{user.name || "Signed user"}</p>
                <p className="text-slate-500">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </header>

        {!user ? (
          <AuthPanel
            mode={mode}
            setMode={setMode}
            onSubmit={handleAuth}
            submitting={submitting}
            error={authError}
          />
        ) : (
          <main className="mt-10 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Inventory</h2>
                  <p className="text-sm text-slate-600">
                    Shared inventory list. Sign in as admin to edit.
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <Badge tone="gray">Total {items.length}</Badge>
                  <Badge tone={lowStockCount > 0 ? "amber" : "green"}>
                    {lowStockCount > 0 ? `${lowStockCount} low stock` : "All healthy"}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        canEdit={canEdit}
                        canDelete={isAdmin}
                        onDelete={() => handleDeleteItem(item.id)}
                        onUpdate={(payload) => handleUpdateItem(item.id, payload)}
                      />
                    ))}
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                          No items yet. Sign in as admin to add the first SKU.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {actionMessage ? (
                <p className="mt-3 text-sm text-emerald-700">{actionMessage}</p>
              ) : null}
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 shadow-sm">
                <h3 className="text-base font-semibold text-indigo-900">Add inventory</h3>
                <p className="text-sm text-indigo-800/80">
                  Validate SKUs, set thresholds, and track notes. Admins only for writes.
                </p>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={itemForm.handleSubmit((values) => handleCreateItem(values))}
                >
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Item name</label>
                    <input {...itemForm.register("name", { required: true })} className={INPUT_BASE} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">SKU</label>
                    <input {...itemForm.register("sku", { required: true })} className={INPUT_BASE} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Quantity</label>
                      <input
                        type="number"
                        {...itemForm.register("quantity", { valueAsNumber: true, min: 0 })}
                        className={INPUT_BASE}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Min stock</label>
                      <input
                        type="number"
                        {...itemForm.register("minStock", { valueAsNumber: true, min: 0 })}
                        className={INPUT_BASE}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Category</label>
                      <input {...itemForm.register("category")} className={INPUT_BASE} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Location</label>
                      <input {...itemForm.register("location")} className={INPUT_BASE} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Notes</label>
                    <textarea {...itemForm.register("notes")} rows={2} className={INPUT_BASE} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Status</label>
                    <select {...itemForm.register("status")} className={INPUT_BASE}>
                      <option value="ACTIVE">Active</option>
                      <option value="DISCONTINUED">Discontinued</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={!isAdmin || submitting}
                    className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    title={!isAdmin ? "Sign in as admin to add inventory" : undefined}
                  >
                    {submitting ? "Saving…" : isAdmin ? "Add item" : "Admin only"}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-900">Demo credentials</h4>
                <p className="text-sm text-slate-600">Email: demo@stockpilot.dev</p>
                <p className="text-sm text-slate-600">Password: demo1234</p>
                <p className="text-sms">Project Owner Name: Abhijeet Kumar</p>
                <p className="mt-1 text-sm">
                  GitHub: <a href="https://github.com/Abhijeet70044" className="underline text-indigo-600">https://github.com/Abhijeet70044</a>
                </p>
                <p className="mt-1 text-sm">
                  LinkedIn: <a href="https://www.linkedin.com/in/abhijeetkumar-rx" className="underline text-indigo-600">https://linkedin.com/in/abhijeetkumar-rx</a>
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Stored with bcrypt hashing. Sessions use signed JWT (httpOnly cookie).
                </p>
              </div>

            </aside>
          </main>
        )}
      </div>
    </div>
  );
}

function AuthPanel({
  mode,
  setMode,
  onSubmit,
  submitting,
  error,
}: {
  mode: "login" | "register";
  setMode: (m: "login" | "register") => void;
  onSubmit: (values: { email: string; password: string; name?: string }) => Promise<void>;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState({ email: "", password: "", name: "" });

  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-[1fr,1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">
          {mode === "login" ? "Sign in to manage inventory" : "Create your account"}
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Name</label>
              <input
                className={INPUT_BASE}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Alex Inventory"
                required
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Email</label>
            <input
              className={INPUT_BASE}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Password</label>
            <input
              className={INPUT_BASE}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Processing…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-indigo-900">What you get</h3>
        <ul className="mt-3 space-y-2 text-sm text-indigo-900/80">
          <li>• Secure JWT session stored in httpOnly cookie</li>
          <li>• Only Demo Admin role is allowed to Create, Update and Delete</li>
          <li>• Prisma-backed CRUD APIs with validation</li>
          <li>• Tailwind UI tuned for accessibility</li>
          <li>• Demo Admin user available if you want to skip registration</li>
        </ul>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <button
            onClick={() => {
              setMode("login");
              setForm({ email: "demo@stockpilot.dev", password: "demo1234", name: "" });
            }}
            className={`rounded-full px-3 py-1 font-medium ${
              mode === "login"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-indigo-700 border border-indigo-200"
            }`}
          >
            Use demo credentials
          </button>
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-indigo-700 underline decoration-indigo-300 underline-offset-4"
          >
            {mode === "login" ? "Create an account" : "I already have an account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  canEdit,
  canDelete,
  onDelete,
  onUpdate,
}: {
  item: Item;
  canEdit: boolean;
  canDelete?: boolean;
  onDelete?: () => Promise<void>;
  onUpdate: (payload: Partial<Item>) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localQty, setLocalQty] = useState(item.quantity);
  const [localMin, setLocalMin] = useState(item.minStock);
  const [localStatus, setLocalStatus] = useState(item.status);
  const low = item.quantity <= item.minStock;

  return (
    <tr className="text-sm text-slate-800">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{item.name}</div>
        <p className="text-xs text-slate-500">{item.category || "Uncategorized"}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{item.sku}</td>
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <input
            type="number"
            value={localQty}
            onChange={(e) => setLocalQty(Number(e.target.value))}
            className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm"
          />
        ) : (
          <span className={`font-semibold ${low ? "text-amber-600" : "text-slate-900"}`}>
            {item.quantity}
          </span>
        )}
        <p className="text-xs text-slate-500">Min {isEditing ? (
          <input
            type="number"
            value={localMin}
            onChange={(e) => setLocalMin(Number(e.target.value))}
            className="ml-1 w-16 rounded border border-slate-200 px-2 py-1 text-right text-xs"
          />
        ) : (
          item.minStock
        )}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{item.location || "—"}</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            value={localStatus}
            onChange={(e) => setLocalStatus(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="DISCONTINUED">Discontinued</option>
          </select>
        ) : (
          <Badge tone={item.status === "ACTIVE" ? "green" : "gray"}>
            {item.status === "ACTIVE" ? "Active" : "Discontinued"}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right text-xs text-slate-600">
        {!canEdit ? (
          <span className="text-slate-400">View only</span>
        ) : isEditing ? (
          <div className="flex items-center justify-end gap-2">
            <button
              className="rounded border border-slate-200 px-3 py-1 font-medium text-slate-700"
              onClick={() => {
                setIsEditing(false);
                setLocalQty(item.quantity);
                setLocalMin(item.minStock);
                setLocalStatus(item.status);
              }}
            >
              Cancel
            </button>
            <button
              className="rounded bg-indigo-600 px-3 py-1 font-semibold text-white shadow-sm"
              onClick={async () => {
                await onUpdate({
                  quantity: localQty,
                  minStock: localMin,
                  status: localStatus,
                });
                setIsEditing(false);
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <button
              className="text-indigo-600 underline decoration-indigo-200 underline-offset-4"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
            {canDelete ? (
              <button
                className="text-rose-600 underline decoration-rose-200 underline-offset-4"
                onClick={() => {
                  const ok = confirm(`Delete ${item.name}?`);
                  if (ok && onDelete) onDelete();
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}
