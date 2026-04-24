# Tanuki Stories

An AI-powered story generation web app for students.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and add your OpenAI API key:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and set `OPENAI_API_KEY=your-actual-key`.
   The app works without an API key (mock mode).

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Demo Accounts

| Role    | Username  | Password     |
|---------|-----------|--------------|
| Admin   | `admin`   | `admin123`   |
| Student | `student` | `student123` |

## Features

- **Admin Dashboard**: Edit the system prompt, view all generated stories.
- **Student Dashboard**: Submit story requests, get AI-generated stories, pick a visual theme.
- **Themes**: Light, Dark, Sepia, Orbs on White, Orbs on Black.
- **Storage**: File-based JSON in `/data` (gitignored).
- **Auth**: Cookie-based session (no external auth library).
