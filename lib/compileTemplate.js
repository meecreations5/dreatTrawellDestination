//lib/compileTemplate.js

export function compileTemplate(template, variables = {}) {
  if (!template) return "";

  let output = template;

  Object.keys(variables).forEach(key => {
    const value = variables[key] ?? "";
    output = output.replaceAll(`{{${key}}}`, value);
  });

  return output;
}
