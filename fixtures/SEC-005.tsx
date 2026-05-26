/* eslint react/jsx-no-target-blank: ["error", { "allowReferrer": false, "enforceDynamicLinks": "always" }] */

export const Bad = () => <a href="https://x.com" target="_blank">x</a>;
export const Bad2 = () => <a href="https://x.com" target="_blank" rel="noopener">x</a>;
export const Good = () => <a href="https://x.com" target="_blank" rel="noopener noreferrer">x</a>;
