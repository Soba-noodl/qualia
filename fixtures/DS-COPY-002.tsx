/* eslint no-restricted-syntax: ["warn", { "selector": "JSXElement[openingElement.name.name=/^AlertDialog(Action|Cancel)$/] > JSXText[value=/^\\s*(OK|Cancel)\\s*$/]", "message": "DS-COPY-002: name the outcome — no OK/Cancel" }] */

const AlertDialogAction = (p: any) => <button {...p} />;
const AlertDialogCancel = (p: any) => <button {...p} />;

export const Bad1 = () => <AlertDialogAction>OK</AlertDialogAction>;
export const Bad2 = () => <AlertDialogCancel>Cancel</AlertDialogCancel>;
export const Good1 = () => <AlertDialogAction>Delete project</AlertDialogAction>;
export const Good2 = () => <AlertDialogCancel>Keep project</AlertDialogCancel>;
