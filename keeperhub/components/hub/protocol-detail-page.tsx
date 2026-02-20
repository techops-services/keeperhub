"use client";

import { useRouter } from "next/navigation";
import type { ProtocolDefinition } from "@/keeperhub/lib/protocol-registry";
import { ProtocolDetail } from "./protocol-detail";

export function ProtocolDetailPage({
  protocol,
}: {
  protocol: ProtocolDefinition;
}): React.ReactElement {
  const router = useRouter();
  return (
    <div className="pointer-events-auto fixed inset-0 overflow-y-auto bg-sidebar">
      <div className="md:ml-[var(--nav-sidebar-width,60px)]">
        <div className="container mx-auto px-4 pt-28 pb-12">
          <ProtocolDetail
            onBack={() => router.push("/hub?tab=protocols")}
            protocol={protocol}
          />
        </div>
      </div>
    </div>
  );
}
