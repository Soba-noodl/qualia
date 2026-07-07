/* eslint no-restricted-syntax: ["warn", { "selector": "Literal[value=/\\bshadow-\\[/]", "message": "DS-SHADOW-001: use named shadow scale" }, { "selector": "TemplateElement[value.raw=/\\bshadow-\\[/]", "message": "DS-SHADOW-001: use named shadow scale" }] */

export const Bad = () => <div className="shadow-[0_1px_2px_rgba(0,0,0,0.1)]">x</div>;
export const Bad2 = () => <div className={`p-4 shadow-[0_0_0_1px_red]`}>x</div>;
export const Good = () => <div className="shadow-md">x</div>;
