# Open AI Chat (formerly Echo-Bot)

A clean, modern, and zero-dependency single-page HTML chat client designed for interacting with AI models, featuring real-time response streaming and persistent conversation history.

### Features
* **Responsive UI:** A sharp, modern dark theme that adapts perfectly to desktop and mobile devices.
* **Real-time Streaming:** Uses Server-Sent Events (SSE) to display AI responses as they are generated, providing a rapid and dynamic chat experience.
* **Legacy Mode:** A dedicated version of the original "Echo Bot" is available for testing basic API connectivity.
* **Conversation Memory:** Keeps track of the active chat history to maintain conversational context with the AI across multiple messages.
* **System Prompt:** A collapsible section allows you to provide a system prompt to define the AI's behavior, persona, or rules.
* **Free & Keyless Access:** Securely connects to a free, CORS-enabled public endpoint (`https://text.pollinations.ai/openai`), requiring no API keys, accounts, or backend servers.
* **Debug Console:** An integrated, collapsible console logs request payloads and Server-Sent Event chunks in real-time.
* **Context Management:** A dedicated "Clear" button resets the conversation history and clears the chat interface instantly.
* **Input Validation:** A real-time character counter tracks input length up to a maximum limit.

### How It Works
The client leverages the native JavaScript `fetch` API to make a `POST` request to the AI endpoint. It constructs a standard conversational payload containing a `messages` array, which includes the optional system prompt and all previous user/bot interactions. 

Crucially, the request asks the server to stream the response back (`stream: true`). The application reads the incoming byte stream using `res.body.getReader()` and decodes it using a `TextDecoder`. It then loops over the data chunks, manually parsing the `data:` prefixes typical of Server-Sent Events to extract the incremental text tokens (`delta.content`) and instantly updates the DOM UI character-by-character.

### Legacy Echo Bot (Mock API)
The original implementation of this project is preserved in the `/legacy` directory. It serves as a simple demonstration of frontend-to-backend communication:
* **JSONPlaceholder Integration:** It sends `POST` requests to `https://jsonplaceholder.typicode.com/posts`.
* **Mock Echoing:** Since the JSONPlaceholder API echoes back the data sent to it in the response body, this legacy bot effectively "echoes" user input to verify that network requests are functioning correctly without needing a real AI backend.

### Usage
This project is a resilient single-file application requiring absolutely no build steps, backend setup, or NPM packages.
* Save the code as a file with an `.html` extension (e.g., `index.html`).
* Open the file directly in any modern web browser.
Once opened, you can begin chatting. Your messages will be sent to the AI endpoint, and you can monitor the low-level data exchanges by expanding the "Debug output" accordion at the bottom of the page.

### Browser Compatibility
The application is designed for modern browsers with support for the Fetch API, readable streams, `TextDecoder`, and Server-Sent Events-style streaming. For the best experience, use a current version of Chrome, Edge, Firefox, or Safari.

### Technologies Used
* **HTML5:** Clean semantic layout.
* **CSS3:** Native variables, Flexbox layouts, gradients, animations, and custom scrollbars.
* **JavaScript (ES6+):** Asynchronous functions, Fetch API, TextDecoder, readable streams, and DOM manipulation.
* **Font Awesome:** Lightweight scalable vector icons via CDN.
