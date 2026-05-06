"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  imageUrls: string[]; // data URIs (in-flight) or /api/images/* paths (saved)
  createdAt: string;
};

type Attachment = {
  id: string;
  data: string; // base64, no prefix
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  previewUrl: string; // data URL for preview / optimistic display
  fileName: string;
};

const SUGGESTIONS = [
  "Build me a study schedule for the rest of this week.",
  "Make a 10-question practice quiz on photosynthesis.",
  "Quiz me on the key dates of World War II.",
  "Break down what I should review for tomorrow's test.",
];

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB per image
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

export default function ChatInterface({
  initialMessages,
  initialInput = "",
}: {
  initialMessages: ChatMessage[];
  initialInput?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState(initialInput);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutorMode, setTutorMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore tutor-mode preference from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    setTutorMode(window.localStorage.getItem("sb_tutor_mode") === "1");
  }, []);

  function toggleTutor() {
    setTutorMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("sb_tutor_mode", next ? "1" : "0");
      }
      return next;
    });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files);
    setError(null);
    const next: Attachment[] = [];
    for (const file of list) {
      if (attachments.length + next.length >= MAX_IMAGES) {
        setError(`You can attach at most ${MAX_IMAGES} images.`);
        break;
      }
      if (!ALLOWED.has(file.type)) {
        setError(`Unsupported file type: ${file.type || file.name}`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over 5MB.`);
        continue;
      }
      const dataUrl = await readAsDataUrl(file);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        data: stripDataUrlPrefix(dataUrl),
        mediaType: file.type as Attachment["mediaType"],
        previewUrl: dataUrl,
        fileName: file.name,
      });
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function send(content: string) {
    const trimmed = content.trim();
    if ((trimmed.length === 0 && attachments.length === 0) || sending) return;
    setError(null);
    setSending(true);

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: trimmed,
      imageUrls: attachments.map((a) => a.previewUrl),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          images: sentAttachments.map((a) => ({
            data: a.data,
            mediaType: a.mediaType,
          })),
          mode: tutorMode ? "tutor" : "normal",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send message.");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setAttachments(sentAttachments);
      } else {
        const storedUrls: string[] = Array.isArray(data.storedImages)
          ? data.storedImages.map(
              (s: { filename: string }) => `/api/images/${s.filename}`
            )
          : optimistic.imageUrls;
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimistic.id),
          {
            id: data.userMessage.id,
            role: data.userMessage.role,
            content: data.userMessage.content,
            imageUrls: storedUrls,
            createdAt: new Date(data.userMessage.createdAt).toISOString(),
          },
          {
            id: data.assistantMessage.id,
            role: data.assistantMessage.role,
            content: data.assistantMessage.content,
            imageUrls: [],
            createdAt: new Date(data.assistantMessage.createdAt).toISOString(),
          },
        ]);
      }
    } catch {
      setError("Network error. Try again.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setAttachments(sentAttachments);
    }
    setSending(false);
  }

  async function clearChat() {
    if (!confirm("Clear the entire chat history?")) return;
    const res = await fetch("/api/chat", { method: "DELETE" });
    if (res.ok) setMessages([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-12">
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">🤖</div>
              <h2 className="text-lg font-semibold text-slate-900">
                Hi! I&apos;m your study buddy.
              </h2>
              <p className="text-slate-600 mt-2 text-sm">
                Tell me what you&apos;re working on — you can also attach
                images of your schedule, notes, or homework problems.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="text-left text-sm rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 transition-all duration-200 hover:border-brand-300 hover:bg-white hover:shadow-md hover:scale-[1.03] active:scale-[0.98]"
                  onClick={() => send(s)}
                  disabled={sending}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {sending && (
              <div className="text-sm text-slate-400 italic">Thinking…</div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white/70 backdrop-blur-sm p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2 gap-2">
            <button
              type="button"
              onClick={toggleTutor}
              aria-pressed={tutorMode}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all duration-200 hover:scale-[1.04] active:scale-[0.98] ${
                tutorMode
                  ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30"
                  : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
              }`}
              title={
                tutorMode
                  ? "Tutor mode is ON — the AI will guide you step-by-step instead of giving direct answers."
                  : "Turn on Tutor Mode for Socratic guidance"
              }
            >
              <span aria-hidden>🎓</span>
              {tutorMode ? "Tutor mode ON" : "Tutor mode"}
            </button>
            {tutorMode && (
              <span className="text-xs text-emerald-700 font-medium">
                Step-by-step guidance — no spoilers
              </span>
            )}
          </div>

          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

          {attachments.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="relative h-20 w-20 rounded-lg overflow-hidden border border-slate-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.previewUrl}
                    alt={a.fileName}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => removeAttachment(a.id)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-900/80 text-white text-xs leading-none flex items-center justify-center hover:bg-red-600 transition-colors"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary h-[44px] px-3"
              title="Attach image"
              disabled={sending || attachments.length >= MAX_IMAGES}
              aria-label="Attach image"
            >
              📎
            </button>
            <textarea
              className="input min-h-[44px] max-h-40 resize-y"
              placeholder="Ask anything — paste or attach images too…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              rows={1}
              disabled={sending}
            />
            <button
              className="btn-primary"
              onClick={() => send(input)}
              disabled={sending || (!input.trim() && attachments.length === 0)}
            >
              Send
            </button>
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>
              Enter to send · Shift+Enter for newline · Paste images directly
            </span>
            {messages.length > 0 && (
              <button onClick={clearChat} className="hover:text-red-600">
                Clear chat
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const hasText = message.content.trim().length > 0;
  const hasImages = message.imageUrls.length > 0;

  return (
    <div
      className={`flex animate-fade-in-up ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white"
            : "bg-white border border-slate-200 text-slate-800"
        }`}
      >
        {hasImages && (
          <div
            className={`grid gap-2 ${hasText ? "mb-3" : ""} ${
              message.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {message.imageUrls.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={url}
                alt=""
                className="max-h-72 w-full object-cover rounded-lg"
              />
            ))}
          </div>
        )}
        {hasText &&
          (isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </p>
          ) : (
            <MarkdownContent content={message.content} />
          ))}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="chat-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          ul: ({ children, ...props }) => (
            <ul className="list-none pl-0 space-y-1.5 my-2" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className="list-decimal pl-5 marker:text-brand-500 marker:font-semibold space-y-1.5 my-2"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed" {...props}>
              {children}
            </li>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-slate-900 mt-3 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-slate-900 mt-3 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-slate-900 mt-2.5 mb-1.5 uppercase tracking-wide">
              {children}
            </h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-brand-700">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-700">{children}</em>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline decoration-brand-300 hover:decoration-brand-600"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code className="rounded bg-brand-50 text-brand-700 px-1.5 py-0.5 text-[0.85em] font-mono border border-brand-100">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 my-2 text-xs overflow-x-auto font-mono">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-brand-400 bg-brand-50/50 pl-3 py-1 my-2 italic text-slate-700 rounded-r">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-slate-200" />,
          p: ({ children }) => (
            <p className="leading-relaxed my-1.5 first:mt-0 last:mb-0">
              {children}
            </p>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-brand-50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-slate-100">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
