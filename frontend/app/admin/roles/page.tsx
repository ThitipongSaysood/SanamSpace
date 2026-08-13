"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, ShieldCheck } from "lucide-react";
import type { AdminPermission, AdminRole } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const KEY = ["admin", "roles"];

export default function AdminRolesPage() {
  const t = useMessages("admin").roles;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: superAdminApi.getRoles });
  const { data: permissions } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: superAdminApi.getPermissions,
  });

  const [editing, setEditing] = useState<AdminRole | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={t.empty} />}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => r.editable && setEditing(r)}
              disabled={!r.editable}
              className={`rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition ${
                r.editable ? "hover:ring-brand/30 active:scale-[0.99]" : "cursor-default"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                  <ShieldCheck className="size-5" />
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    r.isSystemRole ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.scope}
                </span>
              </div>
              <div className="mt-3 font-semibold">{r.name}</div>
              {r.description && <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>}

              {r.editable ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{interp(t.permCount, { n: r.permissionCount })}</span>
                  <span className="text-xs font-medium text-brand">{t.editPerms}</span>
                </div>
              ) : (
                // The two roles that bypass every check. Saying so beats an
                // editor that silently refuses to save.
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" /> {t.alwaysAll}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {editing && permissions && (
        <PermissionEditor
          role={editing}
          permissions={permissions}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: KEY })}
        />
      )}
    </div>
  );
}

function PermissionEditor({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: AdminRole;
  permissions: AdminPermission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useMessages("admin").roles;
  const [selected, setSelected] = useState<string[]>(role.permissionIds);

  const grouped = useMemo(() => {
    const byModule = new Map<string, AdminPermission[]>();
    for (const p of permissions) {
      const list = byModule.get(p.module) ?? [];
      list.push(p);
      byModule.set(p.module, list);
    }
    return [...byModule.entries()];
  }, [permissions]);

  const save = useMutation({
    mutationFn: () => superAdminApi.updateRolePermissions(role.id, selected),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Modal
      title={interp(t.editorTitle, { name: role.name })}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted-foreground">
            {save.isError ? (
              <span className="text-brand-danger">{(save.error as Error).message}</span>
            ) : (
              interp(t.selectedCount, { n: selected.length, total: permissions.length })
            )}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="rounded-xl bg-app p-3 text-xs text-muted-foreground">
          {t.editorNotePre}<strong>{t.editorNoteBold}</strong>{t.editorNotePost}
        </p>

        {grouped.map(([module, items]) => (
          <section key={module} className="space-y-2">
            <h3 className="text-sm font-semibold">{(t.moduleLabels as Record<string, string>)[module] ?? module}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-input p-3 transition hover:bg-app"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className="mt-0.5 size-4 accent-[var(--brand-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{p.code}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
