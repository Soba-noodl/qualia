/* eslint no-restricted-imports: ["error", { "patterns": [{ "group": ["react-icons", "react-icons/*", "@heroicons/*", "@radix-ui/react-icons"], "message": "DS-PRIMITIVE-011: Lucide is the only icon library." }] }] */

// positive
import { FaUser } from "react-icons/fa";
import { CheckIcon } from "@radix-ui/react-icons";
// @ts-ignore
import { HomeIcon } from "@heroicons/react/24/outline";
// negative
import { Home } from "lucide-react";

export { FaUser, CheckIcon, HomeIcon, Home };
