"use client";

import { useEffect, useState, FormEvent } from "react";

interface ProfileData {
    displayName: string;
    bio: string;
    website: string;
    timezone: string;
}

type FieldErrors = Partial<Record<keyof ProfileData, string>>;

const TIMEZONES = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
];

export default function DisplayProfileForm() {
    const [form, setForm] = useState<ProfileData>({
        displayName: "",
        bio: "",
        website: "",
        timezone: "UTC",
    });

    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
    const [globalError, setGlobalError] = useState<string>("");

    // Load profile on mount
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/account/profile");
                if (res.status === 401) {
                    setGlobalError("You must be signed in to view your profile.");
                    setStatus("error");
                    return;
                }
                if (!res.ok) throw new Error("Failed to load profile");
                const data: ProfileData = await res.json();
                setForm({
                    displayName: data.displayName ?? "",
                    bio: data.bio ?? "",
                    website: data.website ?? "",
                    timezone: data.timezone ?? "UTC",
                });
                setStatus("idle");
            } catch {
                setGlobalError("Could not load your profile. Please try again.");
                setStatus("error");
            }
        }
        load();
    }, []);

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        // Clear field error on change
        setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setStatus("saving");
        setGlobalError("");
        setFieldErrors({});

        try {
            const res = await fetch("/api/account/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (res.status === 401) {
                setGlobalError("Your session has expired. Please sign in again.");
                setStatus("error");
                return;
            }

            if (res.status === 422) {
                const json = await res.json();
                setFieldErrors(json.errors ?? {});
                setStatus("idle");
                return;
            }

            if (!res.ok) throw new Error("Unexpected error");

            setStatus("saved");
            setTimeout(() => setStatus("idle"), 3000);
        } catch {
            setGlobalError("Failed to save profile. Please try again.");
            setStatus("error");
        }
    }

    if (status === "loading") {
        return <p style={styles.info}>Loading profile…</p>;
    }

    return (
        <form onSubmit={handleSubmit} noValidate style={styles.form}>
            <h2 style={styles.heading}>Profile</h2>

            {globalError && <p style={styles.globalError} role="alert">{globalError}</p>}

            {/* Display Name */}
            <fieldset style={styles.fieldset}>
                <label htmlFor="displayName" style={styles.label}>
                    Display name <span style={styles.required}>*</span>
                </label>
                <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    value={form.displayName}
                    onChange={handleChange}
                    aria-describedby={fieldErrors.displayName ? "displayName-error" : undefined}
                    style={{
                        ...styles.input,
                        ...(fieldErrors.displayName ? styles.inputError : {}),
                    }}
                    maxLength={80}
                    required
                />
                {fieldErrors.displayName && (
                    <span id="displayName-error" style={styles.fieldError} role="alert">
            {fieldErrors.displayName}
          </span>
                )}
            </fieldset>

            {/* Bio */}
            <fieldset style={styles.fieldset}>
                <label htmlFor="bio" style={styles.label}>Bio</label>
                <textarea
                    id="bio"
                    name="bio"
                    value={form.bio}
                    onChange={handleChange}
                    aria-describedby={fieldErrors.bio ? "bio-error" : undefined}
                    style={{
                        ...styles.input,
                        ...styles.textarea,
                        ...(fieldErrors.bio ? styles.inputError : {}),
                    }}
                    maxLength={500}
                    rows={3}
                />
                <span style={styles.charCount}>{form.bio.length}/500</span>
                {fieldErrors.bio && (
                    <span id="bio-error" style={styles.fieldError} role="alert">
            {fieldErrors.bio}
          </span>
                )}
            </fieldset>

            {/* Website */}
            <fieldset style={styles.fieldset}>
                <label htmlFor="website" style={styles.label}>Website</label>
                <input
                    id="website"
                    name="website"
                    type="url"
                    value={form.website}
                    onChange={handleChange}
                    aria-describedby={fieldErrors.website ? "website-error" : undefined}
                    style={{
                        ...styles.input,
                        ...(fieldErrors.website ? styles.inputError : {}),
                    }}
                    placeholder="https://example.com"
                    maxLength={200}
                />
                {fieldErrors.website && (
                    <span id="website-error" style={styles.fieldError} role="alert">
            {fieldErrors.website}
          </span>
                )}
            </fieldset>

            {/* Timezone */}
            <fieldset style={styles.fieldset}>
                <label htmlFor="timezone" style={styles.label}>Timezone</label>
                <select
                    id="timezone"
                    name="timezone"
                    value={form.timezone}
                    onChange={handleChange}
                    style={styles.input}
                >
                    {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                            {tz}
                        </option>
                    ))}
                </select>
            </fieldset>

            <button
                type="submit"
                disabled={status === "saving"}
                style={{
                    ...styles.button,
                    ...(status === "saving" ? styles.buttonDisabled : {}),
                }}
            >
                {status === "saving" ? "Saving…" : "Save profile"}
            </button>

            {status === "saved" && (
                <p style={styles.successMessage} role="status">
                    ✓ Profile saved
                </p>
            )}
        </form>
    );
}


const styles: Record<string, React.CSSProperties> = {
    form: { display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 520 },
    heading: { margin: 0, fontSize: "1.25rem", fontWeight: 600 },
    fieldset: { border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" },
    label: { fontWeight: 500, fontSize: "0.875rem" },
    required: { color: "#e53e3e" },
    input: { padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #d1d5db", fontSize: "0.9rem", width: "100%", boxSizing: "border-box" },
    inputError: { borderColor: "#e53e3e" },
    textarea: { resize: "vertical" },
    charCount: { fontSize: "0.75rem", color: "#6b7280", alignSelf: "flex-end" },
    fieldError: { color: "#e53e3e", fontSize: "0.8rem" },
    globalError: { color: "#e53e3e", background: "#fff5f5", padding: "0.5rem 0.75rem", borderRadius: 6, margin: 0 },
    successMessage: { color: "#16a34a", fontWeight: 500, margin: 0 },
    button: { padding: "0.6rem 1.25rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: "0.9rem", alignSelf: "flex-start" },
    buttonDisabled: { opacity: 0.6, cursor: "not-allowed" },
    info: { color: "#6b7280" },
};