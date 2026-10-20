"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const smallScreenQuery = "(max-width: 1099px)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(smallScreenQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getSnapshot = () => window.matchMedia(smallScreenQuery).matches;
const getServerSnapshot = () => false;

function ThemeImage({
  name,
  width,
  height,
}: {
  name: string;
  width: number;
  height: number;
}) {
  return (
    <>
      <Image
        className="mobile-light-asset"
        src={`/mobile/${name}-light.svg`}
        alt=""
        width={width}
        height={height}
      />
      <Image
        className="mobile-dark-asset"
        src={`/mobile/${name}-dark.svg`}
        alt=""
        width={width}
        height={height}
      />
    </>
  );
}

function DesktopPrompt() {
  const pathname = usePathname();
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const input = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setLink(window.location.href);
    setStatus("idle");
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [pathname]);

  async function copyLink() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    const currentLink = window.location.href;
    setLink(currentLink);
    try {
      await navigator.clipboard.writeText(currentLink);
      setStatus("copied");
      resetTimer.current = setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    }
  }

  const displayLink =
    status === "error" ? link : link.replace(/^https?:\/\//, "");
  return (
    <main
      className="mobile-desktop-prompt"
      aria-labelledby="desktop-prompt-title"
    >
      <div className="mobile-wordmark">Margin</div>
      <section className="mobile-prompt-content">
        <h1 id="desktop-prompt-title">
          <span className="sr-only">Margin is made for a bigger screen</span>
          <ThemeImage name="desktop-heading" width={292} height={73} />
        </h1>
        <p className="mobile-prompt-description">
          Open this link on a laptop or desktop.
        </p>
        <div className="mobile-link-field">
          <span className="mobile-monitor" aria-hidden="true">
            <ThemeImage name="monitor" width={16} height={16} />
          </span>
          <input
            ref={input}
            aria-label="Link to open on your computer"
            readOnly
            value={displayLink}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="mobile-copy-button"
            onClick={copyLink}
            aria-label={status === "copied" ? "Link copied" : "Copy link"}
          >
            <span className="mobile-copy-icon" aria-hidden="true">
              {status === "copied" ? (
                <Check size={15} />
              ) : (
                <ThemeImage name="link" width={15} height={15} />
              )}
            </span>
            <span>{status === "copied" ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <p className="mobile-copy-status" role="status" aria-live="polite">
          {status === "copied"
            ? "Copied. Paste it into a browser on your computer."
            : status === "error"
              ? "Select and copy the link above."
              : ""}
        </p>
      </section>
    </main>
  );
}

export function ScreenSizeGate({ children }: { children: ReactNode }) {
  const smallScreen = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return (
    <>
      <div className="mobile-only">
        <DesktopPrompt />
      </div>
      <div className="desktop-only">{smallScreen ? null : children}</div>
    </>
  );
}
