import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// eslint-disable-next-line no-restricted-syntax -- REACT-004: React entry point bootstrap; index.html guarantees #root exists
const rootEl = document.getElementById("root")!;
// Remove any bootstrap/placeholder text injected by host (e.g. "JS init OK – waiting for React…")
rootEl.innerHTML = "";
const bootstrapPattern = /JS init OK|waiting for React|mounting React|main\.tsx loaded|React\.render\(\) called/i;
let prev = rootEl.previousElementSibling;
while (prev && bootstrapPattern.test(prev.textContent ?? "")) {
  prev.remove();
  prev = rootEl.previousElementSibling;
}

createRoot(rootEl).render(<App />);
