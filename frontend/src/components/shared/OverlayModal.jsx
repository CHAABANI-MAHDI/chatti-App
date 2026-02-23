function OverlayModal({ isOpen, onClose, containerClassName, children }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={containerClassName} onClick={onClose}>
      <div
        className="max-h-[min(88dvh,760px)] w-full max-w-[min(94vw,520px)] overflow-y-auto rounded-2xl border border-white/20 bg-[#132219]/95 p-4 shadow-2xl sm:max-w-lg sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default OverlayModal;
