import type { ReactNode } from "react";
import { getAccountingSchemaStatus } from "@/lib/accounting-schema";
import { AccountingSchemaPendingPanel } from "./schema-pending-panel";

type AccountingLayoutProps = {
  children: ReactNode;
};

export default async function AccountingLayout({ children }: AccountingLayoutProps) {
  const status = await getAccountingSchemaStatus();

  if (!status.ready) {
    return <AccountingSchemaPendingPanel status={status} />;
  }

  return children;
}
