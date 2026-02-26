# AI Contribution Log

This document details how AI tools were used throughout the development of the Chef Code Ramsay chatbot, what was generated vs. manually written, and how I validated and adapted AI outputs.

---

## Tools Used

- **Claude (claude.ai):** Used for brainstorming architecture decisions, drafting prompts for Claude Code, troubleshooting streaming issues, and planning the feature roadmap.
- **Claude Code (CLI):** Used for generating boilerplate code, implementing features across multiple files, and handling repetitive tasks like wiring up API routes for three different providers.
- **ChatGPT:** Occasionally consulted for alternative approaches to SSE streaming and markdown rendering edge cases.

---

## 1. Project Setup and Initial Architecture

**Prompt (to Claude Code):**
> "Create a Next.js 14 chatbot app with TypeScript. Set up the project structure with an API route at app/api/chat/route.ts that streams responses from the Anthropic Claude API using SSE. Build a chat UI in app/page.tsx with message history and auto-scroll."

**What the AI generated:**
The AI scaffolded the full project structure including package.json, tsconfig.json, next.config.js, and the app directory with layout.tsx, page.tsx, globals.css, and the API route. It set up the basic streaming logic using `client.messages.stream()` from the Anthropic SDK and an SSE parser on the frontend.

**What I did manually:**
- Chose Next.js 14 over Gradio (the default option in the assignment) because I wanted more control over the UI and a chance to work with a production-grade React framework
- Decided on the project architecture (API route pattern vs. server actions) after researching Next.js streaming patterns
- Configured environment variables and tested the initial connection to the Anthropic API
- Refined the auto-scroll behavior which was jumpy on longer responses

---

## 2. Chef Code Ramsay Persona and System Prompt

**Prompt (to Claude on claude.ai):**
> "Help me design a system prompt for a Gordon Ramsay-inspired coding mentor chatbot. It should be brutally honest but actually helpful, with cooking metaphors for code concepts."

**What the AI generated:**
A first draft of the persona prompt with the theatrical Ramsay voice, cooking metaphors, and general code review instructions.

**What I did manually:**
- Rewrote the prompt to add adaptive behavior: the bot dials back intensity for beginners and ramps it up for more experienced developers
- Added safety guardrails directly into the system prompt (prompt injection resistance, content boundaries, refusal to reveal full system prompt)
- Tuned the personality over multiple iterations by testing different types of questions and adjusting the tone
- Decided to store the system prompt in a shared constants file (lib/constants.ts) so it could be displayed in the UI and used in the API route from a single source of truth

---

## 3. Multi-Model Support (Claude, Gemini, GPT-4o Mini)

**Prompt (to Claude Code):**
> "Add a model selection dropdown to the chat interface. Based on the selected model, route to the correct API: Anthropic SDK for Claude, Google Generative AI SDK for Gemini, OpenAI SDK for GPT-4o Mini. All three should stream via SSE in the same format."

**What the AI generated:**
The routing logic in route.ts that switches between providers, installs for @google/generative-ai and openai packages, and the dropdown component with state management.

**What I did manually:**
- Researched and obtained API keys from all three providers (Anthropic, Google AI Studio, OpenAI)
- Chose specific models for each provider based on cost and performance (Gemini Flash for its free tier, GPT-4o Mini for affordability)
- Tested each provider individually to verify streaming worked correctly since each SDK handles streaming differently
- Moved the model selector from the header into the input bar after seeing how Claude.ai positions their model picker, which I thought was cleaner

---

## 4. Multimodal Image Upload

**Prompt (to Claude Code):**
> "Add a file upload component. Clicking a paperclip icon opens a file picker for images. Convert to base64 and send with the message. Handle the vision API format differently for each provider."

**What the AI generated:**
The file picker component, base64 conversion logic, image preview with remove button, and the provider-specific payload formatting for Claude vision, Gemini inline images, and OpenAI image_url format.

**What I did manually:**
- Added the 5MB file size limit after testing showed that larger images caused timeouts on the free Gemini tier
- Tested image analysis across all three models with the same screenshot to compare quality of responses
- Fixed an issue where the image preview wasn't clearing after sending a message (the state wasn't resetting properly)

---

## 5. Authentication and Personalized Greeting

**Prompt (to Claude Code):**
> "Add a login screen with name and password fields. Store the username in sessionStorage. After login, show a time-based greeting using the user's name."

**What the AI generated:**
The login overlay component, sessionStorage logic, and the time-based greeting function (morning/afternoon/evening).

**What I did manually:**
- Made the deliberate decision to accept any non-empty password rather than validate against a hardcoded secret, since the goal was to demonstrate the authentication UI pattern, not build production security
- Added the password hint for graders so they wouldn't get stuck
- Came up with the idea of personalized time-based greetings to show that the auth flow adds real UX value beyond just a gate

---

## 6. Safety and Content Filters

**Prompt (to Claude Code):**
> "Add input and output safety filters. Check messages against blocked keywords before sending. Add a 'Content filters active' badge and a 'View Safety Policy' modal."

**What the AI generated:**
The filter keyword list in lib/filters.ts, the client-side input checking logic, the server-side output scanning, and the safety policy modal content.

**What I did manually:**
- Designed the three-layer safety architecture (system prompt guardrails + client-side input filters + server-side output filters) after thinking about defense in depth
- Curated the blocked keyword list by thinking about realistic edge cases rather than just using a generic profanity list
- Added prompt injection patterns (like "ignore your instructions") to the filter list based on known attack vectors I'd read about
- Integrated the safety instructions into the Chef Code Ramsay persona so they feel natural rather than bolted on

---

## 7. UI Design and Styling

**Prompt (to Claude Code):**
> "Redesign the input bar to look similar to ChatGPT's. Rounded rectangle, multi-line textarea, + icon for attachments, compact model selector on the right."

**What the AI generated:**
The new input bar layout with CSS styling, textarea auto-resize logic, and the ChatGPT-inspired send button.

**What I did manually:**
- Directed the overall visual direction: chose the light theme, decided on the ChatGPT-style input bar after comparing several chat interfaces
- Switched fonts to the system font stack (matching Claude's interface) after the initial Google Fonts imports felt too heavy
- Designed the hero page layout with suggestion chips, system prompt viewer, AI contribution log viewer, and features modal
- Iterated on spacing, colors, and hover states across multiple rounds until the UI felt polished
- Fixed responsive/zoom issues where text was overflowing message bubbles by adding proper word-wrap and overflow rules

---

## 8. Streaming and Markdown Rendering

**Prompt (to Claude Code):**
> "Add a blinking cursor at the end of streaming messages. Fix markdown rendering so bold, italic, code blocks, and lists display correctly."

**What the AI generated:**
The cursor animation CSS, the conditional rendering logic to show/hide the cursor, and the react-markdown configuration with remark-gfm and remark-breaks plugins.

**What I did manually:**
- Identified the markdown rendering bug where raw asterisks were showing instead of bold/italic text
- Chose and installed the specific remark plugins (remark-gfm for tables, remark-breaks for line breaks) after testing different combinations
- Styled code blocks to match the overall light theme with proper background colors and padding

---

## 9. Development Workflow with Parallel Agents

One thing worth noting is the development workflow itself. I experimented with running multiple Claude Code instances in VS Code simultaneously, each on a different branch, to parallelize feature development. This worked for independent features (like authentication on one branch and safety filters on another) but caused issues when agents tried to checkout branches in a shared working directory. I learned that true parallel AI-assisted development requires separate cloned repositories, not just separate branches.

---

## Summary

AI tools were instrumental in accelerating development, particularly for boilerplate code, API integrations, and CSS styling. However, the architectural decisions, feature prioritization, UX design direction, persona development, safety architecture, and quality testing were all driven by me. Every piece of AI-generated code was reviewed, tested, and in most cases modified before being committed. The AI was a powerful coding partner, but the product vision and critical thinking came from me.
