/* eslint react/jsx-key: "error" */
import React from "react";

const items = ["a", "b"];
// positive: missing key
export const Bad = () => <ul>{items.map((x) => <li>{x}</li>)}</ul>;
// negative: has key
export const Good = () => <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul>;
