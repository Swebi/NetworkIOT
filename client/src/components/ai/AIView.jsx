import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, Loader2, AlertCircle } from "lucide-react";
import { chatWithAI } from "@/data/api";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Which zones are at risk of overcrowding?",
  "Which zones are currently overcrowded?",
  "How has occupancy changed recently?",
  "What's the current device breakdown?",
  "Are there any zones I should be worried about?",
];

export function AIView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text) {
    const msg = text.trim();
    if (!msg || loading) return;

    const userMsg = { role: "user", content: msg };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const history = nextMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const { reply } = await chatWithAI(msg, history);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      const detail = err.message || "Failed to reach AI.";
      setError(detail);
      setMessages(nextMessages.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="-m-6 flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Bot className="size-5 text-primary" />
          <div>
            <h1 className="text-base font-semibold">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">
              Ask about occupancy, zones at risk, or crowd trends
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {empty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Bot className="size-8 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Ask about your space</p>
              <p className="text-sm text-muted-foreground mt-1">
                I have access to live occupancy data, zone thresholds, and history.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 max-w-2xl",
              msg.role === "user" ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {msg.role === "user" ? (
                <User className="size-3.5" />
              ) : (
                <Bot className="size-3.5" />
              )}
            </div>
            <div
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
              style={{ whiteSpace: "pre-wrap" }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-2xl">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bot className="size-3.5" />
            </div>
            <div className="rounded-xl bg-muted px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your zones or occupancy…"
            disabled={loading}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 leading-relaxed"
            style={{ maxHeight: "120px", overflowY: "auto" }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40 hover:opacity-90"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
