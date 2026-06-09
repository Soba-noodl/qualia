/* eslint react/forbid-elements: ["error", { "forbid": [{"element": "input", "message": "use <Input>"}] }] */

// All <input> would fire — even hidden/file which are exempt per the rule
export const Bad = () => (
  <div>
    <input type="text" />
    <input type="hidden" />
    <input type="file" />
  </div>
);
