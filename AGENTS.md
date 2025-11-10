# Agent Instructions

## Package Management

This project uses **pnpm** as its package manager. Always use pnpm for all package operations:

- Installing packages: `pnpm add <package>`
- Running scripts: `pnpm <script-name>`
- **For shadcn/ui components**: Use `pnpm dlx shadcn@latest add <component>` (not `npx`)

Never use npm or yarn for this project.

---

When working on this project, always follow these steps before completing your work:

## 1. Format Code
```bash
pnpm format
```
This will format all TypeScript and TSX files using Prettier with Tailwind CSS class sorting.

## 2. Type Check
```bash
pnpm type-check
```
Run TypeScript compiler to check for type errors. Fix any type errors that appear.

## 3. Lint
```bash
pnpm lint
```
Check for linting errors using ESLint. Fix any linting issues.

## 4. Fix Issues
If any of the above commands fail or show errors:
- Read the error messages carefully
- Fix the issues in the relevant files
- Re-run the commands to verify fixes
- Repeat until all checks pass

## Important Notes
- Never commit code with type errors or linting issues
- Format code before making commits
- All three checks must pass before work is considered complete

## Documentation Guidelines
- **No Emojis**: Do not use emojis in any code, documentation, or README files
- **No File Structure**: Do not include file/folder structure diagrams in README files
- **No Random Documentation**: Do not create markdown documentation files unless explicitly requested by the user. This includes integration guides, feature documentation, or any other .md files

## Component Guidelines
- **Use shadcn/ui**: Always use shadcn/ui components when available. Do not create custom components that duplicate shadcn functionality
- **Add Components**: Use `pnpm dlx shadcn@latest add <component>` to add new shadcn components as needed
- **No Native Dialogs**: Never use native `alert()` or `confirm()` dialogs. Always use shadcn AlertDialog, Dialog, or Sonner toast components instead

## Database Migrations
- **Generate Migrations**: Use `pnpm db:generate` to automatically generate database migrations from schema changes
- **Never Write Manual Migrations**: Do not manually create SQL migration files in the `drizzle/` directory
- **Workflow**: 
  1. Update the schema in `lib/db/schema.ts`
  2. Run `pnpm db:generate` to generate the migration
  3. Run `pnpm db:push` to apply the migration to the database
- The migration generator will create properly formatted SQL files based on your schema changes

