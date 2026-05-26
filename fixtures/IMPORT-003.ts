// In production, this file would be at src/components/ui/foo.tsx and the
// glob-scoped flat config would only apply this rule there.
// @ts-ignore
import a from "@/components/Header";
// @ts-ignore
import b from "@/hooks/useAuth";
// @ts-ignore
import c from "@/services/audits.service";
// negative — cn util is fine
// @ts-ignore
import d from "@/lib/utils";
// @ts-ignore
import e from "@/components/ui/button";
export { a, b, c, d, e };
