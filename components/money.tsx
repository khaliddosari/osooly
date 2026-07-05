import { formatAmount } from "@/lib/format";
import { RiyalSymbol } from "@/components/riyal-symbol";

/**
 * Money display (PRD §3.5 cards). SAR renders with the official Saudi Riyal
 * symbol per SAMA's usage guidelines: symbol to the left of the numeral
 * (rule 1) with a space between them (rule 2), and the group forced `ltr`
 * so it doesn't reorder inside `dir="rtl"` Arabic layout - the guidelines'
 * own Arabic-language examples keep the symbol left of the numeral too.
 * Negative values fall out correctly with no extra handling: `toLocaleString`
 * already puts the minus sign directly on the numeral (rule 4: symbol left
 * of both the sign and the number). Every other currency keeps the plain
 * ISO-code text the design system previously used for all currencies
 * ("245,000 USD").
 */
export function Money({
  value,
  currency = "SAR",
  fractionDigits,
}: {
  value: number;
  currency?: string;
  fractionDigits?: number;
}) {
  const amount = formatAmount(value, fractionDigits);

  if (currency !== "SAR") {
    return (
      <>
        {amount} {currency}
      </>
    );
  }

  return (
    <span dir="ltr" className="inline-flex items-baseline gap-1">
      <RiyalSymbol />
      {amount}
    </span>
  );
}
