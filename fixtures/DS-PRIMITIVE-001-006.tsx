/* eslint react/forbid-elements: ["error", { "forbid": [ {"element": "button", "message": "DS-PRIMITIVE-001: use <Button>"}, {"element": "select", "message": "DS-PRIMITIVE-002: use <Select>"}, {"element": "option", "message": "DS-PRIMITIVE-002: use <Select>"}, {"element": "textarea", "message": "DS-PRIMITIVE-004: use <Textarea>"}, {"element": "table", "message": "DS-PRIMITIVE-005: use <Table>"}, {"element": "dialog", "message": "DS-PRIMITIVE-006: use <Dialog>"} ] }] */

// positive
export const Bad = () => (
  <div>
    <button>x</button>
    <select><option>y</option></select>
    <textarea />
    <table />
    <dialog>z</dialog>
  </div>
);
// negative — capitalized component names are NOT html elements
function Button(props: any) { return <span {...props} />; }
function Select(props: any) { return <span {...props} />; }
export const Good = () => (
  <div>
    <Button>x</Button>
    <Select />
    <input type="hidden" />
  </div>
);
