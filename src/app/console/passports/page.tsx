import { PageHeader } from "@/components/common/PageHeader";
import { PassportList } from "@/components/passport/PassportList";

export const dynamic = "force-dynamic";

export default function PassportsPage() {
  return (
    <>
      <PageHeader
        title="通行证"
        description="为每一个 Agent 签发结构化的能力令牌：工具白名单、数据域、调用配额、有效期、风险等级。"
      />
      <PassportList />
    </>
  );
}
