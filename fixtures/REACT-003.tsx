/* eslint react/no-unstable-nested-components: ["error", { "allowAsProps": true }] */

import React from "react";

export function Bad() {
  // positive
  function Inner() { return <span>bad</span>; }
  return <Inner />;
}

const Outer = () => <span>good</span>;
export function Good() {
  return <Outer />;
}
