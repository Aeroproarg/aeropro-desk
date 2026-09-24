import Link from "next/link";
import {
  ClipboardCheck,
  Settings2,
} from "lucide-react";

type Props = {
  href: string;
  type:
    | "equipment"
    | "checklist";
};

export default function ProductionManagementLink({
  href,
  type,
}: Props) {
  const config =
    type === "equipment"
      ? {
          label:
            "Gestionar equipamiento",
          icon: (
            <Settings2
              size={14}
            />
          ),
        }
      : {
          label:
            "Gestionar checklist",
          icon: (
            <ClipboardCheck
              size={14}
            />
          ),
        };

  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-3 text-xs font-medium text-[#45B8E8] transition hover:bg-[#20A4DD]/15"
    >
      {config.icon}

      {config.label}
    </Link>
  );
}