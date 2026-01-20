export function normalizeHtmlText(input = "") {
  if (!input) return "";

  // 1. Create DOM parser
  const div = document.createElement("div");
  div.innerHTML = input;

  // 2. Convert <p>, <br> into new lines
  let text = div.innerText || div.textContent || "";

  // 3. Normalize spaces
  return text
    .replace(/\u00A0/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}
