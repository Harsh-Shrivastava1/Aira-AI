# File Analysis

AIRA allows users to upload documents for instant contextual analysis.

## Upload Flow
1. User clicks the upload icon and selects a file.
2. The file is sent as multipart/form-data to `/api/upload`.
3. `/api/upload` uses `busboy` to parse the stream.
4. If it's a PDF, `pdf-parse` extracts the text. If it's a `.txt`, `.md`, or `.csv`, it is read as UTF-8.
5. The extracted text is returned to the frontend.

## Storage
Files are **not** permanently stored on the server. The extracted text is temporarily held in React state (`fileContext`) in the browser.

## Question Answering
Once `fileContext` is set, subsequent voice or text commands are routed to `/api/file-chat`. The entire document text is injected into the prompt, allowing the LLM to summarize, answer questions, or extract data based exclusively on the uploaded file.
