# LBS GenAI Chatbot — LBS Buddy

A conversational AI teaching assistant for London Business School's Masters in Analytics and Management (MAM) programme, built with Next.js 14 and Claude.

## Features

- **Streaming responses** — real-time token-by-token display via Server-Sent Events
- **Conversation memory** — full chat history sent with each request for multi-turn context
- **Markdown rendering** — formatted responses with code blocks, lists, and emphasis
- **Dark theme UI** — clean interface with DM Sans typography
- **Suggestion chips** — quick-start prompts for common student questions

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **Rendering**: `react-markdown` for assistant message formatting
- **Fonts**: DM Sans (UI), JetBrains Mono (code blocks)

## Setup

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

## Deployment

### Vercel (Recommended)

1. Push this repo to GitHub
2. Import the project on [vercel.com](https://vercel.com)
3. Add `ANTHROPIC_API_KEY` as an environment variable in the Vercel dashboard
4. Deploy

### Other Platforms

Any platform that supports Next.js works (Railway, Render, AWS Amplify). Set the `ANTHROPIC_API_KEY` environment variable and run `npm run build && npm start`.

## Project Structure

```
app/
├── api/chat/route.ts   # Streaming chat API endpoint
├── globals.css          # Global styles and markdown formatting
├── layout.tsx           # Root layout with fonts and metadata
└── page.tsx             # Chat interface (client component)
```

## Assignment

This project was built for the Generative AI Product Design course at London Business School.
