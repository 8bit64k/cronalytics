import { React } from "../lib/sdk.js";

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
      return React.createElement("div", {
        style: {
          padding: "2rem",
          textAlign: "center",
          fontFamily: "var(--theme-font-mono, monospace)",
          color: "var(--foreground)",
        }
      },
        React.createElement("h3", { style: { marginBottom: "0.5rem" } }, "Cronalytics Error"),
        React.createElement("p", { style: { opacity: 0.7 } }, "Something went wrong. Please refresh or contact support.")
      );
    }
    return this.props.children;
  }
}
