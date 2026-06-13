import { Wallet } from "lucide-react";
import { ComingSoon } from "../_components/coming-soon";

export default function OwnerWalletPage() {
  return (
    <ComingSoon
      title="Wallet"
      subtitle="ระบบวอลเล็ต"
      description="จัดการกระเป๋าเงินลูกค้า เติมเงิน และดูประวัติธุรกรรมทั้งหมดของสนาม — กำลังพัฒนา"
      Icon={Wallet}
    />
  );
}
