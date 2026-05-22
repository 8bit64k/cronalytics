import { React, useRef, useState, useEffect } from "../lib/sdk.js";
import { useCronalyticsI18n } from "../i18n/index.js";

/**
 * Modal overlay with Escape-to-close, backdrop click, and resize tracking.
 */
export function Modal({ isOpen, onClose, children, maxWidth }) {
  const t = useCronalyticsI18n();
  const backdropRef = useRef(null);
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function update() {
      const el = document.querySelector("main") || document.body;
      const r = el.getBoundingClientRect();
      setBounds({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isOpen]);

  if (!isOpen) return null;

  return React.createElement(
    "div",
    {
      ref: backdropRef,
      role: "dialog",
      "aria-modal": true,
      onClick: (e) => {
        if (e.target === backdropRef.current) onClose();
      },
      style: {
        position: "fixed",
        top: (bounds && bounds.top) || 0,
        left: (bounds && bounds.left) || 0,
        width: (bounds && bounds.width) || "100%",
        height: (bounds && bounds.height) || "100%",
        background: "rgba(0,0,0,0.78)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          background: "var(--background)",
          color: "var(--foreground-base, var(--foreground))",
          border: "1px solid var(--color-border)",
          borderRadius: "0.5rem",
          width: "100%",
          maxWidth: maxWidth || "28rem",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          position: "relative",
        },
      },
      React.createElement(
        "button",
        {
          type: "button",
          "aria-label": t("modal.close", "Close"),
          onClick: onClose,
          style: {
            position: "absolute",
            top: "0.6rem",
            right: "0.6rem",
            width: "2rem",
            height: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "0.35rem",
            color: "var(--foreground-base, var(--foreground))",
            fontSize: "1.25rem",
            cursor: "pointer",
            lineHeight: 1,
            transition: "background 0.15s ease",
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.16)";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          },
        },
        "\u00d7"
      ),
      children
    )
  );
}
