/* eslint no-restricted-syntax: ["warn", { "selector": "Literal[value=/(?:^|\\s)![A-Za-z]/]", "message": "TW-IMPORTANT-001: no !-prefixed Tailwind classes" }, { "selector": "TemplateElement[value.raw=/(?:^|\\s)![A-Za-z]/]", "message": "TW-IMPORTANT-001: no !-prefixed Tailwind classes" }] */

export const Bad = () => <div className="!bg-card text-foreground">x</div>;
export const Bad2 = () => <div className="px-2 !text-foreground">x</div>;
export const Good = () => <div className="bg-card text-foreground">x</div>;
