import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Goa Social" },
      { name: "description", content: "Terms and conditions governing use of Goa Social — a social network and digital marketplace." },
      { property: "og:title", content: "Terms & Conditions — Goa Social" },
      { property: "og:description", content: "Terms and conditions for using Goa Social." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <AppLayout>
      <article className="prose prose-sm max-w-none px-5 py-6 text-foreground">
        <h1 className="text-2xl font-bold">Terms &amp; Conditions</h1>
        <p className="text-xs text-muted-foreground">Last updated: 09 July 2026</p>

        <p>
          Welcome to Goa Social (<a href="https://goasocial.in">goasocial.in</a>), operated by the
          owner of Goa Social (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By accessing
          or using the website, mobile experience, or any related services (collectively, the
          &ldquo;Platform&rdquo;), you agree to be bound by these Terms &amp; Conditions.
        </p>

        <h2 className="mt-6 text-lg font-semibold">1. About the Platform</h2>
        <p>
          Goa Social is (a) a community social network for people connected to Goa and (b) a digital
          marketplace through which the owner sells digital products, downloads, and subscription
          services. Third-party sellers are not currently supported.
        </p>

        <h2 className="mt-6 text-lg font-semibold">2. Eligibility &amp; Accounts</h2>
        <ul className="list-disc pl-5">
          <li>You must be at least 18 years old (or the age of majority in your jurisdiction) to register.</li>
          <li>You are responsible for all activity under your account and for keeping your credentials secure.</li>
          <li>We may suspend or terminate accounts that violate these Terms or applicable law.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">3. User Content &amp; Conduct</h2>
        <p>You agree not to post content that is unlawful, hateful, defamatory, sexually explicit involving minors, infringing, spammy, or misleading. You retain ownership of content you post but grant us a worldwide, royalty-free licence to host, display, and distribute it within the Platform.</p>

        <h2 className="mt-6 text-lg font-semibold">4. Digital Products &amp; Subscriptions</h2>
        <ul className="list-disc pl-5">
          <li>All purchases on the Platform are for digital goods or subscription access sold directly by the owner.</li>
          <li>Prices are displayed in the applicable currency at checkout and are inclusive of taxes where required.</li>
          <li>Subscriptions renew automatically at the end of each billing cycle until cancelled by you from your account settings.</li>
          <li>Access to purchased digital goods is granted immediately upon successful payment.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">5. Payments</h2>
        <p>Payments are processed by third-party payment gateways. By purchasing, you agree to the payment provider&rsquo;s terms in addition to these Terms. We do not store your full card details.</p>

        <h2 className="mt-6 text-lg font-semibold">6. Intellectual Property</h2>
        <p>The Platform, its design, logos, and content (excluding user-generated content) are owned by us and protected by law. You may not copy, modify, or redistribute Platform materials without written permission.</p>

        <h2 className="mt-6 text-lg font-semibold">7. Disclaimers</h2>
        <p>The Platform is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee uninterrupted or error-free service.</p>

        <h2 className="mt-6 text-lg font-semibold">8. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, our aggregate liability arising out of or relating to the Platform is limited to the amount you paid us in the 3 months preceding the claim.</p>

        <h2 className="mt-6 text-lg font-semibold">9. Governing Law</h2>
        <p>These Terms are governed by the laws of India. Courts at Panaji, Goa shall have exclusive jurisdiction.</p>

        <h2 className="mt-6 text-lg font-semibold">10. Contact</h2>
        <p>Questions? Email <a href="mailto:support@goasocial.in">support@goasocial.in</a>.</p>

        <p className="mt-8 text-sm">
          See also our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> and{" "}
          <Link to="/refunds" className="text-primary underline">Refund Policy</Link>.
        </p>
      </article>
    </AppLayout>
  );
}
