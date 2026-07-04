"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import {
  ASSET_CLASSES,
  ASSET_CLASS_META,
  assetClassLabel,
  type AssetInput,
  type AssetView,
} from "@/lib/assets/schema";
import { formatMoney } from "@/lib/format";
import type { AssetClass } from "@/lib/market-snapshot";
import { cn } from "@/lib/utils";

/**
 * The /assets flat ledger (PRD 3.2, S9): search / filter / add / edit / delete
 * the raw holdings independent of the dashboard cards. Self-contained like
 * the alert form: it reads its seed from the server page and writes /api/assets
 * directly, optimistically reconciling its own list on success.
 */

type Filter = AssetClass | "all";

interface FormState {
  name: string;
  assetClass: AssetClass;
  symbol: string;
  quantity: string;
  unit: string;
  purchasePrice: string;
  purchaseCurrency: string;
  purchasedAt: string;
  note: string;
}

function emptyForm(): FormState {
  return {
    name: "",
    assetClass: "stocks",
    symbol: "",
    quantity: "1",
    unit: "",
    purchasePrice: "",
    purchaseCurrency: "SAR",
    purchasedAt: "",
    note: "",
  };
}

function formFrom(asset: AssetView): FormState {
  return {
    name: asset.name,
    assetClass: asset.assetClass,
    symbol: asset.symbol ?? "",
    quantity: String(asset.quantity),
    unit: asset.unit ?? "",
    purchasePrice: asset.purchasePrice != null ? String(asset.purchasePrice) : "",
    purchaseCurrency: asset.purchaseCurrency,
    purchasedAt: asset.purchasedAt ?? "",
    note: asset.note ?? "",
  };
}

function toInput(form: FormState): AssetInput {
  const quantity = Number(form.quantity);
  const price = Number(form.purchasePrice);
  return {
    name: form.name.trim(),
    assetClass: form.assetClass,
    symbol: form.symbol.trim() || null,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit: form.unit.trim() || null,
    purchasePrice:
      form.purchasePrice.trim() !== "" && Number.isFinite(price) && price >= 0
        ? price
        : null,
    purchaseCurrency: form.purchaseCurrency.trim().toUpperCase() || "SAR",
    purchasedAt: form.purchasedAt.trim() || null,
    note: form.note.trim() || null,
  };
}

export function AssetTable({
  initialAssets,
  canUse,
}: {
  initialAssets: AssetView[];
  canUse: boolean;
}) {
  const [assets, setAssets] = useState<AssetView[]>(initialAssets);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // null = closed; "new" = add form; otherwise the id being edited.
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: assets.length,
      stocks: 0,
      real_estate: 0,
      autos: 0,
      jewelry: 0,
    };
    for (const a of assets) c[a.assetClass] += 1;
    return c;
  }, [assets]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (filter !== "all" && a.assetClass !== filter) return false;
      if (q === "") return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.symbol?.toLowerCase().includes(q) ?? false) ||
        (a.note?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [assets, query, filter]);

  function openAdd() {
    setForm({ ...emptyForm(), assetClass: filter === "all" ? "stocks" : filter });
    setError(null);
    setEditing("new");
  }

  function openEdit(asset: AssetView) {
    setForm(formFrom(asset));
    setError(null);
    setEditing(asset.id);
  }

  function closeForm() {
    setEditing(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.name.trim() === "") {
      setError("Give the holding a name.");
      return;
    }
    const input = toInput(form);
    setSaving(true);
    setError(null);
    try {
      if (editing === "new") {
        const res = await fetch("/api/assets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = (await res.json().catch(() => null)) as {
          id?: string;
          error?: string;
        } | null;
        if (!res.ok || !body?.id) {
          throw new Error(body?.error ?? "Could not save the holding.");
        }
        const now = nowSqlite();
        setAssets((prev) => [
          { ...input, id: body.id as string, createdAt: now, updatedAt: now },
          ...prev,
        ]);
      } else if (editing) {
        const res = await fetch(`/api/assets/${editing}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!res.ok) throw new Error(body?.error ?? "Could not update the holding.");
        setAssets((prev) =>
          prev.map((a) =>
            a.id === editing ? { ...a, ...input, updatedAt: nowSqlite() } : a
          )
        );
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the holding.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(asset: AssetView) {
    const snapshot = assets;
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    if (editing === asset.id) closeForm();
    const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    if (!res.ok) setAssets(snapshot);
  }

  return (
    <div className="flex-1 overflow-y-auto px-gutter py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="section-title text-headline-md">Assets</h1>
          <p className="mt-4 max-w-xl text-body-md text-on-surface-variant">
            Your unified ledger. Every holding the agent reasons about lives
            here, independent of which cards you keep on the dashboard.
          </p>
        </header>

        {!canUse && (
          <p
            role="status"
            className="glass px-5 py-4 text-center text-body-md text-warning-orange"
          >
            Sign in with Google to add and edit holdings.
          </p>
        )}

        {/* Toolbar: search + class filter + add */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex flex-1 items-center">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 text-on-surface-variant"
                style={{ fontSize: 14 }}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, symbol, or note"
                aria-label="Search holdings"
                className="w-full rounded-lg border border-outline-variant bg-surface-container py-2.5 pl-9 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={openAdd}
              disabled={!canUse}
              className={cn(
                "btn-primary shrink-0 rounded-lg px-5 py-2.5 text-label-md",
                !canUse && "cursor-not-allowed opacity-60"
              )}
            >
              <Icon name="add" style={{ fontSize: 16 }} />
              Add holding
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All"
              count={counts.all}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {ASSET_CLASSES.map((c) => (
              <FilterChip
                key={c}
                label={assetClassLabel(c)}
                icon={ASSET_CLASS_META[c].icon}
                count={counts[c]}
                active={filter === c}
                onClick={() => setFilter(c)}
              />
            ))}
          </div>
        </div>

        {/* Add form (edit forms render inline in the list) */}
        {editing === "new" && (
          <AssetForm
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            saving={saving}
            error={error}
            title="New holding"
          />
        )}

        {/* Ledger */}
        {visible.length === 0 ? (
          <p className="glass px-6 py-10 text-center text-body-md text-on-surface-variant">
            {assets.length === 0
              ? "No holdings yet. Add your first to give the agent something to track."
              : "No holdings match this search."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((asset) =>
              editing === asset.id ? (
                <li key={asset.id}>
                  <AssetForm
                    form={form}
                    setForm={setForm}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                    saving={saving}
                    error={error}
                    title={`Edit ${asset.name}`}
                  />
                </li>
              ) : (
                <li key={asset.id}>
                  <AssetRow
                    asset={asset}
                    onEdit={() => openEdit(asset)}
                    onDelete={() => remove(asset)}
                    canUse={canUse}
                  />
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  icon,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-label-md transition-colors",
        active
          ? "border-primary text-primary"
          : "border-outline-variant text-on-surface-variant hover:border-primary/50 hover:text-on-surface"
      )}
    >
      {icon && <Icon name={icon} style={{ fontSize: 13 }} />}
      {label}
      <span className="text-label-sm text-on-surface-variant">{count}</span>
    </button>
  );
}

function AssetRow({
  asset,
  onEdit,
  onDelete,
  canUse,
}: {
  asset: AssetView;
  onEdit: () => void;
  onDelete: () => void;
  canUse: boolean;
}) {
  const meta = ASSET_CLASS_META[asset.assetClass];
  return (
    <div className="glass flex items-center gap-4 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-purple-tint text-primary">
        <Icon name={meta.icon} style={{ fontSize: 16 }} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-body-md font-semibold text-on-surface">
          {asset.name}
          {asset.symbol && (
            <span className="rounded-full border border-outline-variant px-2 py-0.5 font-mono text-xs font-medium text-on-surface-variant">
              {asset.symbol}
            </span>
          )}
        </p>
        <p className="truncate text-label-md text-on-surface-variant">
          {meta.label} · {formatQuantity(asset)}
          {asset.note ? ` · ${asset.note}` : ""}
        </p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-body-md font-semibold text-on-surface">
          {asset.purchasePrice != null
            ? formatMoney(asset.purchasePrice, asset.purchaseCurrency)
            : "not set"}
        </p>
        <p className="text-label-sm text-on-surface-variant">
          {asset.purchasedAt ? `bought ${asset.purchasedAt}` : "cost basis"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={!canUse}
          title="Edit"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors",
            canUse ? "hover:bg-surface-container hover:text-primary" : "opacity-40"
          )}
        >
          <Icon name="build" style={{ fontSize: 13 }} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canUse}
          title="Delete"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors",
            canUse ? "hover:bg-error-container hover:text-error" : "opacity-40"
          )}
        >
          <Icon name="delete" style={{ fontSize: 13 }} />
        </button>
      </div>
    </div>
  );
}

function AssetForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  error,
  title,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  title: string;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const unitHint = ASSET_CLASS_META[form.assetClass].unitHint;

  return (
    <form onSubmit={onSubmit} className="glass flex flex-col gap-4 p-6 animate-fade-up">
      <h2 className="text-headline-md font-semibold text-on-surface">{title}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="asset-name">
          <input
            id="asset-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Aramco, Land Cruiser, King Abdullah Rd flat"
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label="Asset class" htmlFor="asset-class">
          <select
            id="asset-class"
            value={form.assetClass}
            onChange={(e) => set("assetClass", e.target.value as AssetClass)}
            className={inputClass}
          >
            {ASSET_CLASSES.map((c) => (
              <option key={c} value={c}>
                {assetClassLabel(c)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Symbol / ticker (optional)" htmlFor="asset-symbol">
          <input
            id="asset-symbol"
            value={form.symbol}
            onChange={(e) => set("symbol", e.target.value)}
            placeholder="2222, XAU, …"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor="asset-qty">
            <input
              id="asset-qty"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Unit" htmlFor="asset-unit">
            <input
              id="asset-unit"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              placeholder={unitHint}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Purchase price (optional)" htmlFor="asset-price">
            <input
              id="asset-price"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={form.purchasePrice}
              onChange={(e) => set("purchasePrice", e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </Field>
          <Field label="Currency" htmlFor="asset-currency">
            <input
              id="asset-currency"
              value={form.purchaseCurrency}
              onChange={(e) => set("purchaseCurrency", e.target.value)}
              maxLength={3}
              className={cn(inputClass, "w-20 uppercase")}
            />
          </Field>
        </div>

        <Field label="Purchase date (optional)" htmlFor="asset-date">
          <input
            id="asset-date"
            type="date"
            value={form.purchasedAt}
            onChange={(e) => set("purchasedAt", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Notes / identifiers (optional)" htmlFor="asset-note">
          <input
            id="asset-note"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="VIN, deed no., hallmark…"
            className={inputClass}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-label-md text-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className={cn(
            "btn-primary rounded-lg px-5 py-2.5 text-label-md",
            saving && "cursor-wait opacity-60"
          )}
        >
          <Icon
            name={saving ? "sync" : "check"}
            className={cn(saving && "animate-spin motion-reduce:animate-none")}
            style={{ fontSize: 15 }}
          />
          {saving ? "Saving…" : "Save holding"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-glass rounded-lg px-5 py-2.5 text-label-md"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none";

function formatQuantity(asset: AssetView): string {
  const qty = asset.quantity.toLocaleString("en-US");
  return asset.unit ? `${qty} ${asset.unit}` : qty;
}

/** SQLite UTC shape for optimistic rows, matching server timestamps. */
function nowSqlite(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
