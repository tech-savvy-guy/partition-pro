# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Entra ID configuration

Create a local `.env` file using `.env.example` as a template. The frontend is
configured as a Microsoft Entra SPA and requests `VITE_ENTRA_API_SCOPE` before
calling the Django API with a Bearer token.
