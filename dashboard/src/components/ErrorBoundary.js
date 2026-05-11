import { React } from "../lib/sdk.js";

/**
 * Error Boundary to prevent a single component crash from white-screening
 * the entire Cronalytics plugin tab.
 */
export class PluginErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return React.createElement(
        "div",
        {
          style: {
            padding: "2rem",
            color: "var(--color-destructive, #ef4444)",
            textAlign: "center",
            fontFamily: "var(--theme-font-mono, monospace)",
          },
        },
        React.createElement(
          "div",
          { style: { fontWeight: 700, marginBottom: "0.5rem" } },
          "Cronalytics Error"
        ),
        React.createElement(
          "div",
          { style: { fontSize: "0.85rem", opacity: 0.8 } },
          "Something went wrong. Please refresh or contact support."
        )
      );
    }
    return this.props.children;
  }
}
