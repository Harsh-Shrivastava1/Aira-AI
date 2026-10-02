# Conversation and Context

AIRA maintains context to ensure fluid, natural conversations.

## Normal Conversations
A conversation consists of a sequential array of messages `[{role: "user", content: "..."}, {role: "assistant", content: "..."}]`. This history is displayed visually in the `Agent.jsx` UI and sent with every request to `/api/chat`.

## Backend Context Handling
When `/api/chat` receives a request, it constructs a prompt containing:
1. System Instructions (Persona).
2. Persistent Memory (from Firestore).
3. Active Scenarios (if in an interview).
4. The last N messages of the conversation history.
5. The latest user utterance.

## File Context
If a user uploads a file or pastes code, it is stored in React state as `fileContext`.
When `fileContext` exists, questions are routed to `/api/file-chat` instead of `/api/chat`, and the entire file text is appended to the system prompt to allow targeted Q&A.

## Gmail Context
When a user asks to search emails, the backend executes the search and injects the resulting metadata (Headers, Snippets, Thread IDs) into the LLM prompt as an invisible system block. The LLM then formulates a natural language response based on this injected context.

## Clearing Context
When a user says "Start fresh" or clicks the UI button to start a new chat, the frontend:
1. Clears local message history.
2. Clears `fileContext` and `activeDraft`.
3. Creates a new thread ID in Firestore.
This ensures the LLM starts with a clean slate, though persistent memory remains active.
