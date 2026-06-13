import { Settings } from "lucide-react";
import { ComingSoon } from "../_components/coming-soon";

export default function OwnerSettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      subtitle="ตั้งค่าระบบ"
      description="ตั้งค่าข้อมูลสนาม การชำระเงิน ช่องทางการแจ้งเตือน และแบรนด์ (โลโก้/สี) — กำลังพัฒนา"
      Icon={Settings}
    />
  );
}
