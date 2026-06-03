import { Empty } from "@/shared/ui";
export default function BrowserPage() {
  return (
    <div className="mx-auto w-full max-w-[1080px] px-7 py-16">
      <Empty title="No contract selected">
        Add a contract from the sidebar to read its state and send transactions.
        Adding contracts arrives in the next milestone.
      </Empty>
    </div>
  );
}
