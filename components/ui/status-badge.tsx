import { T } from "@/components/i18n/t";
import { Badge } from "@/components/ui/badge";
import type { Status } from "@/lib/domain/types";

/**
 * The one status → variant mapping in the product. Human finishes use the
 * quiet secondary tone; problems use destructive; open states stay neutral.
 */
const statusVariant: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  confirmed: "default",
  pending: "outline",
  cancelled: "secondary",
  rejected: "destructive",
  noshow: "destructive",
  done: "secondary",
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <Badge variant={statusVariant[status]} className={className}>
      <T k={`status.${status}`} />
    </Badge>
  );
}
