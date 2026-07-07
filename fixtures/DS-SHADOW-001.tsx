/* eslint tailwindcss/no-arbitrary-value: "warn" */

export const Bad = () => <div className="shadow-[0_1px_2px_rgba(0,0,0,0.1)]">x</div>;
export const Good = () => <div className="shadow-md">x</div>;
