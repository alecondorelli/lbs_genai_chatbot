# AI Contribution Documentation

This document records how AI (Claude by Anthropic) was used in building this chatbot project.

## Overview

Claude was used as a development assistant throughout the project, helping with architecture decisions, code implementation, and deployment guidance. The chatbot itself is powered by the Claude API at runtime.

## AI Contribution by Component

| Component | AI Contribution Level | Details |
|---|---|---|
| Project Architecture | High | Claude helped design the project structure, choosing Next.js 14 App Router with TypeScript, and defining the separation between the streaming API route and the client-side chat interface. |
| Streaming API (`route.ts`) | High | Claude assisted in implementing the Server-Sent Events streaming pattern using `@anthropic-ai/sdk`'s `messages.stream()` method, including proper ReadableStream construction and SSE formatting. |
| Frontend UI (`page.tsx`) | High | Claude helped build the chat interface including message rendering, SSE stream parsing, auto-scroll, auto-resize textarea, typing indicators, and suggestion chips. |
| Styling (`globals.css`) | Medium | Claude assisted with the dark theme design, markdown content styling, and the typing indicator animation. Design direction was provided by the developer. |
| System Prompt | Medium | The LBS Buddy persona and Socratic teaching approach were co-developed with Claude, with domain-specific details provided by the developer. |
| Deployment Guidance | Medium | Claude provided guidance on Vercel deployment configuration and environment variable setup. |
| README & Documentation | Medium | Claude helped draft the README structure and content, with the developer providing project-specific context. |

## How AI Was Used

### Development Process

1. **Architecture Planning** — Claude recommended the Next.js App Router pattern with a streaming API route, keeping the frontend as a single client component for simplicity.

2. **Streaming Implementation** — The SSE streaming approach was implemented with Claude's guidance, using the Anthropic SDK's streaming API and a custom ReadableStream to pipe token events to the client.

3. **Frontend Development** — Claude helped implement the React chat interface, including state management for messages, real-time stream parsing, and UI interactions like auto-scroll and keyboard shortcuts.

4. **Deployment** — Claude provided step-by-step Vercel deployment instructions and environment variable configuration.

### Tools Used

- **Claude (Anthropic)** — AI assistant for code generation and architecture guidance
- **Claude API** — Powers the chatbot's runtime responses via `claude-sonnet-4-20250514`

## Transparency

This project was built for the Generative AI Product Design course at London Business School. AI assistance was used openly and is documented here as part of the assignment requirements. All code was reviewed and understood by the developer before inclusion.
