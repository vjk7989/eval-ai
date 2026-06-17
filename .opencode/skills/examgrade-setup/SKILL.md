---
name: examgrade-setup
description: Use when the user wants to set up, initialize, configure, or run the ExamGrade AI project. Also use when asked to deploy, start, or configure the exam grading application. Handles npm install, env setup, dev server, and build.
---

# ExamGrade AI — Setup Skill

Automated setup, configuration, and management of the ExamGrade AI application.

## Quick Start

Run the MCP tool `examgrade_setup` to perform a full setup:

```
examgrade_setup
```

This will:
1. Install all npm dependencies
2. Create `.env.local` with a placeholder API key
3. Verify the setup by running a type check
4. Start the dev server on port 3000

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `examgrade_setup` | Full project setup (install + env + verify) |
| `examgrade_start` | Start the Vite dev server |
| `examgrade_build` | Create a production build |
| `examgrade_typecheck` | Run TypeScript type checking |
| `examgrade_set_api_key` | Set the Gemini API key in `.env.local` |

## Manual Steps (if MCP is unavailable)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local` in the project root:

```bash
GEMINI_API_KEY="your-gemini-api-key-here"
```

Get a free API key at: https://aistudio.google.com/apikey

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**

### 4. Build for Production

```bash
npm run build
npm run preview
```

## Project Configuration

The project uses these key files:

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build config, API key injection, Tailwind plugin |
| `tsconfig.json` | TypeScript compiler options |
| `package.json` | Dependencies and scripts |
| `.env.local` | Environment variables (not committed) |

## Troubleshooting

### API Key Not Working

- Ensure `GEMINI_API_KEY` is set in `.env.local` (not `.env`)
- Restart the dev server after changing env vars
- Key must be a valid Google AI Studio API key

### Port Already in Use

```bash
# Use a different port
npx vite --port=3001 --host=0.0.0.0
```

### Build Failures

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

## Gemini API Setup

1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the key
4. Add to `.env.local`: `GEMINI_API_KEY="AIza..."`
5. Restart dev server

The app uses `gemini-3.1-pro-preview` model with structured JSON output and a response schema for consistent analysis results.
