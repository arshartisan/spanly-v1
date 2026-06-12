# 10 — Workspaces (& Teams)

**Screenshots:**
- `app-workspaces.png` — manage workspaces
- `app-workspaces-create-modal.png` — create workspace modal

## Purpose
Workspaces group social accounts into separate contexts (e.g. Personal, Work, Clients). The active workspace scopes posts, calendar, connections, analytics. **Teams** (sidebar item, no dedicated screenshot) handles inviting collaborators into a workspace.

## Layout — Manage Workspaces (`app-workspaces.png`)
- Title **"Manage Workspaces"** + subtitle "Organize your social accounts across different workspaces". Top-right green **"+ Add Workspace"**.
- **Workspace card:** name (`main`) + `Default` tag + account-count badge (`5`). Inside: a list of accounts, each row = avatar + handle + a **Move** button (move account to another workspace).
  - Accounts shown: `@dev_muhaimin`, `@Abdul Muhaimin`, `@devmuhaimin`, `@DevMuhaimin2001`, `@Inspirational Grassy Mountain`.

## Create modal (`app-workspaces-create-modal.png`)
- Title **"Create New Workspace"**.
- **Workspace Name** input (placeholder "e.g., Personal, Work, Clients").
- **Icon** picker row (selectable icons; one highlighted green).
- Footer: **Cancel** / green **Create**.

## Interactions
- **+ Add Workspace** → create modal.
- **Move** → reassign an account to a different workspace.
- Selecting a workspace (via sidebar switcher, doc 00) changes the active scope.

## Suggested data model / API
```
Workspace: { id, name, iconKey, isDefault, accountIds:[], createdAt }
```
- `GET /workspaces`, `POST /workspaces`, `PATCH /workspaces/:id`, `DELETE /workspaces/:id`.
- `POST /accounts/:id/move` { toWorkspaceId }.

## Teams (build to spec; no screenshot)
- Invite members to a workspace by email with a role (owner/admin/member).
```
TeamMember: { id, workspaceId, userId|email, role, status:'invited'|'active' }
```
- `GET /workspaces/:id/members`, `POST .../invite`, `PATCH .../:memberId` (role), `DELETE`.

## Notes for the clone
- Everything post-related must be scoped by `workspaceId`.
- One default workspace is created at signup and cannot be deleted while default.
