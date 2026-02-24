import { useState } from "react";
import VoicePlayback from "./VoicePlayback";

function MessageBubble({
  message,
  fallbackTime,
  bubbleKey,
  onRetry,
  onEdit,
  onDelete,
}) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const isPending = Boolean(message?.pending);
  const isFailed = Boolean(message?.failed);
  const isFromMe = Boolean(message?.fromMe);
  const canModify = isFromMe && Boolean(message?.id) && !isPending;
  const statusLabel = isFromMe
    ? isFailed
      ? "Failed"
      : isPending
        ? "Sending..."
        : message.read
          ? "Read"
          : "Delivered"
    : "";
  const statusTimestamp = message.readAt || message.deliveredAt || "";
  const baseTimestamp = message.timestamp || fallbackTime || "";
  const formattedStatusTime = statusTimestamp
    ? new Date(statusTimestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const shouldShowStatusTime =
    formattedStatusTime && formattedStatusTime !== baseTimestamp;

  return (
    <div
      key={bubbleKey}
      className={`relative w-fit max-w-[92%] break-words rounded-2xl px-3 py-2 text-sm text-white shadow sm:max-w-[85%] md:max-w-[75%] ${
        isFromMe ? "ml-auto bg-[#6ca56a]/80 text-right" : "mr-auto bg-white/25"
      }`}
    >
      {canModify ? (
        <div className="absolute right-2 top-2 z-10">
          <button
            type="button"
            onClick={() => setIsActionsOpen((prev) => !prev)}
            className="rounded-md border border-white/20 bg-black/25 px-1.5 py-0.5 text-xs text-white/85 hover:bg-black/35"
            title="Message options"
          >
            ⋯
          </button>

          {isActionsOpen ? (
            <div className="absolute right-0 mt-1 w-24 rounded-md border border-white/20 bg-[#102016] p-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setIsActionsOpen(false);
                  onEdit?.();
                }}
                className="w-full rounded px-2 py-1 text-left text-[11px] text-white/90 hover:bg-white/10"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsActionsOpen(false);
                  onDelete?.();
                }}
                className="w-full rounded px-2 py-1 text-left text-[11px] text-rose-100 hover:bg-rose-300/15"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {message.imageUrl ? (
        <a
          href={message.imageUrl}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <img
            src={message.imageUrl}
            alt="Shared"
            className="max-h-72 w-full min-w-[180px] rounded-xl object-cover"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        </a>
      ) : null}
      {message.text ? (
        <p className={message.imageUrl ? "mt-2" : ""}>{message.text}</p>
      ) : null}
      {message.audioUrl ? (
        <VoicePlayback
          src={message.audioUrl}
          className={
            message.text || message.imageUrl
              ? "mt-2 w-full min-w-[160px] sm:min-w-[240px]"
              : "w-full min-w-[160px] sm:min-w-[240px]"
          }
        />
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-white/65">
        {!isFromMe && !message.read && (
          <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/80">
            New
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span>{baseTimestamp}</span>
          {statusLabel ? (
            <span className={isFailed ? "text-rose-200" : "text-white/70"}>
              {statusLabel}
              {shouldShowStatusTime ? ` ${formattedStatusTime}` : ""}
            </span>
          ) : null}
          {isFromMe &&
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
      {isFailed && isFromMe ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-rose-300/50 bg-rose-300/10 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-300/20"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export default MessageBubble;
