import { describe, it, expect } from 'vitest';
import { classify } from '../classifier.js';

describe('classify', () => {
  it('tags .tsx with JSX as ux:component', () => {
    expect(classify('src/pages/Dashboard.tsx', 'export const X = () => <div>hi</div>;')).toBe('ux:component');
  });

  it('tags .ts with React.createElement as ux:component', () => {
    expect(classify('src/lib/render.ts', 'React.createElement("div", null, "x")')).toBe('ux:component');
  });

  it('tags export*.ts as ux:export', () => {
    expect(classify('src/lib/exportAuditPdf.ts', 'export const make = () => {}')).toBe('ux:export');
  });

  it('tags schema with .message() as ux:validation', () => {
    expect(classify('src/forms/foo.schema.ts', 'z.string().min(1).message("required")')).toBe('ux:validation');
  });

  it('tags index.html as ux:metadata', () => {
    expect(classify('index.html', '<!doctype html><title>x</title>')).toBe('ux:metadata');
  });

  it('tags edge-fn JSON responses with error/message as ux:strings', () => {
    const code = `export default async (req) => {
      return new Response(JSON.stringify({ error: 'missing param' }), { status: 400 });
    };`;
    expect(classify('supabase/functions/auth-foo/index.ts', code)).toBe('ux:strings');
  });

  it('tags supabase/migrations as skip:migration', () => {
    expect(classify('supabase/migrations/0042_foo.sql', '-- sql')).toBe('skip:migration');
  });

  it('tags .types.ts as skip:types', () => {
    expect(classify('src/foo.types.ts', 'export type X = string;')).toBe('skip:types');
  });

  it('tags .test.ts as skip:test', () => {
    expect(classify('src/foo.test.ts', 'describe("x", ()=>{})')).toBe('skip:test');
  });

  it('tags vite.config.ts as skip:config', () => {
    expect(classify('vite.config.ts', 'export default {}')).toBe('skip:config');
  });

  it('tags pure utility (no JSX, no UX hints) as skip:plumbing', () => {
    expect(classify('src/lib/math.ts', 'export const sum = (a:number,b:number)=>a+b;')).toBe('skip:plumbing');
  });

  it('flags ambiguous content as unknown', () => {
    expect(classify('src/lib/notify.ts', 'import { toast } from "sonner"; export const x = () => toast.success("y");')).toBe('unknown');
  });

  // Hook file classification
  it('classifies src/hooks/use-*.ts with toast.error() as ux:strings', () => {
    const code = `import { toast } from 'sonner';
export function useMyHook() {
  const handleError = () => toast.error('Something went wrong');
  return { handleError };
}`;
    expect(classify('src/hooks/use-my-hook.ts', code)).toBe('ux:strings');
  });

  it('classifies src/hooks/use-*.tsx with toast.success() as ux:strings', () => {
    const code = `import { toast } from 'sonner';
export function useMyHook() {
  const handleSuccess = () => toast.success('Saved!');
}`;
    expect(classify('src/hooks/use-my-hook.tsx', code)).toBe('ux:strings');
  });

  it('classifies src/hooks/use-*.ts without toast calls as skip:plumbing', () => {
    const code = `import { useState } from 'react';
export function useCounter() {
  const [count, setCount] = useState(0);
  return { count, increment: () => setCount(c => c + 1) };
}`;
    expect(classify('src/hooks/use-counter.ts', code)).toBe('skip:plumbing');
  });
});
