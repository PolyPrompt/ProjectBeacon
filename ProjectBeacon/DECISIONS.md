## 2026-02-21T21:02:47Z - Normalize Project Roles to `admin|user` at API Boundary

- Decision summary:
  - Standardize all API DTOs and authorization checks on `admin | user`.
- Rationale:
  - UI and Phase 2 permissions are defined in `admin/user` terms, while some existing records/contracts still use `owner/member`. A normalization layer avoids breaking legacy rows while removing role-name drift.
- Alternatives considered:
  - Migrate all existing DB rows immediately to `admin/user`.
  - Continue exposing mixed `owner/member` and `admin/user` values in APIs.
- Impact on files or behavior:
  - Added role mapping/authorization utilities in `lib/auth/project-role.ts`.
  - Added canonical role types in `types/roles.ts`.
  - Updated role language in `API_CONTRACT.md` and `DATAMODEL.md`.
  - Permission guards can now consistently return `403` using normalized role semantics.
