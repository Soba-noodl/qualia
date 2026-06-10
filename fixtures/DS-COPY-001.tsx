/* eslint no-restricted-syntax: ["warn", { "selector": "JSXElement[openingElement.name.name='Button'] > JSXText[value=/(?:\\.\\.\\.|…)\\s*$/]", "message": "DS-COPY-001: no ellipsis on Button labels" }] */

const Button = (p: any) => <button {...p} />;

export const Bad1 = () => <Button>Save…</Button>;
export const Bad2 = () => <Button>Save...</Button>;
export const Good = () => <Button>Save</Button>;
