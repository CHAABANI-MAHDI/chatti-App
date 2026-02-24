import VoicePlayback from "./VoicePlayback";

function MessageBubble({ message, fallbackTime, bubbleKey }) {
  return (
    <div
      key={bubbleKey}
      className={`w-fit max-w-[92%] break-words rounded-2xl px-3 py-2 text-sm text-white shadow sm:max-w-[85%] md:max-w-[75%] ${
        message.fromMe
          ? "ml-auto bg-[#6ca56a]/80 text-right"
          : "mr-auto bg-white/25"
      }`}
    >
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
        {!message.fromMe && !message.read && (
          <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/80">
            New
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span>{message.timestamp || fallbackTime}</span>
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
  );
}

export default MessageBubble;
