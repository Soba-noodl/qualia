import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, GripVertical } from "lucide-react";

interface SortableFlowThumbnailProps {
  id: string;
  file: File;
  index: number;
  onRemove: (index: number) => void;
}

const SortableFlowThumbnail = ({
  id,
  file,
  index,
  onRemove,
}: SortableFlowThumbnailProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex-shrink-0 group p-2 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="w-20 h-20 rounded-lg border border-border overflow-hidden bg-surface-1 relative">
        <img
          src={URL.createObjectURL(file)}
          alt={`Step ${index + 1}`}
          className="w-full h-full object-cover"
        />
        {/* Drag handle overlay */}
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </div>
      </div>
      {/* Step number badge */}
      <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium pointer-events-none">
        {index + 1}
      </div>
      {/* Remove button */}
      {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: absolute -top-2 -right-2 remove badge w-5 h-5 rounded-full bg-destructive; group-hover:opacity-100; Button's min-width and shape would break the small circular badge overlaid on the thumbnail */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

export default SortableFlowThumbnail;
