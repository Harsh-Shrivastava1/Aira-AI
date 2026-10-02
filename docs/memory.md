# Memory System

AIRA features a persistent memory system that extracts long-term facts across different chat sessions.

## Concept
Unlike short-term conversation history, "Memory" consists of permanent facts about the user (e.g., "User is a software engineer," "User's name is Harsh," "User prefers concise answers").

## Extraction
When a user sends a message, `Agent.jsx` fires an asynchronous, non-blocking call to `/api/extract-memory`.
1. The endpoint reads the user's current memory block from Firestore.
2. It sends the new conversation transcript to a fast LLM model with a prompt asking: "Are there any new, permanent facts to remember here?"
3. If yes, it synthesizes the new facts with the old memory and updates Firestore.

## Retrieval
When starting any request in `/api/chat`, the backend retrieves the user's memory document from Firestore (`memoryService.js`) and injects it at the top of the System Prompt.

## Security
Memory is stored per-user in Firestore under the `users/{userId}/memory` collection. Security rules ensure users can only read and write their own memory data.
