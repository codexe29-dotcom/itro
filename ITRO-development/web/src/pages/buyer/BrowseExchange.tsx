import ExchangeBrowser from "@/components/ExchangeBrowser";
import { PageHeader } from "@/components/ui";

export default function BrowseExchange() {
  return (
    <div>
      <PageHeader
        title="Browse Catalog"
        subtitle="Find accredited services and request a quote."
      />
      <ExchangeBrowser linkTo={(id) => `/app/request/${id}`} />
    </div>
  );
}
