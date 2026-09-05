# Open AI Chat (formerly Echo-Bot)

A zero-dependency, browser-first chat client for Pollinations AI models with streamed responses, conversation persistence, cancellation, validation, and lightweight browser verification.

## Features

- Responsive dark UI for desktop and mobile
- Streaming responses from the Pollinations chat completions endpoint
- Conversation context with browser persistence
- New chat and clear conversation controls
- Stop/cancel for active responses
- Session-only API-key handling
- Configurable model and system prompt
- Input validation with a 2,000-character limit
- Graceful handling for authentication, rate-limit, network, empty, and malformed-stream failures
- Accessible status, chat-log, settings, and keyboard interactions
- Reduced-motion support
- Debug output that records request lifecycle information without logging API keys or message payloads
- `/legacy` preserved as the historical mock implementation

## Usage

1. Open `index.html` in a modern browser or serve the repository with any static web server.
2. Open **Connection & prompt** and enter a Pollinations API key.
3. Select a supported model and optionally provide a system prompt.
4. Start chatting.

No build step, package manager, backend, or GitHub Actions workflow is required.

## Configuration and security

The current client sends requests directly from the browser to `https://gen.pollinations.ai/v1/chat/completions`. The API key is retained only in `sessionStorage` for the current browser session and is never written to conversation history or debug output.

Browser-side API keys are still exposed to the page and the browser environment. Do not use this client as a secure secret-management boundary or deploy it where untrusted scripts can access the same origin. For stronger secret protection, use a server-side proxy instead.

Conversation history and the system prompt are stored in `localStorage` so they can be restored after refresh. Use **Clear** or **New chat** to remove the saved conversation.

## Streaming behavior

The client uses the Fetch API, readable streams, and `TextDecoder` to process Server-Sent Events-style `data:` records. Partial chunks are buffered until complete lines are available. Malformed events are ignored rather than crashing the chat, terminal `[DONE]` events end the stream, and network/API failures return the interface to an interactive state.

## Browser verification

Open `tests.html` directly to run the lightweight browser checks for stream parsing, validation, error formatting, and conversation sanitization. The tests require no dependencies or build tooling.

## Legacy Echo Bot

The original mock implementation remains under `/legacy`. It uses JSONPlaceholder to demonstrate basic frontend-to-backend request handling without requiring an AI service.

## Browser compatibility

Use a current Chrome, Edge, Firefox, or Safari release with support for Fetch, readable streams, `TextDecoder`, `AbortController`, `localStorage`, and `sessionStorage`.

## Deployment

The application is designed for manual static deployment. Upload `index.html`, `app.js`, and the repository files to the chosen static host. No CI/CD or GitHub Actions configuration is included.
