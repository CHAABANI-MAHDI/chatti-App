import { useEffect, useState } from "react";
import EmojiPicker from "emoji-picker-react";

function Detail({ chat, onSendMessage, sendingMessage = false }) {
  // Feature: info panel toggle state
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Feature: reset info panel on chat change
  useEffect(() => {
    setIsInfoOpen(false);
    setMessageText("");
    setIsEmojiPickerOpen(false);
  }, [chat?.id]);

  const handleEmojiSelect = (emojiData) => {
    setMessageText((previous) => `${previous}${emojiData.emoji}`);
  };

  const handleSend = async () => {
    const nextMessage = messageText.trim();
    if (!nextMessage || !chat) {
      return;
    }

    try {
      await onSendMessage?.(chat, nextMessage);
      setMessageText("");
      setIsEmojiPickerOpen(false);
    } catch (error) {
      alert(error.message || "Failed to send message.");
    }
  };

  // Feature: empty chat placeholder
  if (!chat) {
    return (
      <section className="flex flex-1 items-center justify-center p-6 text-white/80">
        <div className="rounded-xl border border-white/20 bg-black/20 px-5 py-4 text-sm">
          Select a chat to view details.
        </div>
      </section>
    );
  }

  const chatMessages = Array.isArray(chat.messages) ? chat.messages : [];
  const avatarInitial =
    chat.avatar || chat.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  // Feature: messages and input area
  const messagesContent = (
    <>
      {/* Feature: message bubbles */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/15 bg-black/20 p-3 md:p-4">
        {chatMessages.length === 0 ? (
          <div className="rounded-lg border border-white/15 bg-black/15 p-3 text-sm text-white/70">
            No messages yet. Start the conversation.
          </div>
        ) : (
          chatMessages.map((message) => (
            <div
              key={message.id}
              className={`w-fit max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm text-white shadow md:max-w-[75%] ${
                message.fromMe
                  ? "ml-auto bg-[#6ca56a]/80 text-right"
                  : "mr-auto bg-white/25"
              }`}
            >
              <p>{message.text}</p>
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/65">
                <span>{message.timestamp || chat.time}</span>
                {message.fromMe && (
                  <svg
                    className={`h-3 w-3 ${
                      message.read ? "text-lime-300" : "text-white/50"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Feature: typing and actions row */}
      <div className="relative mt-4 flex items-center gap-2 rounded-2xl border border-white/20 bg-white/12 p-2">
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
          type="text"
          placeholder="Type your message..."
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 rounded-xl bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/70 outline-none"
        />
        <button
          type="button"
          title="Add sticker"
          onClick={() => setIsEmojiPickerOpen((previous) => !previous)}
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
          className="rounded-lg bg-[#5e8b5a]/85 px-4 py-2 text-sm font-medium text-white hover:bg-[#5e8b5a] disabled:cursor-not-allowed disabled:opacity-60"
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
      <p className="mt-2 px-1 text-[11px] text-white/65 md:hidden">
        Type your message, then tap Send.
      </p>
    </>
  );

  // Feature: contact info panel
  const infoContent = (
    <aside className="h-full overflow-y-auto rounded-2xl border border-white/20 bg-white/12 p-4">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/30 text-2xl font-semibold text-white">
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
        <div>
          <h3 className="text-lg font-semibold text-white">{chat.name}</h3>
          <p className="text-sm text-white/70">{chat.status}</p>
        </div>
      </div>

      <div className="space-y-3 text-sm text-white/90">
        <div className="rounded-lg border border-white/20 bg-black/20 p-3">
          <p className="text-[11px] text-white/60">Phone</p>
          <p className="text-white">{chat.phone ?? "+1 000 000 0000"}</p>
        </div>
        <div className="rounded-lg border border-white/20 bg-black/20 p-3">
          <p className="text-[11px] text-white/60">Role</p>
          <p className="text-white">{chat.role ?? "Team member"}</p>
        </div>
        <div className="rounded-lg border border-white/20 bg-black/20 p-3">
          <p className="text-[11px] text-white/60">Timezone</p>
          <p className="text-white">{chat.timezone ?? "UTC"}</p>
        </div>
        <div className="rounded-lg border border-white/20 bg-black/20 p-3">
          <p className="text-[11px] text-white/60">Status</p>
          <p className="text-white">{chat.lastSeen}</p>
        </div>
      </div>
    </aside>
  );

  return (
    <section className="flex h-full flex-1 flex-col bg-[#15261d]/35 p-3 md:p-5">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Feature: chat header */}
        <header className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-white/20 bg-white/12 px-4 py-3 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/30 text-base font-semibold text-white">
              {avatarInitial}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-white">
                {chat.name}
              </h2>
              <p className="text-sm text-white/70">{chat.lastSeen}</p>
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
              onClick={() => setIsInfoOpen((previous) => !previous)}
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

        {/* Feature: mobile content switch */}
        <div className="min-h-0 flex-1 md:hidden">
          {isInfoOpen ? infoContent : messagesContent}
        </div>

        {/* Feature: desktop content layout */}
        <div className="hidden min-h-0 flex-1 md:flex">
          {isInfoOpen ? (
            <div className="flex min-h-0 flex-1 gap-4">
              <div className="flex min-h-0 flex-1 flex-col">
                {messagesContent}
              </div>
              <div className="min-h-0 w-[34%] min-w-[250px] max-w-[340px]">
                {infoContent}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {messagesContent}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Detail;
