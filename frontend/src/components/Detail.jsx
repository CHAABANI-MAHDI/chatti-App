import { useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import VoicePlayback from "./detail/VoicePlayback";
import { formatDuration } from "./detail/formatDuration";
import DetailHeader from "./detail/DetailHeader";
import DetailInfoPanel from "./detail/DetailInfoPanel";
import MessageBubble from "./detail/MessageBubble";

function Detail({
  chat,
  onSendMessage,
  sendingMessage = false,
  socketStatus = "disconnected",
}) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState("");
  const [pendingImageName, setPendingImageName] = useState("");
  const [pendingAudioDataUrl, setPendingAudioDataUrl] = useState("");
  const [pendingAudioName, setPendingAudioName] = useState("");
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const preservedScrollTopRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);
  const lastHandledMessageKeyRef = useRef("");

  const chatMessages = Array.isArray(chat?.messages) ? chat.messages : [];
  const lastMessage = chatMessages[chatMessages.length - 1] || null;
  const sharedImages = useMemo(() => {
    const uniqueImages = new Set();

    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const imageUrl = String(chatMessages[index]?.imageUrl || "").trim();
      if (imageUrl) {
        uniqueImages.add(imageUrl);
      }
    }

    return Array.from(uniqueImages);
  }, [chatMessages]);

  // Reset state when switching chats
  useEffect(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      recordingCancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }

    setIsInfoOpen(false);
    setMessageText("");
    setPendingImageDataUrl("");
    setPendingImageName("");
    setPendingAudioDataUrl("");
    setPendingAudioName("");
    setIsRecordingAudio(false);
    setRecordingElapsedSeconds(0);
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

  // Handle new messages — always scroll to latest (sent and received)
  useEffect(() => {
    if (!chat?.id || !lastMessage) return;
    const node = messagesContainerRef.current;
    if (!node) return;

    const nextKey = `${lastMessage.id || ""}:${lastMessage.timestamp || ""}:${lastMessage.text || ""}:${lastMessage.imageUrl || ""}:${lastMessage.audioUrl || ""}:${lastMessage.fromMe ? "1" : "0"}`;
    if (lastHandledMessageKeyRef.current === nextKey) return;
    lastHandledMessageKeyRef.current = nextKey;

    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    setNewMessageCount(0);
    shouldAutoScrollRef.current = true;
    return () => window.cancelAnimationFrame(frame);
  }, [chat?.id, lastMessage]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const node = messagesContainerRef.current;
      if (!node) return;

      if (preservedScrollTopRef.current > 0) {
        node.scrollTop = preservedScrollTopRef.current;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isInfoOpen]);

  useEffect(() => {
    if (!isRecordingAudio) {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      return undefined;
    }

    const updateElapsed = () => {
      const elapsed = Math.floor(
        (Date.now() - recordingStartedAtRef.current) / 1000,
      );
      setRecordingElapsedSeconds(Math.max(0, elapsed));
    };

    updateElapsed();
    recordingTimerRef.current = window.setInterval(updateElapsed, 1000);

    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isRecordingAudio]);

  useEffect(() => {
    if (!isRecordingAudio) return undefined;

    const handleEscapeToCancel = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();

      if (mediaRecorderRef.current?.state === "recording") {
        recordingCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
    };

    window.addEventListener("keydown", handleEscapeToCancel);
    return () => {
      window.removeEventListener("keydown", handleEscapeToCancel);
    };
  }, [isRecordingAudio]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }

      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }
    };
  }, []);

  const clearPendingImage = () => {
    setPendingImageDataUrl("");
    setPendingImageName("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const clearPendingAudio = () => {
    setPendingAudioDataUrl("");
    setPendingAudioName("");
  };

  const handlePickImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !String(file.type || "")
        .toLowerCase()
        .startsWith("image/")
    ) {
      alert("Please choose a valid image file.");
      clearPendingImage();
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      alert("Image is too large. Max allowed size is 6MB.");
      clearPendingImage();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPendingImageDataUrl(
        typeof reader.result === "string" ? reader.result : "",
      );
      setPendingImageName(file.name || "image");
    };
    reader.readAsDataURL(file);
  };

  const handleEmojiSelect = (emojiData) => {
    setMessageText((prev) => `${prev}${emojiData.emoji}`);
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current?.state !== "recording") return;
    recordingCancelledRef.current = true;
    mediaRecorderRef.current.stop();
  };

  const startAudioRecording = async () => {
    if (isRecordingAudio || sendingMessage) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      alert("Voice recording is not supported in this browser.");
      return;
    }

    try {
      clearPendingAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recordingCancelledRef.current = false;
      recordingStartedAtRef.current = Date.now();
      setRecordingElapsedSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = recordingChunksRef.current || [];
        recordingChunksRef.current = [];

        if (recordingStreamRef.current) {
          recordingStreamRef.current
            .getTracks()
            .forEach((track) => track.stop());
          recordingStreamRef.current = null;
        }

        if (!chunks.length) {
          setIsRecordingAudio(false);
          setRecordingElapsedSeconds(0);
          recordingCancelledRef.current = false;
          recordingStartedAtRef.current = 0;
          mediaRecorderRef.current = null;
          return;
        }

        if (recordingCancelledRef.current) {
          setIsRecordingAudio(false);
          setRecordingElapsedSeconds(0);
          recordingCancelledRef.current = false;
          recordingStartedAtRef.current = 0;
          mediaRecorderRef.current = null;
          return;
        }

        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });

        if (blob.size > 10 * 1024 * 1024) {
          alert("Audio is too large. Max allowed size is 10MB.");
          setIsRecordingAudio(false);
          setRecordingElapsedSeconds(0);
          recordingCancelledRef.current = false;
          recordingStartedAtRef.current = 0;
          mediaRecorderRef.current = null;
          return;
        }

        const fileReader = new FileReader();
        fileReader.onload = () => {
          setPendingAudioDataUrl(
            typeof fileReader.result === "string" ? fileReader.result : "",
          );
          setPendingAudioName(
            `Voice message (${Math.ceil(blob.size / 1024)} KB)`,
          );
          setIsRecordingAudio(false);
          setRecordingElapsedSeconds(0);
          recordingCancelledRef.current = false;
          recordingStartedAtRef.current = 0;
          mediaRecorderRef.current = null;
        };
        fileReader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRecordingAudio(true);
      setIsEmojiPickerOpen(false);
    } catch (error) {
      alert(error?.message || "Microphone access denied.");
      setIsRecordingAudio(false);
      setRecordingElapsedSeconds(0);
      recordingCancelledRef.current = false;
      recordingStartedAtRef.current = 0;
      mediaRecorderRef.current = null;
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }
    }
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (
      (!text && !pendingImageDataUrl && !pendingAudioDataUrl) ||
      !chat ||
      sendingMessage
    )
      return;
    try {
      await onSendMessage?.(chat, {
        text,
        imageDataUrl: pendingImageDataUrl,
        audioDataUrl: pendingAudioDataUrl,
      });
      setMessageText("");
      clearPendingImage();
      clearPendingAudio();
      setIsEmojiPickerOpen(false);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (error) {
      alert(error.message || "Failed to send message.");
    }
  };

  const toggleInfoPanel = () => {
    const node = messagesContainerRef.current;
    if (node) {
      preservedScrollTopRef.current = node.scrollTop;
    }

    setIsInfoOpen((prev) => !prev);
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
              <MessageBubble
                key={`${message.id || "msg"}-${index}`}
                bubbleKey={`${message.id || "msg"}-${index}`}
                message={message}
                fallbackTime={chat.time}
              />
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
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickImage}
        />
        <button
          type="button"
          title="Send image"
          onClick={() => imageInputRef.current?.click()}
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
              d="M4 16l4.5-4.5a2 2 0 012.828 0L16 16m-2-2l1.5-1.5a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zm4-10h.01"
            />
          </svg>
        </button>

        <button
          type="button"
          title={isRecordingAudio ? "Stop recording" : "Record voice message"}
          onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-white/90 transition-colors ${
            isRecordingAudio
              ? "border-rose-300/60 bg-rose-300/20 hover:bg-rose-300/25"
              : "border-white/20 bg-white/10 hover:bg-white/15"
          }`}
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

      {pendingImageDataUrl ? (
        <div className="mt-2 rounded-xl border border-white/20 bg-black/25 p-2">
          <div className="flex items-start gap-3">
            <img
              src={pendingImageDataUrl}
              alt="Selected"
              className="h-20 w-20 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white/85">
                {pendingImageName || "Selected image"}
              </p>
              <p className="text-[11px] text-white/60">
                This image will be uploaded when you send.
              </p>
            </div>
            <button
              type="button"
              onClick={clearPendingImage}
              className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[11px] text-white/85 hover:bg-white/15"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {pendingAudioDataUrl ? (
        <div className="mt-2 rounded-xl border border-white/20 bg-black/25 p-2">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/85">
              <svg
                className="h-5 w-5"
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
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white/85">
                {pendingAudioName || "Voice message"}
              </p>
              <VoicePlayback src={pendingAudioDataUrl} className="mt-1" />
            </div>
            <button
              type="button"
              onClick={clearPendingAudio}
              className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[11px] text-white/85 hover:bg-white/15"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {isRecordingAudio ? (
        <div className="mt-2 rounded-xl border border-rose-300/35 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">
          Recording voice... {formatDuration(recordingElapsedSeconds)} (tap mic
          to stop, Esc to cancel)
          <button
            type="button"
            onClick={cancelAudioRecording}
            className="ml-2 rounded border border-rose-200/40 bg-rose-300/15 px-2 py-0.5 text-[10px] text-rose-50 hover:bg-rose-300/25"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <p className="px-1 text-[11px] text-white/65 md:hidden">
        Type your message, then tap Send.
      </p>
    </div>
  );

  // ── Info panel ─────────────────────────────────────────────────────────────
  const infoContent = (
    <DetailInfoPanel
      chat={chat}
      avatarInitial={avatarInitial}
      sharedImages={sharedImages}
    />
  );

  // ── Root layout ────────────────────────────────────────────────────────────
  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden bg-[#15261d]/35 p-3 md:p-5">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header — shrink-0 so it never collapses */}
        <DetailHeader
          chat={chat}
          avatarInitial={avatarInitial}
          connectionLabel={connectionLabel}
          connectionTone={connectionTone}
          isInfoOpen={isInfoOpen}
          onToggleInfo={toggleInfoPanel}
        />

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
