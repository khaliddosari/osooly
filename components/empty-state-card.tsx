import Link from "next/link";
import { Icon } from "./icon";

/**
 * The fresh-dashboard placeholder (PRD §3.4 empty-state rule): exactly one
 * centered glass card with a dashed border, an FA plus, and "Add your first
 * card." Clicking it opens the Customize sheet (route lands in S3).
 */
export function EmptyStateCard() {
  return (
    <Link
      href="/customize"
      className="glass glass-hover group flex flex-col items-center justify-center gap-4 border-dashed px-14 py-12 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-purple-tint">
        <Icon name="add" className="text-primary" style={{ fontSize: 22 }} />
      </span>
      <span className="text-headline-md text-on-surface">Add your first card</span>
      <span className="max-w-xs text-body-md text-on-surface-variant">
        Pick the asset classes you care about from the Customize sheet.
      </span>
    </Link>
  );
}
