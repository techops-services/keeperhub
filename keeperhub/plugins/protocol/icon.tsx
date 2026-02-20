import { Box } from "lucide-react";
import Image from "next/image";

export function ProtocolIcon({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return <Box className={className} />;
}

export function createProtocolIconComponent(
  iconPath: string,
  name: string
): React.ComponentType<{ className?: string }> {
  function Icon({ className }: { className?: string }): React.ReactElement {
    return (
      <Image
        alt={name}
        className={className}
        height={16}
        src={iconPath}
        width={16}
      />
    );
  }
  Icon.displayName = `${name}Icon`;
  return Icon;
}
