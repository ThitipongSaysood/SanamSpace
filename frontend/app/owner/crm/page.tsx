import { HeartHandshake } from "lucide-react";
import { ComingSoon } from "../_components/coming-soon";

export default function OwnerCrmPage() {
  return (
    <ComingSoon
      title="CRM"
      subtitle="บริหารลูกค้าสัมพันธ์"
      description="กลุ่มลูกค้า (Segments), แคมเปญ, บรอดแคสต์ผ่าน LINE OA และการติดตามผล — กำลังพัฒนา"
      Icon={HeartHandshake}
    />
  );
}
