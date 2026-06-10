import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 text-center ${className ?? ''}`}>
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
