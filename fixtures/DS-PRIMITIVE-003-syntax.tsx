/* eslint no-restricted-syntax: ["error", { "selector": "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file)$/]))", "message": "DS-PRIMITIVE-003: use <Input>" }] */

export const Bad = () => (
  <div>
    <input type="text" />
    <input />
    <input type="email" />
    <input type="hidden" />
    <input type="file" />
  </div>
);
