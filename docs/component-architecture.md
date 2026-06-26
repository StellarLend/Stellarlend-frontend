# Component Architecture Guide

## Overview
The StellarLend UI follows an **Atomic Design** inspired hierarchy combined with feature‑based organization. This guide defines each layer's responsibilities, import direction rules, and maps existing folders to the model.

## Layers & Responsibilities
| Layer | Folder | Responsibility | Typical Contents |
|-------|--------|----------------|-----------------|
| **Atoms** | `components/atoms` | Small, reusable UI primitives (buttons, icons, inputs). | No internal dependencies on other UI layers.
| **Molecules** | `components/molecules` | Combinations of atoms to form a functional unit (e.g., `SearchBar`, `UserCard`). | May import **atoms** only.
| **Organisms** | `components/organisms` | Complex UI sections composed of molecules/atoms (e.g., `LendingDashboard`). | May import **atoms**, **molecules**, and **shared** utilities.
| **Features** | `components/features` | Feature‑specific screens or widgets (e.g., `LendingForm`, `BorrowHistory`). | May import **shared**, **atoms**, **molecules**, **organisms**. **Never** import from sibling feature folders.
| **Shared** | `components/shared` (`ui`, `layout`, `common`) | Cross‑cutting primitives and layout helpers used throughout the app. | Should **only** be imported by higher layers (features, organisms, molecules, atoms). **Never** depend on any of the above layers.

## Import Direction Rules
- **Downward** imports are allowed (higher‑level layer → lower‑level layer).
- **Upward** imports are forbidden (e.g., an atom importing from a feature).
- **Cross‑layer** imports must respect the hierarchy above.
- **Shared** is a neutral base; any layer may import from `shared` but **shared must not import** from other UI layers.

## Existing Folder Mapping
- `components/atoms` – Atoms
- `components/molecules` – Molecules
- `components/organisms` – Organisms
- `components/features/*` – Features
- `components/shared/ui`, `components/shared/layout`, `components/shared/common` – Shared

## Known Debt
- **Button** component exists both in `atoms` and `shared/ui`.
- **SearchBar** exists in both `molecules` and `features/search`.
These duplicates are documented for future cleanup.

## Usage Example
```tsx
// Feature component (allowed):
import { Button } from '@/components/shared/ui'; // shared import
import { Input } from '@/components/atoms'; // atom import

// Organism component (allowed):
import { SearchBar } from '@/components/molecules'; // molecule import
```

## Cross‑links
- See the updated **[Project Structure](/CONTRIBUTING.md#project-structure)** section.
- Refer to the **[Documentation Checklist](/COMPONENT-CHECKLIST.md#documentation)** for ensuring this guide is referenced.
