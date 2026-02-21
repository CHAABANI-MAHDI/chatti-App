import { useState } from "react";

function Detail({ chat }) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

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
    <section className="flex flex-1 flex-col gap-4 bg-[#1f331f]/35 p-3 md:flex-row md:p-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-4 flex flex-col gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between md:px-4">
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
              className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/85"
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

        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/15 bg-black/10 p-4">
          {chat.messages.map((message, index) => (
            <div
              key={message.id}
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm text-white shadow ${
                message.fromMe
                  ? "ml-auto bg-[#5e8b5a]/75 text-right"
                  : "mr-auto bg-white/20"
              }`}
            >
              <p>{message.text}</p>
              <span className="mt-1 block text-[10px] text-white/65">
                {chat.time.split(" ")[0]} · {index + 1}m
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-2">
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 rounded-lg bg-black/15 px-3 py-2 text-sm text-white placeholder:text-white/60 outline-none"
            readOnly
          />
          <button
            type="button"
            className="rounded-lg bg-[#5e8b5a]/85 px-4 py-2 text-sm font-medium text-white hover:bg-[#5e8b5a]"
          >
            Send
          </button>
        </div>
      </div>

      {isInfoOpen && (
        <aside className="w-full rounded-xl border border-white/20 bg-white/10 p-4 md:w-[240px] md:flex-shrink-0 lg:w-[260px]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30 text-base font-semibold text-white">
              {chat.avatar}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {chat.name}
              </h3>
              <p className="text-xs text-white/70">{chat.status}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-white/90">
            <div className="rounded-lg border border-white/20 bg-black/10 p-3">
              <p className="text-[11px] text-white/60">Email</p>
              <p>{chat.email ?? "not-set@example.com"}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-black/10 p-3">
              <p className="text-[11px] text-white/60">Phone</p>
              <p>{chat.phone ?? "+1 000 000 0000"}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-black/10 p-3">
              <p className="text-[11px] text-white/60">Role</p>
              <p>{chat.role ?? "Team member"}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-black/10 p-3">
              <p className="text-[11px] text-white/60">Timezone</p>
              <p>{chat.timezone ?? "UTC"}</p>
            </div>
          </div>
        </aside>
      )}
    </section>
  );
}

export default Detail;
