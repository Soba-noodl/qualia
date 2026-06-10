import type { ComponentProps } from "react";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "shadow-xl border-0 rounded-lg",
          description: "text-white/90",
          actionButton: "bg-white/20 text-white hover:bg-white/30",
          cancelButton: "bg-white/10 text-white/80",
        },
        style: {
          // Default (info-like) styling using design tokens
          background: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          border: "1px solid hsl(var(--primary))",
        },
      }}
      style={{
        // Ensure highest z-index to sit above modals
        zIndex: 99999,
      }}
      {...props}
    />
  );
};

// Re-export configured toast with proper variant styling
const toast = Object.assign(
  (message: string | React.ReactNode) => sonnerToast(message),
  {
    ...sonnerToast,
    error: (message: string | React.ReactNode, data?: Parameters<typeof sonnerToast.error>[1]) =>
      sonnerToast.error(message, {
        ...data,
        style: {
          background: "hsl(var(--destructive))",
          color: "hsl(var(--destructive-foreground))",
          border: "1px solid hsl(var(--destructive))",
        },
      }),
    // success: full-opacity green-700 + white text — 5.02:1 contrast, passes WCAG AA (DS-COLOR-009).
    success: (message: string | React.ReactNode, data?: Parameters<typeof sonnerToast.success>[1]) =>
      sonnerToast.success(message, {
        ...data,
        style: {
          background: "rgb(21 128 61)",
          color: "rgb(255 255 255)",
          border: "1px solid rgb(21 128 61)",
        },
      }),
    // warning: full-opacity amber-700 + white text — 5.02:1 contrast, passes WCAG AA (DS-COLOR-009).
    warning: (message: string | React.ReactNode, data?: Parameters<typeof sonnerToast.warning>[1]) =>
      sonnerToast.warning(message, {
        ...data,
        style: {
          background: "rgb(180 83 9)",
          color: "rgb(255 255 255)",
          border: "1px solid rgb(180 83 9)",
        },
      }),
    info: (message: string | React.ReactNode, data?: Parameters<typeof sonnerToast.info>[1]) =>
      sonnerToast.info(message, {
        ...data,
        style: {
          background: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          border: "1px solid hsl(var(--primary))",
        },
      }),
  }
);

export { Toaster, toast };
