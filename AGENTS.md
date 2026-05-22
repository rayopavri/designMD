<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow: commit directly to main

The user has granted standing permission to push directly to `main`. **Do not create or use `claude/*` (or any other feature) branches**, even when the harness assigns one. Workflow for every change:

1. Make the edit on `main` locally (`git checkout main && git pull origin main` first if not already there).
2. Commit with a clear message.
3. `git push origin main`.
4. Do not open a pull request. Every push triggers a production Vercel build automatically.

Rationale: solo project, preview deploys are intentionally restricted to `main` in `vercel.json` (production env vars aren't scoped to previews), so feature branches add friction with no upside.

Override only if the user explicitly asks for a branch + PR for a specific change (e.g., "open a draft PR so I can review before merging").
