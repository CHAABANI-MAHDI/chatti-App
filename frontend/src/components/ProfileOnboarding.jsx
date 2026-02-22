import { useState } from "react";

function ProfileOnboarding({ contactValue, initialName, onComplete, onSkip }) {
  const [name, setName] = useState(
    initialName && initialName !== "User" ? initialName : "",
  );
  const [image, setImage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const fileReader = new FileReader();
    fileReader.onload = () => {
      setImage(typeof fileReader.result === "string" ? fileReader.result : "");
    };
    fileReader.readAsDataURL(file);
  };

  const handleContinue = async (event) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Please type your name or click Skip.");
      return;
    }

    setErrorMessage("");

    try {
      setIsSubmitting(true);
      await onComplete({
        name: trimmedName,
        image,
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to save profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setErrorMessage("");

    try {
      setIsSubmitting(true);
      await onSkip();
    } catch (error) {
      setErrorMessage(error.message || "Failed to continue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewInitial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <section className="mx-auto flex h-full w-full max-w-[460px] items-center justify-center">
      <div className="w-full rounded-3xl border border-white/25 bg-[#132219]/75 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-7">
        <div className="mb-5">
          <h1 className="text-left text-2xl font-semibold tracking-tight text-white">
            Complete Your Profile
          </h1>
          <p className="mt-1 text-left text-sm text-white/70">
            Add your name and photo before entering chat, or skip for now.
          </p>
          {contactValue && (
            <p className="mt-2 text-left text-xs text-white/60">
              {contactValue}
            </p>
          )}
        </div>

        <form className="space-y-3" onSubmit={handleContinue}>
          <div>
            <p className="mb-1 text-left text-xs text-white/70">
              Profile photo
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-black/20 px-3 py-2">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-semibold text-white">
                {image ? (
                  <img
                    src={image}
                    alt="Profile preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{previewInitial}</span>
                )}
              </div>
              <label className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-1 text-left text-xs text-white/70">Name</p>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
              {errorMessage}
            </p>
          )}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#5e8b5a]/85 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5e8b5a]"
            >
              {isSubmitting ? "Saving..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default ProfileOnboarding;
