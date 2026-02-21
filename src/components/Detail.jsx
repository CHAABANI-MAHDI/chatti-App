import { useEffect, useState } from "react";

function Detail({ chat, isMobile = false }) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  useEffect(() => {
    setIsInfoOpen(false);
  }, [chat?.id]);

  if (!chat) {
    return (
      <section className="flex flex-1 items-center justify-center p-6 text-white/80">
        <div className="rounded-xl border border-white/20 bg-black/20 px-5 py-4 text-sm">
          Select a chat to view details.
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-1 flex-col bg-[#15261d]/65 p-3 md:p-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="mb-4 flex flex-col gap-3 rounded-xl border border-white/20 bg-white/12 px-3 py-3 sm:flex-row sm:items-center sm:justify-between md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/30 font-semibold text-white">
              {chat.avatar}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-white">
                {chat.name}
              </h2>
              <p className="text-sm text-white/70">{chat.lastSeen}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
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

        {!isInfoOpen ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/15 bg-black/20 p-3 md:p-4">
              {chat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm text-white shadow ${
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
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/12 p-2">
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 rounded-lg bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/70 outline-none"
                readOnly
              />
              <button
                type="button"
                className="rounded-lg bg-[#5e8b5a]/85 px-4 py-2 text-sm font-medium text-white hover:bg-[#5e8b5a]"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <aside className="flex-1 overflow-y-auto rounded-xl border border-white/20 bg-white/12 p-4">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/30 text-2xl font-semibold text-white">
                {chat.avatar}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {chat.name}
                </h3>
                <p className="text-sm text-white/70">{chat.status}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-white/90">
              <div className="rounded-lg border border-white/20 bg-black/20 p-3">
                <p className="text-[11px] text-white/60">Email</p>
                <p className="text-white">{chat.email ?? "not-set@example.com"}</p>
              </div>
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
        )}
      </div>
    </section>
  );
}

export default Detail;
