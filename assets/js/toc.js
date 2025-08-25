document.addEventListener("DOMContentLoaded", function () {
  const content = document.querySelector(".content");
  const toc = document.getElementById("toc");
  if (!content || !toc) return;

  const headers = content.querySelectorAll("h1, h2, h3");
  if (!headers.length) return;

  const ul = document.createElement("ul");

  headers.forEach(h => {
    const id = h.id || h.textContent.trim().replace(/\s+/g, "-");
    h.id = id;

    const li = document.createElement("li");
    li.classList.add(`toc-${h.tagName.toLowerCase()}`);

    const a = document.createElement("a");
    a.href = `#${id}`;
    a.textContent = h.textContent;

    li.appendChild(a);
    ul.appendChild(li);
  });

  toc.appendChild(ul);
});
