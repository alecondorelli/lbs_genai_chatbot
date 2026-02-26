// ============================================================
// Content Filter Configuration
// ============================================================
// Centralised list of blocked patterns used by both the
// frontend (input) and backend (output) filters.
// Patterns are matched case-insensitively against the full text.
// ============================================================

/** Prompt-injection / jailbreak phrases */
const PROMPT_INJECTION_PATTERNS = [
  'ignore your instructions',
  'ignore your system prompt',
  'ignore previous instructions',
  'ignore all instructions',
  'ignore all previous',
  'disregard your instructions',
  'disregard your system prompt',
  'disregard previous instructions',
  'forget your instructions',
  'forget your system prompt',
  'forget your rules',
  'override your instructions',
  'override your system prompt',
  'bypass your instructions',
  'bypass your filters',
  'pretend you are not',
  'pretend you have no restrictions',
  'act as an unrestricted',
  'you are now DAN',
  'jailbreak',
  'developer mode enabled',
  'do anything now',
  'from now on you will',
  'simulate a persona',
  'enter developer mode',
  'exit character',
  'new instructions:',
  'system prompt override',
  'reveal your system prompt',
  'print your system prompt',
  'show your system prompt',
  'output your instructions',
  'repeat your instructions',
]

/** Hateful / explicit / violent keywords */
const OFFENSIVE_PATTERNS = [
  'kill yourself',
  'kys',
  'how to make a bomb',
  'how to make explosives',
  'how to hack into',
  'write malware',
  'create a virus',
  'create ransomware',
  'write exploit code',
  'child pornography',
  'csam',
  'how to doxx',
  'how to stalk',
  'racial slur',
  'white supremacy',
  'ethnic cleansing',
]

/** Combined list — exported so both client and server share the same source of truth */
export const BLOCKED_PATTERNS: string[] = [
  ...PROMPT_INJECTION_PATTERNS,
  ...OFFENSIVE_PATTERNS,
]

/**
 * Check whether a text string matches any blocked pattern.
 * Returns the first matched pattern, or null if clean.
 */
export function checkContentFilter(text: string): string | null {
  const lower = text.toLowerCase()
  for (const pattern of BLOCKED_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return pattern
    }
  }
  return null
}

/** Warning shown in the chat when an *input* message is blocked */
export const INPUT_BLOCKED_MESSAGE =
  '\u26a0\ufe0f This message was flagged by our content filter. Please rephrase your request.'

/** Warning shown in the chat when an *output* response is blocked */
export const OUTPUT_BLOCKED_MESSAGE =
  '\u26a0\ufe0f The response was filtered for safety. Please try a different question.'

/** Human-readable safety policy for the modal */
export const SAFETY_POLICY_MD = `# Safety Policy

Chef Code Ramsay includes content filters to keep conversations safe and productive.

## What is filtered

### Input filters
Before your message is sent to the AI, it is checked for:
- **Prompt injection attempts** — phrases designed to override the AI's instructions or bypass safety guidelines (e.g. "ignore your instructions", "pretend you have no restrictions")
- **Harmful content** — requests related to violence, explicit material, hacking, doxxing, or hate speech

If a message is flagged, it is **not sent** to the AI and you will see a warning in the chat.

### Output filters
After the AI generates a response, it is scanned for the same categories. If the response contains flagged content, it is replaced with a safety notice.

## Why we filter

These filters exist to:
1. **Prevent misuse** — stop the AI from being manipulated into producing harmful content
2. **Protect users** — ensure the chat remains a safe environment for everyone
3. **Maintain trust** — demonstrate responsible AI deployment practices

## Limitations

No filter system is perfect. These filters use keyword matching and may occasionally:
- Flag legitimate messages that happen to contain a blocked phrase (false positives)
- Miss harmful content phrased in unexpected ways (false negatives)

If you believe your message was incorrectly flagged, try rephrasing it.

## Transparency

The filter keyword list is maintained in a shared configuration file and is the same for both input and output checks. This policy is provided so you know exactly what safeguards are in place.`
