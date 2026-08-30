"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { TransactionFilter } from "@/lib/transactions/filters";
import {
  applyFilterToParams,
  createPreset,
  describeFilter,
  filterFromSearchParams,
  findActivePreset,
  isDuplicatePresetName,
  isFilterEmpty,
  isStorageAvailable,
  loadPresets,
  normalizePresetName,
  savePresets,
  type FilterPreset,
} from "@/lib/transactions/presets";

const MAX_NAME_LENGTH = 40;

const inputClassName =
  "px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500";

interface FilterPresetsProps {
  /** Optional storage override — tests and SSR-safe callers can pass their own. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}

export default function FilterPresets({ storage }: FilterPresetsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Presets are read after mount so the server-rendered markup (which has no
  // access to localStorage) always matches the first client render.
  useEffect(() => {
    setStorageEnabled(isStorageAvailable(storage));
    setPresets(loadPresets(storage));
  }, [storage]);

  useEffect(() => {
    if (isCreating) createInputRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const currentFilter = useMemo<TransactionFilter>(
    () => filterFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const activePreset = useMemo(
    () => findActivePreset(presets, currentFilter),
    [presets, currentFilter]
  );

  const persist = useCallback(
    (next: FilterPreset[]) => {
      setPresets(next);
      const written = savePresets(next, storage);
      setStorageEnabled(written);
      return written;
    },
    [storage]
  );

  const resetCreateForm = useCallback(() => {
    setIsCreating(false);
    setDraftName("");
    setError(null);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue("");
    setError(null);
  }, []);

  const handleApply = useCallback(
    (preset: FilterPreset) => {
      const params = applyFilterToParams(
        new URLSearchParams(searchParams.toString()),
        preset.filter
      );
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
      setStatus(`Applied preset "${preset.name}".`);
      setError(null);
    },
    [pathname, router, searchParams]
  );

  const handleCreate = useCallback(() => {
    const name = normalizePresetName(draftName);

    if (!name) {
      setError("Enter a name for this preset.");
      return;
    }
    if (isFilterEmpty(currentFilter)) {
      setError("Apply at least one filter before saving a preset.");
      return;
    }
    if (isDuplicatePresetName(presets, name)) {
      setError(`A preset named "${name}" already exists.`);
      return;
    }

    const preset = createPreset(name, currentFilter);
    const written = persist([...presets, preset]);
    resetCreateForm();
    setStatus(
      written
        ? `Saved preset "${preset.name}".`
        : `Saved preset "${preset.name}" for this session only.`
    );
  }, [currentFilter, draftName, persist, presets, resetCreateForm]);

  const handleRename = useCallback(
    (preset: FilterPreset) => {
      const name = normalizePresetName(renameValue);

      if (!name) {
        setError("Enter a name for this preset.");
        return;
      }
      if (isDuplicatePresetName(presets, name, preset.id)) {
        setError(`A preset named "${name}" already exists.`);
        return;
      }

      persist(presets.map((item) => (item.id === preset.id ? { ...item, name } : item)));
      cancelRename();
      setStatus(`Renamed preset to "${name}".`);
    },
    [cancelRename, persist, presets, renameValue]
  );

  const handleDelete = useCallback(
    (preset: FilterPreset) => {
      persist(presets.filter((item) => item.id !== preset.id));
      setStatus(`Deleted preset "${preset.name}".`);
      setError(null);
    },
    [persist, presets]
  );

  const handleFormKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    onSubmit: () => void,
    onCancel: () => void
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <section
      aria-labelledby="filter-presets-heading"
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="filter-presets-heading"
          className="flex items-center gap-2 text-sm font-semibold text-gray-700"
        >
          <Bookmark size={16} aria-hidden="true" />
          Saved filters
        </h2>

        {!isCreating && (
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setError(null);
            }}
            className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            Save current filters
          </button>
        )}
      </div>

      {isCreating && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="preset-name" className="text-xs font-semibold text-gray-500">
            Preset name
          </label>
          <input
            id="preset-name"
            ref={createInputRef}
            type="text"
            value={draftName}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Borrows last 30 days"
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => handleFormKeyDown(event, handleCreate, resetCreateForm)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "filter-presets-error" : undefined}
            className={inputClassName}
          />
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-1 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-md transition-colors"
          >
            <Check size={16} aria-hidden="true" />
            Save preset
          </button>
          <button
            type="button"
            onClick={resetCreateForm}
            className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md transition-colors"
          >
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
        </div>
      )}

      {presets.length === 0 ? (
        <p className="text-sm text-gray-500">
          No saved presets yet. Set up filters, then save them for one-click reuse.
        </p>
      ) : (
        <ul role="list" aria-label="Saved filter presets" className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const isActive = activePreset?.id === preset.id;
            const isRenaming = renamingId === preset.id;

            return (
              <li
                key={preset.id}
                className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 pl-1 pr-1"
              >
                {isRenaming ? (
                  <>
                    <label htmlFor={`preset-rename-${preset.id}`} className="sr-only">
                      Rename preset {preset.name}
                    </label>
                    <input
                      id={`preset-rename-${preset.id}`}
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      maxLength={MAX_NAME_LENGTH}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) =>
                        handleFormKeyDown(event, () => handleRename(preset), cancelRename)
                      }
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "filter-presets-error" : undefined}
                      className={`${inputClassName} w-45`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(preset)}
                      aria-label={`Save new name for ${preset.name}`}
                      className="p-1.5 rounded-full text-gray-500 hover:text-primary-700 hover:bg-white transition-colors"
                    >
                      <Check size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      aria-label={`Cancel renaming ${preset.name}`}
                      className="p-1.5 rounded-full text-gray-500 hover:text-gray-800 hover:bg-white transition-colors"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApply(preset)}
                      aria-current={isActive ? "true" : undefined}
                      title={describeFilter(preset.filter)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary-600 text-white"
                          : "text-gray-700 hover:bg-white"
                      }`}
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(preset.id);
                        setRenameValue(preset.name);
                        setError(null);
                      }}
                      aria-label={`Rename preset ${preset.name}`}
                      className="p-1.5 rounded-full text-gray-500 hover:text-primary-700 hover:bg-white transition-colors"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(preset)}
                      aria-label={`Delete preset ${preset.name}`}
                      className="p-1.5 rounded-full text-gray-500 hover:text-red-600 hover:bg-white transition-colors"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!storageEnabled && (
        <p className="text-xs text-amber-700">
          Browser storage is unavailable, so presets last only for this session.
        </p>
      )}

      {error && (
        <p id="filter-presets-error" role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <span aria-live="polite" className="sr-only">
        {status}
      </span>
    </section>
  );
}
