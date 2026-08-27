import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund & Cancellation Policy — Goa Social" },
      { name: "description", content: "Refund and cancellation policy for digital products and subscriptions on Goa Social." },
      { property: "og:title", content: "Refund & Cancellation Policy — Goa Social" },
      { property: "og:description", content: "Refund and cancellation terms for Goa Social purchases." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <AppLayout>
      <article className="prose prose-sm max-w-none px-5 py-6 text-foreground">
        <h1 className="text-2xl font-bold">Refund &amp; Cancellation Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: 09 July 2026</p>

        <p>
          This Policy explains refunds and cancellations for digital products and subscriptions sold
          on Goa Social (<a href="https://goasocial.in">goasocial.in</a>).
        </p>

        <h2 className="mt-6 text-lg font-semibold">1. Digital Products (One-time Purchases)</h2>
        <p>
          Because digital products are delivered instantly and cannot be &ldquo;returned&rdquo;, all
          sales are generally final. However, we will issue a full refund if:
        </p>
        <ul className="list-disc pl-5">
          <li>The product was never delivered / could not be accessed due to a technical fault on our side, and we cannot resolve it within 7 days.</li>
          <li>The product is materially different from what was described on its listing page.</li>
          <li>You were charged in duplicate for the same product.</li>
        </ul>
        <p>Refund requests must be made within <strong>7 days</strong> of purchase.</p>

        <h2 className="mt-6 text-lg font-semibold">2. Subscriptions</h2>
        <ul className="list-disc pl-5">
          <li>You may cancel a subscription at any time from your account settings. Cancellation stops future renewals; access continues until the end of the paid billing period.</li>
          <li>We do not provide pro-rated refunds for partially used billing periods.</li>
          <li>If a renewal is charged in error (e.g. after a confirmed cancellation), we will refund the renewal in full.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">3. How to Request a Refund</h2>
        <p>
          Email <a href="mailto:support@goasocial.in">support@goasocial.in</a> from the email address
          used at purchase with:
        </p>
        <ul className="list-disc pl-5">
          <li>Order / transaction ID</li>
          <li>Date of purchase</li>
          <li>Reason for the refund request</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">4. Processing Time</h2>
        <p>
          Approved refunds are processed to the original payment method within <strong>5&ndash;10
          business days</strong>. Your bank or card issuer may take additional time to reflect the
          credit.
        </p>

        <h2 className="mt-6 text-lg font-semibold">5. Non-Refundable Items</h2>
        <ul className="list-disc pl-5">
          <li>Products already substantially downloaded, used, or consumed.</li>
          <li>Purchases where a refund is requested more than 7 days after purchase (except duplicate charges).</li>
          <li>Fees or taxes explicitly marked as non-refundable at checkout.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">6. Chargebacks</h2>
        <p>Please contact us before initiating a chargeback &mdash; most issues can be resolved directly and quickly.</p>

        <h2 className="mt-6 text-lg font-semibold">7. Contact</h2>
        <p>Email <a href="mailto:support@goasocial.in">support@goasocial.in</a>.</p>

        <p className="mt-8 text-sm">
          See also our <Link to="/terms" className="text-primary underline">Terms &amp; Conditions</Link> and{" "}
          <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
        </p>
      </article>
    </AppLayout>
  );
}
