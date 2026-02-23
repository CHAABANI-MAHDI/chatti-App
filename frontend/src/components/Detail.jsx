import { useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";

function Detail({
  chat,
  onSendMessage,
  sendingMessage = false,
  socketStatus = "disconnected",
}) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const lastHandledMessageKeyRef = useRef("");

  const chatMessages = Array.isArray(chat?.messages) ? chat.messages : [];
  const lastMessage = chatMessages[chatMessages.length - 1] || null;

  // Reset state when switching chats
  useEffect(() => {
    setIsInfoOpen(false);
    setMessageText("");
    setIsEmojiPickerOpen(false);
    setNewMessageCount(0);
    shouldAutoScrollRef.current = true;
    lastHandledMessageKeyRef.current = "";

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [chat?.id]);

  // Scroll to bottom when chat first loads
  useEffect(() => {
    const node = messagesContainerRef.current;
    if (!node || !chat?.id) return;
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chat?.id]);

  // Handle new messages — scroll or show badge
  useEffect(() => {
    if (!chat?.id || !lastMessage) return;
    const node = messagesContainerRef.current;
    if (!node) return;

    const nextKey = `${lastMessage.id || ""}:${lastMessage.timestamp || ""}:${lastMessage.text || ""}:${lastMessage.fromMe ? "1" : "0"}`;
    if (lastHandledMessageKeyRef.current === nextKey) return;
    lastHandledMessageKeyRef.current = nextKey;

    const shouldStick =
      shouldAutoScrollRef.current || Boolean(lastMessage.fromMe);
    if (shouldStick) {
      const frame = window.requestAnimationFrame(() => {
        node.scrollTop = node.scrollHeight;
      });
      setNewMessageCount(0);
      return () => window.cancelAnimationFrame(frame);
    }

    if (!lastMessage.fromMe) {
      setNewMessageCount((prev) => prev + 1);
    }
  }, [chat?.id, lastMessage]);

  const handleEmojiSelect = (emojiData) => {
    setMessageText((prev) => `${prev}${emojiData.emoji}`);
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !chat || sendingMessage) return;
    try {
      await onSendMessage?.(chat, text);
      setMessageText("");
      setIsEmojiPickerOpen(false);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (error) {
      alert(error.message || "Failed to send message.");
    }
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!chat) {
    return (
      <section className="flex flex-1 items-center justify-center p-6 text-white/80">
        <div className="rounded-xl border border-white/20 bg-black/20 px-5 py-4 text-sm">
          Select a chat to view details.
        </div>
      </section>
    );
  }

  const avatarInitial =
    chat.avatar || chat.name?.trim()?.charAt(0)?.toUpperCase() || "U";
  const connectionLabel =
    socketStatus === "connected"
      ? "Connected"
      : socketStatus === "reconnecting"
        ? "Reconnecting"
        : socketStatus === "connecting"
          ? "Connecting"
          : socketStatus === "error"
            ? "Error"
            : "Offline";
  const connectionTone =
    socketStatus === "connected"
      ? "border-lime-300/60 bg-lime-200/20 text-lime-100"
      : socketStatus === "reconnecting" || socketStatus === "connecting"
        ? "border-amber-300/60 bg-amber-200/15 text-amber-100"
        : socketStatus === "error"
          ? "border-rose-300/60 bg-rose-200/15 text-rose-100"
          : "border-white/25 bg-white/10 text-white/75";

  // ── Messages + input ───────────────────────────────────────────────────────
  // CRITICAL: overflow-hidden on the flex wrapper prevents ml-auto bubbles from
  // leaking outside. The inner div handles vertical scrolling on its own.
  const messagesContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-2">
      {/* Scrollable message list */}
      <div
        ref={messagesContainerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
          const near = dist <= 90;
          shouldAutoScrollRef.current = near;
          if (near && newMessageCount > 0) setNewMessageCount(0);
        }}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/15 bg-black/20 p-3 md:p-4"
      >
        {/* justify-end so messages sit at the bottom when there are only a few */}
        <div className="flex min-h-full flex-col justify-end gap-3">
          {chatMessages.length === 0 ? (
            <div className="rounded-lg border border-white/15 bg-black/15 p-3 text-sm text-white/70">
              No messages yet. Start the conversation.
            </div>
          ) : (
            chatMessages.map((message, index) => (
              <div
                key={`${message.id || "msg"}-${index}`}
                className={`w-fit max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm text-white shadow md:max-w-[75%] ${
                  message.fromMe
                    ? "ml-auto bg-[#6ca56a]/80 text-right"
                    : "mr-auto bg-white/25"
                }`}
              >
                <p>{message.text}</p>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-white/65">
                  {!message.fromMe && !message.read && (
                    <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/80">
                      New
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <span>{message.timestamp || chat.time}</span>
                    {message.fromMe &&
                      (message.read ? (
                        <span className="flex items-center text-lime-300">
                          <svg
                            className="h-3 w-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M7.629 13.314a1 1 0 01-1.414 0L3.293 10.39a1 1 0 011.414-1.414l2.209 2.21 5.791-5.792a1 1 0 011.414 1.414l-6.492 6.506z" />
                          </svg>
                          <svg
                            className="-ml-1 h-3 w-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M7.629 13.314a1 1 0 01-1.414 0L3.293 10.39a1 1 0 011.414-1.414l2.209 2.21 5.791-5.792a1 1 0 011.414 1.414l-6.492 6.506z" />
                          </svg>
                        </span>
                      ) : message.id ? (
                        <svg
                          className="h-3 w-3 text-white/60"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                        </svg>
                      ) : (
                        <svg
                          className="h-3 w-3 text-white/50"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M12 6v6l4 2"
                          />
                          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
                        </svg>
                      ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* New-message scroll badge */}
      {newMessageCount > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              const node = messagesContainerRef.current;
              if (node) node.scrollTop = node.scrollHeight;
              shouldAutoScrollRef.current = true;
              setNewMessageCount(0);
            }}
            className="rounded-full border border-lime-200/45 bg-lime-200/20 px-3 py-1 text-xs font-medium text-lime-50"
          >
            {newMessageCount} new{" "}
            {newMessageCount === 1 ? "message" : "messages"}
          </button>
        </div>
      )}

      {/* Input bar — shrink-0 keeps it fixed at the bottom regardless of message count */}
      <div className="relative shrink-0 flex items-center gap-2 rounded-2xl border border-white/20 bg-white/12 p-2">
        <button
          type="button"
          title="Send image"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/90 transition-colors hover:bg-white/15 sm:flex"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M4 16l4.5-4.5a2 2 0 012.828 0L16 16m-2-2l1.5-1.5a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zm4-10h.01"
            />
          </svg>
        </button>

        <button
          type="button"
          title="Open camera"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/90 transition-colors hover:bg-white/15 md:flex"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M15 10l4.2-2.1A1 1 0 0121 8.8v6.4a1 1 0 01-1.8.9L15 14m-9 4h8a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>

        <button
          type="button"
          title="Send voice message"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/90 transition-colors hover:bg-white/15 md:flex"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 5a2.5 2.5 0 00-2.5 2.5v4a2.5 2.5 0 005 0v-4A2.5 2.5 0 0012 5zm-5 6.5a5 5 0 0010 0M12 17v3m-3 0h6"
            />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          placeholder="Type your message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="min-w-0 flex-1 rounded-xl bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/70 outline-none"
        />

        <button
          type="button"
          title="Add emoji"
          onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/90 transition-colors hover:bg-white/15"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M14 4h-4a6 6 0 00-6 6v4a6 6 0 006 6h4a6 6 0 006-6v-4a6 6 0 00-6-6z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 10h.01M15 10h.01M9 14c.7.8 1.7 1.2 3 1.2s2.3-.4 3-1.2"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={sendingMessage}
          className="shrink-0 min-w-[72px] rounded-lg bg-[#5e8b5a]/85 px-3 py-2 text-xs font-semibold text-white hover:bg-[#5e8b5a] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[84px] sm:px-4 sm:text-sm"
        >
          {sendingMessage ? "Sending..." : "Send"}
        </button>

        {isEmojiPickerOpen && (
          <div className="emoji-picker-theme absolute bottom-14 right-2 z-20 overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
            <EmojiPicker
              onEmojiClick={handleEmojiSelect}
              width={360}
              height={460}
              theme="dark"
              lazyLoadEmojis
            />
          </div>
        )}
      </div>

      <p className="px-1 text-[11px] text-white/65 md:hidden">
        Type your message, then tap Send.
      </p>
    </div>
  );

  // ── Info panel ─────────────────────────────────────────────────────────────
  const infoContent = (
    <aside className="h-full overflow-y-auto rounded-2xl border border-white/20 bg-white/12 p-4">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/30 text-2xl font-semibold text-white">
          {chat.image ? (
            <img
              src={chat.image}
              alt={chat.name || "User"}
              className="h-full w-full object-cover"
            />
          ) : (
            avatarInitial
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">
            {chat.name}
          </h3>
          <p className="text-sm text-white/70">{chat.status}</p>
        </div>
      </div>

      <div className="space-y-3 text-sm text-white/90">
        {[
          { label: "Phone", value: chat.phone ?? "+1 000 000 0000" },
          { label: "Role", value: chat.role ?? "Team member" },
          { label: "Status", value: chat.lastSeen },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-white/20 bg-black/20 p-3"
          >
            <p className="text-[11px] text-white/60">{label}</p>
            <p className="text-white">{value}</p>
          </div>
        ))}
      </div>
    </aside>
  );

  // ── Root layout ────────────────────────────────────────────────────────────
  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden bg-[#15261d]/35 p-3 md:p-5">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header — shrink-0 so it never collapses */}
        <header className="mb-4 shrink-0 flex items-center justify-between gap-2 rounded-2xl border border-white/20 bg-white/12 px-4 py-3 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/30 text-base font-semibold text-white">
              {avatarInitial}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-white">
                {chat.name}
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-white/70">
                <span>{chat.lastSeen}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${connectionTone}`}
                >
                  {connectionLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/90"
            >
              Call
            </button>
            <button
              type="button"
              onClick={() => setIsInfoOpen((prev) => !prev)}
              className={`rounded-md border px-2 py-1 text-xs text-white/90 ${
                isInfoOpen
                  ? "border-lime-300/70 bg-lime-200/20"
                  : "border-white/20 bg-white/10"
              }`}
            >
              {isInfoOpen ? "Hide Info" : "Info"}
            </button>
          </div>
        </header>

        {/* Mobile: toggle between messages and info */}
        <div className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden md:hidden">
          {isInfoOpen ? infoContent : messagesContent}
        </div>

        {/* Desktop: messages always shown; info slides in beside them */}
        <div className="hidden min-h-0 min-w-0 flex-1 overflow-hidden md:flex">
          {isInfoOpen ? (
            <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden">
              {/* min-w-0 + overflow-hidden keep bubbles inside this column */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {messagesContent}
              </div>
              {/* shrink-0 keeps the info panel at its declared width */}
              <div className="min-h-0 w-[34%] min-w-[250px] max-w-[340px] shrink-0">
                {infoContent}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {messagesContent}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Detail;
