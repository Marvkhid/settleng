import { GitCompareArrows } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Match records" };
export default function ReconciliationPage() {
  return (
    <>
      <PageHeader title="Match records" subtitle="Upload a CSV from your bank or POS and match it to your invoices." />
      <EmptyState icon={<GitCompareArrows className="size-9" />} title="This screen is coming next"
        body="The matching engine is already running in the backend. The upload and review screen is the next piece to be built." />
    </>
  );
}
