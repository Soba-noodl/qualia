/* eslint no-restricted-imports: ["warn", { "paths": [{ "name": "@/components/ui/toast", "message": "IMPORT-004: legacy toast — use sonner." }, { "name": "@/components/ui/use-toast", "message": "IMPORT-004: legacy toast — use sonner." }, { "name": "@/hooks/use-toast", "message": "IMPORT-004: legacy toast — use sonner." }] }] */

// positive
import { toast as t1 } from "@/components/ui/toast";
// @ts-ignore
import { useToast } from "@/components/ui/use-toast";
// @ts-ignore
import { useToast as h2 } from "@/hooks/use-toast";
// negative
import { toast } from "sonner";

export { t1, useToast, h2, toast };
