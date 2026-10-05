import { TransactionNewForm } from "@/components/forms/transaction-new";

export const metadata = { title: "Add record" };
export default function NewTransactionPage() {
  return (<><h1 className="mb-6 text-3xl font-extrabold md:text-4xl">Add a record</h1><TransactionNewForm /></>);
}
