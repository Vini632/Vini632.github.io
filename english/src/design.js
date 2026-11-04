import { escapeHTML as esc, download } from "./storage.js";
import { uid } from "./model.js";
export function svgMarkup(shapes) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500"><rect width="800" height="500" fill="#f4f4ed"/>${shapes
    .map((p) => {
      const attr = `data-shape="${esc(p.id)}"`;
      if (p.type === "rect")
        return `<rect ${attr} x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="8" fill="${p.color}"/>`;
      if (p.type === "ellipse")
        return `<ellipse ${attr} cx="${p.x + p.w / 2}" cy="${p.y + p.h / 2}" rx="${p.w / 2}" ry="${p.h / 2}" fill="${p.color}"/>`;
      if (p.type === "line")
        return `<line ${attr} x1="${p.x}" y1="${p.y}" x2="${p.x + p.w}" y2="${p.y + p.h}" stroke="${p.color}" stroke-width="4"/>`;
      return `<text ${attr} x="${p.x}" y="${p.y + 28}" fill="${p.color}" font-size="28" font-family="Arial,sans-serif">${esc(p.text)}</text>`;
    })
    .join("")}</svg>`;
}
export function mountDesign(container, file, onChange, toast) {
  let shapes = JSON.parse(file.content),
    selected = null,
    drag = null;
  const update = () => {
    file.content = JSON.stringify(shapes);
    onChange();
  };
  function render() {
    const current = shapes.find((p) => p.id === selected);
    container.innerHTML = `<div class="design-toolbar"><span class="eyebrow">ESTÚDIO GRÁFICO</span><div class="button-row"><button class="button small secondary" data-add="rect">+ Retângulo</button><button class="button small secondary" data-add="ellipse">+ Elipse</button><button class="button small secondary" data-add="line">+ Linha</button><button class="button small secondary" data-add="text">+ Texto</button></div></div><div class="design-layout"><div><div class="design-canvas" aria-label="Prancheta de design. Selecione e arraste os elementos.">${svgMarkup(shapes)}</div><p class="hint">800 × 500 · Arraste elementos ou ajuste as posições nos campos.</p><div class="button-row"><button class="button secondary small" id="export-svg">↓ SVG</button><button class="button secondary small" id="export-png">↓ PNG</button></div></div><div class="inspector"><h3>Elementos <span class="muted">${shapes.length}/200</span></h3>${shapes.length ? `<div class="layers">${shapes.map((s, i) => `<button class="layer ${s.id === selected ? "selected" : ""}" data-layer="${s.id}"><span>${s.type === "text" ? "T" : s.type === "ellipse" ? "○" : s.type === "line" ? "╱" : "□"}</span> ${esc(s.type === "text" ? s.text.slice(0, 16) : `Elemento ${i + 1}`)}</button>`).join("")}</div>` : '<p class="hint">Adicione uma forma ou um título para começar.</p>'}${current ? `<div class="property-grid"><label>X<input type="number" data-property="x" value="${current.x}" min="0" max="780"></label><label>Y<input type="number" data-property="y" value="${current.y}" min="0" max="470"></label><label>Largura<input type="number" data-property="w" value="${current.w}" min="1" max="800"></label><label>Altura<input type="number" data-property="h" value="${current.h}" min="1" max="500"></label></div><label>Cor<input type="color" data-property="color" value="${current.color}"></label>${current.type === "text" ? `<label>Texto<input data-property="text" maxlength="300" value="${esc(current.text)}"></label>` : ""}<div class="button-row"><button class="button secondary small" id="front-layer">Trazer à frente</button><button class="button danger small" id="delete-layer">Excluir</button></div>` : ""}</div></div>`;
    container.querySelectorAll("[data-add]").forEach(
      (b) =>
        (b.onclick = () => {
          if (shapes.length >= 200) {
            toast("Limite de 200 elementos por design.");
            return;
          }
          const p = {
            id: uid(),
            type: b.dataset.add,
            x: 80 + (shapes.length % 8) * 25,
            y: 80 + (shapes.length % 8) * 20,
            w: 160,
            h: b.dataset.add === "line" ? 0 : 100,
            color: "#28584a",
            text: "Seu título aqui",
          };
          shapes.push(p);
          selected = p.id;
          update();
          render();
        }),
    );
    container.querySelectorAll("[data-layer]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.layer;
          render();
        }),
    );
    container.querySelectorAll("[data-property]").forEach(
      (input) =>
        (input.oninput = () => {
          const k = input.dataset.property;
          if (["x", "y", "w", "h"].includes(k)) {
            if (input.value === "") return;
            const value = Number(input.value);
            if (!Number.isFinite(value) || value < 0 || value > 1000) {
              input.setCustomValidity("Use um valor entre 0 e 1000.");
              return;
            }
            current[k] = value;
          } else current[k] = input.value;
          input.setCustomValidity("");
          update();
          const svg = container.querySelector("svg");
          svg.innerHTML = new DOMParser().parseFromString(
            svgMarkup(shapes),
            "image/svg+xml",
          ).documentElement.innerHTML;
          if (k === "text") {
            const layer = [...container.querySelectorAll("[data-layer]")].find(
              (b) => b.dataset.layer === selected,
            );
            if (layer) layer.textContent = "T " + current.text.slice(0, 16);
          }
        }),
    );
    container.querySelector("#delete-layer")?.addEventListener("click", () => {
      shapes = shapes.filter((s) => s.id !== selected);
      selected = null;
      update();
      render();
    });
    container.querySelector("#front-layer")?.addEventListener("click", () => {
      shapes = shapes.filter((s) => s.id !== selected);
      shapes.push(current);
      update();
      render();
    });
    const svg = container.querySelector("svg");
    svg.addEventListener("pointerdown", (e) => {
      const id = e.target.dataset.shape;
      if (!id) return;
      selected = id;
      const p = shapes.find((s) => s.id === id);
      const box = svg.getBoundingClientRect();
      drag = {
        p,
        startX: e.clientX,
        startY: e.clientY,
        x: p.x,
        y: p.y,
        scale: 800 / box.width,
      };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      drag.p.x = Math.round(
        Math.max(
          0,
          Math.min(780, drag.x + (e.clientX - drag.startX) * drag.scale),
        ),
      );
      drag.p.y = Math.round(
        Math.max(
          0,
          Math.min(470, drag.y + (e.clientY - drag.startY) * drag.scale),
        ),
      );
      const next = new DOMParser().parseFromString(
        svgMarkup(shapes),
        "image/svg+xml",
      ).documentElement;
      svg.innerHTML = next.innerHTML;
    });
    const stop = () => {
      if (!drag) return;
      drag = null;
      update();
      render();
    };
    svg.addEventListener("pointerup", stop);
    svg.addEventListener("pointercancel", stop);
    container.querySelector("#export-svg").onclick = () =>
      download(
        new Blob([svgMarkup(shapes)], { type: "image/svg+xml" }),
        file.name.replace(/\.[^.]+$/, "") + ".svg",
      );
    container.querySelector("#export-png").onclick = async () => {
      const blob = new Blob([svgMarkup(shapes)], { type: "image/svg+xml" }),
        url = URL.createObjectURL(blob),
        image = new Image();
      try {
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 1000;
        canvas.getContext("2d").drawImage(image, 0, 0, 1600, 1000);
        const png = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!png) throw new Error();
        download(png, file.name.replace(/\.[^.]+$/, "") + ".png");
      } catch {
        toast("Não foi possível exportar o PNG. Tente o SVG.");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
  }
  render();
}
