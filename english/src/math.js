import { escapeHTML as esc } from "./storage.js";
export const symbols = [
  ["√", "\\sqrt{x}", "Raiz quadrada"],
  ["x²", "x^{2}", "Potência"],
  ["a/b", "\\frac{a}{b}", "Fração"],
  ["xₙ", "x_{n}", "Índice"],
  ["ⁿ√", "\\sqrt[n]{x}", "Raiz de ordem n"],
  ["Σ", "\\sum_{i=1}^{n} x_i", "Somatório"],
  ["∫", "\\int_{a}^{b} f(x)\\,dx", "Integral"],
  ["π", "\\pi", "Pi"],
  ["Δ", "\\Delta", "Delta"],
  ["±", "\\pm", "Mais ou menos"],
  ["×", "\\times", "Multiplicação"],
  ["≤", "\\leq", "Menor ou igual"],
];
export function mathHTML(value, display = false) {
  if (!window.katex) return esc(value);
  return window.katex.renderToString(value, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    maxExpand: 200,
    maxSize: 20,
    output: "htmlAndMathml",
  });
}
export function mathToolbar() {
  return `<div class="math-toolbar" aria-label="Símbolos matemáticos">${symbols.map(([label, code, title]) => `<button type="button" class="symbol" data-math="${esc(code)}" title="${title}" aria-label="${title}">${label}</button>`).join("")}</div>`;
}
function inline(text) {
  return text
    .split(/(\$[^$\n]+\$)/g)
    .map((part) =>
      part.startsWith("$") && part.endsWith("$")
        ? mathHTML(part.slice(1, -1))
        : esc(part).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"),
    )
    .join("");
}
export function markdown(text) {
  return text
    .split(/(\$\$[\s\S]*?\$\$)/g)
    .map((part) => {
      if (part.startsWith("$$") && part.endsWith("$$"))
        return `<div class="formula-block">${mathHTML(part.slice(2, -2), true)}</div>`;
      return part
        .split("\n")
        .map((line) => {
          if (/^### /.test(line)) return `<h3>${inline(line.slice(4))}</h3>`;
          if (/^## /.test(line)) return `<h2>${inline(line.slice(3))}</h2>`;
          if (/^# /.test(line)) return `<h1>${inline(line.slice(2))}</h1>`;
          if (/^- /.test(line))
            return `<p class="md-list">• ${inline(line.slice(2))}</p>`;
          return line ? `<p>${inline(line)}</p>` : '<div class="md-gap"></div>';
        })
        .join("");
    })
    .join("");
}
export function insertText(area, text) {
  const start = area.selectionStart,
    end = area.selectionEnd;
  area.setRangeText(text, start, end, "end");
  area.focus();
  area.dispatchEvent(new Event("input", { bubbles: true }));
}
