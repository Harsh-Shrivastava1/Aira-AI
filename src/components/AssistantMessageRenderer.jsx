import React, { useState, useMemo } from "react";
import { Clipboard, Check } from "lucide-react";

/**
 * Parses raw text into semantic Markdown blocks:
 * - code (with language detection & copy support)
 * - heading (h1-h6)
 * - bullet-list (with nesting)
 * - numbered-list (with nesting)
 * - table (with responsive horizontal scroll container)
 * - blockquote
 * - horizontal rule
 * - paragraph
 */
export function parseMarkdownBlocks(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  const isTableLine = (l) => l && l.includes("|") && !l.trim().startsWith("```");
  const isTableSeparator = (l) => /^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)+\|?$/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code block fence (```)
    if (line.trim().startsWith("```")) {
      const fenceMatch = line.trim().match(/^```([a-zA-Z0-9+#_.-]*)/);
      const language = fenceMatch ? fenceMatch[1].trim() : "";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++; // skip closing ```
      }
      blocks.push({
        type: "code",
        language: language.toLowerCase(),
        content: codeLines.join("\n"),
      });
      continue;
    }

    // 2. Horizontal rule (---, ***, ___)
    if (/^\s*([*\-_])\s*(\1\s*){2,}$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 3. Headings (# h1, ## h2, ### h3, #### h4, etc.)
    const headingMatch = line.match(/^(\#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 4. Blockquotes (> quote)
    if (line.trim().startsWith(">")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: quoteLines.join("\n"),
      });
      continue;
    }

    // 5. Tables (| col1 | col2 | or col1 | col2 with divider line)
    if (isTableLine(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const parseRow = (rowStr) => {
        let clean = rowStr.trim();
        if (clean.startsWith("|")) clean = clean.slice(1);
        if (clean.endsWith("|")) clean = clean.slice(0, -1);
        return clean.split("|").map((c) => c.trim());
      };

      const headers = parseRow(line);
      i += 2; // skip header line and separator line
      const rows = [];
      while (i < lines.length && isTableLine(lines[i]) && lines[i].trim() !== "") {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({
        type: "table",
        headers,
        rows,
      });
      continue;
    }

    // 6. Bullet lists (*, -, +)
    if (/^\s*[*+-]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        const bulletMatch = currentLine.match(/^(\s*)([*+-])\s+(.*)$/);
        if (bulletMatch) {
          const indent = bulletMatch[1].length;
          const content = bulletMatch[3];
          items.push({
            indent: indent >= 2 ? 1 : 0,
            content,
          });
          i++;
        } else if (
          items.length > 0 &&
          currentLine.trim() !== "" &&
          /^\s{2,}/.test(currentLine) &&
          !currentLine.trim().startsWith("```")
        ) {
          items[items.length - 1].content += " " + currentLine.trim();
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: "bullet-list",
        items,
      });
      continue;
    }

    // 7. Numbered lists (1. , 2. )
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        const numMatch = currentLine.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
        if (numMatch) {
          const indent = numMatch[1].length;
          const number = numMatch[2];
          const content = numMatch[3];
          items.push({
            indent: indent >= 2 ? 1 : 0,
            number,
            content,
          });
          i++;
        } else if (
          items.length > 0 &&
          currentLine.trim() !== "" &&
          /^\s{2,}/.test(currentLine) &&
          !currentLine.trim().startsWith("```")
        ) {
          items[items.length - 1].content += " " + currentLine.trim();
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: "numbered-list",
        items,
      });
      continue;
    }

    // 8. Empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // 9. Paragraph
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].match(/^#{1,6}\s+/) &&
      !/^\s*([*\-_])\s*(\1\s*){2,}$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">") &&
      !(isTableLine(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) &&
      !/^\s*[*+-]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: paraLines.join("\n"),
      });
    }
  }

  return blocks;
}

/**
 * Validates and ensures URLs are safe (prevents javascript: URIs)
 */
function isSafeUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#")
  );
}

/**
 * Tokenizes inline Markdown:
 * - inline code `code`
 * - bold-italic ***text***
 * - bold **text** or __text__
 * - italic *text* or _text_
 * - markdown link [text](url)
 * - bare URL http(s)://...
 */
export function renderInlineContent(text) {
  if (!text || typeof text !== "string") return text;

  const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>()]+)/g;

  const elements = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <span key={`text-${key++}`}>{text.slice(lastIndex, match.index)}</span>
      );
    }

    const raw = match[0];

    if (raw.startsWith("`") && raw.endsWith("`")) {
      const code = raw.slice(1, -1);
      elements.push(
        <code
          key={`code-${key++}`}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: "0.85em",
            background: "rgba(0, 0, 0, 0.06)",
            color: "#0f172a",
            padding: "2px 5px",
            borderRadius: "4px",
            border: "1px solid rgba(0, 0, 0, 0.06)",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {code}
        </code>
      );
    } else if (raw.startsWith("***") && raw.endsWith("***")) {
      elements.push(
        <strong key={`bi-${key++}`} style={{ fontWeight: 600, color: "#0f172a" }}>
          <em style={{ fontStyle: "italic" }}>{raw.slice(3, -3)}</em>
        </strong>
      );
    } else if (raw.startsWith("**") && raw.endsWith("**")) {
      elements.push(
        <strong key={`b-${key++}`} style={{ fontWeight: 600, color: "#0f172a" }}>
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      elements.push(
        <em key={`i-${key++}`} style={{ fontStyle: "italic" }}>
          {raw.slice(1, -1)}
        </em>
      );
    } else if (raw.startsWith("[") && raw.includes("](") && raw.endsWith(")")) {
      const closeBracket = raw.indexOf("](");
      const title = raw.slice(1, closeBracket);
      const url = raw.slice(closeBracket + 2, -1);
      if (isSafeUrl(url)) {
        elements.push(
          <a
            key={`link-${key++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
              overflowWrap: "anywhere",
              wordBreak: "break-all",
              fontWeight: 500,
            }}
          >
            {renderInlineContent(title)}
          </a>
        );
      } else {
        elements.push(<span key={`text-${key++}`}>{title}</span>);
      }
    } else if (raw.startsWith("http://") || raw.startsWith("https://")) {
      elements.push(
        <a
          key={`url-${key++}`}
          href={raw}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
            overflowWrap: "anywhere",
            wordBreak: "break-all",
          }}
        >
          {raw}
        </a>
      );
    } else {
      elements.push(<span key={`text-${key++}`}>{raw}</span>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(
      <span key={`text-${key++}`}>{text.slice(lastIndex)}</span>
    );
  }

  return elements;
}

/**
 * Code Block Component with Copy feedback and horizontal scroll protection
 */
function CodeBlock({ code, language, id }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        margin: "0.55rem 0",
        borderRadius: "10px",
        overflow: "hidden",
        background: "#0f172a",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: "rgba(30, 41, 59, 0.8)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "3px 8px",
            borderRadius: "5px",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: copied ? "#34d399" : "#cbd5e1",
            fontSize: "0.68rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.14)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
          }}
        >
          {copied ? <Check size={11} color="#34d399" /> : <Clipboard size={11} />}
          <span>{copied ? "COPIED" : "COPY"}</span>
        </button>
      </div>
      <pre
        className="custom-scrollbar"
        style={{
          margin: 0,
          padding: "12px 14px",
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          maxHeight: "450px",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: "0.82rem",
          lineHeight: 1.5,
          whiteSpace: "pre",
          tabSize: 2,
          color: "#e2e8f0",
          boxSizing: "border-box",
        }}
      >
        <code style={{ fontFamily: "inherit" }}>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Table Component with responsive horizontal scroll wrapper
 */
function MarkdownTable({ headers, rows }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "auto",
        margin: "0.6rem 0",
        borderRadius: "8px",
        border: "1px solid rgba(0, 0, 0, 0.08)",
        background: "rgba(255, 255, 255, 0.6)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: "260px",
          borderCollapse: "collapse",
          fontSize: "0.82rem",
          lineHeight: 1.45,
          textAlign: "left",
        }}
      >
        <thead>
          <tr style={{ background: "rgba(0, 0, 0, 0.03)" }}>
            {headers.map((h, idx) => (
              <th
                key={idx}
                style={{
                  padding: "7px 12px",
                  fontWeight: 600,
                  color: "#0f172a",
                  borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
                  borderRight:
                    idx < headers.length - 1 ? "1px solid rgba(0, 0, 0, 0.06)" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                {renderInlineContent(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                background: rIdx % 2 === 1 ? "rgba(0, 0, 0, 0.015)" : "transparent",
              }}
            >
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    padding: "6px 12px",
                    color: "#334155",
                    borderBottom:
                      rIdx < rows.length - 1 ? "1px solid rgba(0, 0, 0, 0.05)" : "none",
                    borderRight:
                      cIdx < row.length - 1 ? "1px solid rgba(0, 0, 0, 0.05)" : "none",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {renderInlineContent(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Main AssistantMessageRenderer component
 */
export default function AssistantMessageRenderer({ message }) {
  if (!message || (!message.text && message.type !== "code")) {
    return null;
  }

  // Handle explicit code message
  if (message.type === "code") {
    return (
      <CodeBlock
        code={message.text || ""}
        language={message.language || ""}
        id={message.id || "code"}
      />
    );
  }

  // Parse blocks memoized on message text
  const blocks = useMemo(() => {
    return parseMarkdownBlocks(message.text);
  }, [message.text]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      }}
    >
      {blocks.map((block, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === blocks.length - 1;

        switch (block.type) {
          case "heading": {
            const level = Math.min(Math.max(block.level || 1, 1), 6);
            const style = {
              margin: isFirst
                ? "0 0 0.3rem 0"
                : level === 1
                ? "0.7rem 0 0.35rem 0"
                : level === 2
                ? "0.6rem 0 0.3rem 0"
                : "0.5rem 0 0.25rem 0",
              fontWeight: level <= 2 ? 700 : 600,
              fontSize:
                level === 1
                  ? "1.14rem"
                  : level === 2
                  ? "1.04rem"
                  : level === 3
                  ? "0.96rem"
                  : "0.88rem",
              lineHeight: 1.35,
              color: level === 1 ? "#0f172a" : level === 2 ? "#1e293b" : "#334155",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            };

            const Tag = `h${level}`;
            return (
              <Tag key={idx} style={style}>
                {renderInlineContent(block.content)}
              </Tag>
            );
          }

          case "paragraph": {
            return (
              <p
                key={idx}
                style={{
                  margin: isLast ? 0 : "0 0 0.5rem 0",
                  lineHeight: 1.6,
                  fontSize: "0.92rem",
                  color: "#1e293b",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {renderInlineContent(block.content)}
              </p>
            );
          }

          case "bullet-list": {
            return (
              <ul
                key={idx}
                style={{
                  margin: isFirst ? "0 0 0.45rem 0" : isLast ? "0.35rem 0 0 0" : "0.35rem 0 0.45rem 0",
                  paddingLeft: "1.35rem",
                  listStyleType: "disc",
                  listStylePosition: "outside",
                }}
              >
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    style={{
                      margin: "0.22rem 0",
                      lineHeight: 1.55,
                      fontSize: "0.9rem",
                      color: "#1e293b",
                      marginLeft: item.indent > 0 ? "1rem" : 0,
                      listStyleType: item.indent > 0 ? "circle" : "disc",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {renderInlineContent(item.content)}
                  </li>
                ))}
              </ul>
            );
          }

          case "numbered-list": {
            return (
              <ol
                key={idx}
                style={{
                  margin: isFirst ? "0 0 0.45rem 0" : isLast ? "0.35rem 0 0 0" : "0.35rem 0 0.45rem 0",
                  paddingLeft: "1.45rem",
                  listStylePosition: "outside",
                }}
              >
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    value={item.number ? parseInt(item.number, 10) : undefined}
                    style={{
                      margin: "0.22rem 0",
                      lineHeight: 1.55,
                      fontSize: "0.9rem",
                      color: "#1e293b",
                      marginLeft: item.indent > 0 ? "1rem" : 0,
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {renderInlineContent(item.content)}
                  </li>
                ))}
              </ol>
            );
          }

          case "code": {
            return (
              <CodeBlock
                key={idx}
                code={block.content}
                language={block.language}
                id={`${message.id || "msg"}-${idx}`}
              />
            );
          }

          case "table": {
            return (
              <MarkdownTable
                key={idx}
                headers={block.headers}
                rows={block.rows}
              />
            );
          }

          case "blockquote": {
            return (
              <blockquote
                key={idx}
                style={{
                  margin: "0.5rem 0",
                  padding: "6px 12px",
                  borderLeft: "3px solid #6a8cff",
                  background: "rgba(106, 140, 255, 0.06)",
                  borderRadius: "0 8px 8px 0",
                  color: "#334155",
                  fontSize: "0.88rem",
                  lineHeight: 1.55,
                  fontStyle: "italic",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {renderInlineContent(block.content)}
              </blockquote>
            );
          }

          case "hr": {
            return (
              <hr
                key={idx}
                style={{
                  border: "none",
                  borderTop: "1px solid rgba(0, 0, 0, 0.1)",
                  margin: "0.65rem 0",
                }}
              />
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
