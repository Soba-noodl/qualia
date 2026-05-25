/* eslint react/no-danger: "warn" */

const HTML = { __html: "<b>x</b>" };
export const Bad = () => <div dangerouslySetInnerHTML={HTML} />;
export const Good = () => <div>safe</div>;
