import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, X, FileText, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  extractTextFromFile,
  validateContextFile,
  CONTEXT_FILE_ACCEPT,
} from "@/lib/extract-text";
import { clickableProps } from "@/lib/a11y";
import { toast } from "@/components/ui/sonner";

export interface ContextFileEntry {
  file: File;
  extractedText: string;
  charCount: number;
}

interface ContextFileUploadProps {
  files: ContextFileEntry[];
  onChange: (files: ContextFileEntry[]) => void;
  disabled?: boolean;
  onExtractingChange?: (extracting: boolean) => void;
}

const ContextFileUpload = ({ files, onChange, disabled, onExtractingChange }: ContextFileUploadProps) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  useEffect(() => {
    onExtractingChange?.(extracting);
  }, [extracting, onExtractingChange]);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles = Array.from(fileList);
      if (newFiles.length === 0) return;

      setExtracting(true);
      const entries: ContextFileEntry[] = [];

      for (const file of newFiles) {
        const error = validateContextFile(file);
        if (error) {
          toast.error(`${file.name}: ${error}`);
          continue;
        }

        setCurrentFile(file.name);
        try {
          const text = await extractTextFromFile(file);
          if (!text.trim()) {
            toast.warning(`${file.name}: ${t("noTextExtracted")}`);
            continue;
          }
          entries.push({
            file,
            extractedText: text,
            charCount: text.length,
          });
          toast.success(`${file.name}: ${t("fileAdded")}`);
        } catch (err) {
          console.error("Text extraction error:", err);
          toast.error(`${file.name}: ${t("textExtractionFailed")}`);
        }
      }

      if (entries.length > 0) {
        onChange([...files, ...entries]);
      }
      setCurrentFile(null);
      setExtracting(false);
    },
    [files, onChange, t]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        void processFiles(e.target.files);
        e.target.value = ""; // reset so same file can be re-added
      }
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled || extracting) return;
      void processFiles(e.dataTransfer.files);
    },
    [disabled, extracting, processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = (index: number) => {
    const next = [...files];
    next.splice(index, 1);
    onChange(next);
    toast.info(t("fileRemoved"));
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- clickableProps() spreads role + tabIndex + onKeyDown */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        {...clickableProps(() => {
          if (!disabled && !extracting) inputRef.current?.click();
        })}
        aria-disabled={disabled || extracting}
        className={`
          border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer
          ${disabled || extracting
            ? "border-border/50 bg-surface-1/50 cursor-not-allowed opacity-60"
            : "border-border/60 hover:border-primary/50 bg-surface-1/60 hover:bg-surface-1"
          }
        `}
      >
        {extracting ? (
          <div role="status" aria-live="polite" aria-busy="true">
            <Loader2 className="h-6 w-6 mx-auto mb-2 text-primary animate-spin" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">{t("extractingText")}</p>
            {currentFile && (
              <p className="text-[10px] text-muted-foreground/70 mt-1 truncate max-w-[260px] mx-auto">
                {currentFile}
              </p>
            )}
          </div>
        ) : (
          <>
            <FileUp className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/70" />
            <p className="text-xs text-muted-foreground">{t("dropFilesHere")}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t("supportedFormats")}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={CONTEXT_FILE_ACCEPT}
          multiple
          aria-label="Upload context files"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || extracting}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((entry, i) => (
            <li
              key={`${entry.file.name}-${i}`}
              className="flex items-center gap-2 bg-surface-1/80 border border-border/60 rounded-lg px-3 py-2 text-sm hover:border-border transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="truncate flex-1 text-foreground text-xs font-medium">{entry.file.name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {/* eslint-disable-next-line no-restricted-syntax -- DATE-001: number.toLocaleString() for thousands separators, not a date */}
                {t("characterCount").replace("{count}", entry.charCount.toLocaleString())}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                disabled={disabled}
                className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ContextFileUpload;
