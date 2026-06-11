import type { Staff } from "@/lib/types";
import { displayName } from "@/lib/types";
import { SignOutButton } from "./SignOutButton";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  pharmacist_scheduler: "Scheduler",
  tech_supervisor: "Supervisor",
  pharmacist: "Pharmacist",
  tech: "Technician",
  read_only: "Read-only",
};

export function Header({ staff }: { staff: Staff }) {
  return (
    <header className="bg-optum-blue">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-white">
            Optum<span className="text-optum-orange">.</span>
          </span>
          <span className="text-sm text-blue-200">Scheduling</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight text-white">
              {displayName(staff)}
            </p>
            <p className="text-xs leading-tight text-blue-200">
              {ROLE_LABELS[staff.app_role] ?? staff.app_role}
            </p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
