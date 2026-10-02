# Contributing

Guidelines for contributing to the AIRA project.

## Branch Workflow
- Use standard Git feature branches: `feature/add-calendar`, `fix/gmail-parsing`.
- Do not commit directly to `main`.

## Coding Conventions
- Use ES Modules (`import`/`export`) on the frontend.
- Backend `api/` functions use CommonJS (`require`) or ESM depending on Vercel configuration, but stick to the existing project standard (ESM is currently used).
- Use clear, descriptive variable names.

## Security Rules
- **NEVER** commit `.env` files or hardcode secrets into the source code.
- If a new environment variable is introduced, add a dummy entry to `.env.example` and document it in `docs/environment-variables.md`.

## Pull Requests
- PRs must include a summary of changes.
- If modifying the Voice engine or Gmail API, explicit manual testing confirmation is required in the PR description.
