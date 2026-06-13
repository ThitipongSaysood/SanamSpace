import { UserCog } from "lucide-react";
import { ComingSoon } from "../_components/coming-soon";

export default function OwnerStaffPage() {
  return (
    <ComingSoon
      title="Staff"
      subtitle="จัดการพนักงาน"
      description="จัดการพนักงาน บทบาท (Manager / Reception / Cashier / Marketing) และสิทธิ์การใช้งาน — กำลังพัฒนา"
      Icon={UserCog}
    />
  );
}
