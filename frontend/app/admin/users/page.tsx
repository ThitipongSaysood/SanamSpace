"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { AdminUser } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { RowActions, rowAction } from "@/components/ui/row-action";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

function fmtDate(iso: string | null, locale: Locale) {
  return iso ? new Date(iso).toLocaleDateString(intlLocale(locale)) : "—";
}

const selectClass =
  "h-9 rounded-lg border border-input bg-white px-2.5 text-sm text-muted-foreground outline-none focus-visible:border-ring";

const KEY = ["admin", "users"];

export default function AdminUsersPage() {
  const t = useMessages("admin").users;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: superAdminApi.getUsers,
  });
  const [role, setRole] = useState("all");
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);

  const roles = useMemo(() => [...new Set((data ?? []).map((u) => u.role))], [data]);
  const rows = (data ?? []).filter((u) => role === "all" || u.role === role);
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
            <option value="all">{t.allRoles}</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> {t.addUser}
          </Button>
        </div>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && rows.length === 0 && <EmptyState message={t.empty} />}

      {data && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[720px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t.colUser}</th>
                  <th className="px-4 py-3">{t.colEmail}</th>
                  <th className="px-4 py-3">{t.colRole}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                  <th className="px-4 py-3">{t.colJoined}</th>
                  <th className="px-4 py-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((u) => (
                  <UserRow key={u.id} user={u} onEdit={() => setEditing(u)} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <UserEditor
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function UserRow({
  user,
  onEdit,
  onChanged,
}: {
  user: AdminUser;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const t = useMessages("admin").users;
  const { locale } = useLocale();
  const suspended = user.status === "suspended";

  const toggle = useMutation({
    mutationFn: () => (suspended ? superAdminApi.activateUser(user.id) : superAdminApi.suspendUser(user.id)),
    onSuccess: onChanged,
  });

  return (
    <tr className={`hover:bg-app/60 ${suspended ? "opacity-60" : ""}`}>
      <td data-label={t.colUser} className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
            {user.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="font-medium">{user.name}</span>
        </div>
      </td>
      <td data-label={t.colEmail} className="px-4 py-3 text-muted-foreground">{user.email}</td>
      <td data-label={t.colRole} className="px-4 py-3">
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{user.role}</span>
      </td>
      <td data-label={t.colStatus} className="px-4 py-3">
        {suspended ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-rose-600">
            <span className="size-2 rounded-full bg-rose-500" /> {t.suspended}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <span className="size-2 rounded-full bg-emerald-500" /> {t.active}
          </span>
        )}
      </td>
      <td data-label={t.colJoined} className="px-4 py-3 text-muted-foreground">{fmtDate(user.createdAt, locale)}</td>
      <td data-actions className="px-4 py-3">
        <RowActions>
          <button type="button" onClick={onEdit} className={rowAction()}>
            {t.edit}
          </button>
          {/* Suspend rather than delete: the account keeps its name on the
              payments it approved and the tickets it answered. */}
          <button
            type="button"
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            className={rowAction(suspended ? "on" : "off", suspended ? "" : "hover:text-brand-danger")}
          >
            {toggle.isPending ? "..." : suspended ? t.restore : t.suspend}
          </button>
        </RowActions>
        {toggle.isError && (
          <div className="mt-1 text-right text-xs text-brand-danger">
            {(toggle.error as Error).message}
          </div>
        )}
      </td>
    </tr>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useMessages("admin").users;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: () =>
      user
        ? superAdminApi.updateUser(user.id, { name, email, password: password || null })
        : superAdminApi.createUser({ name, email, password }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const valid = name.trim() && email.trim() && (user || password.length >= 8);

  return (
    <Modal
      title={user ? t.editTitle : t.addTitle}
      onClose={onClose}
      footer={
        <>
          {save.isError && (
            <span className="mr-auto self-center text-sm text-brand-danger">
              {(save.error as Error).message}
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="u-name">{t.nameLabel}</Label>
          <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-email">{t.emailLabel}</Label>
          <Input
            id="u-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-password">{t.passwordLabel}{user && t.passwordEditSuffix}</Label>
          <Input
            id="u-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={user ? t.passwordPhEdit : t.passwordPhNew}
          />
          {!user && password.length > 0 && password.length < 8 && (
            <p className="text-xs text-brand-danger">{t.passwordTooShort}</p>
          )}
        </div>
        <p className="rounded-xl bg-app p-3 text-xs text-muted-foreground">
          {t.notePre}<strong>{t.noteBold}</strong>{t.notePost}
        </p>
      </div>
    </Modal>
  );
}
