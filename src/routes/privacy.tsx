import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Goa Social" },
      { name: "description", content: "How Goa Social collects, uses, and protects your personal information." },
      { property: "og:title", content: "Privacy Policy — Goa Social" },
      { property: "og:description", content: "How Goa Social handles your personal data." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <AppLayout>
      <article className="prose prose-sm max-w-none px-5 py-6 text-foreground">
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: 09 July 2026</p>

        <p>
          This Privacy Policy explains how Goa Social (<a href="https://goasocial.in">goasocial.in</a>)
          collects, uses, discloses, and safeguards your information when you use our Platform.
        </p>

        <h2 className="mt-6 text-lg font-semibold">1. Information We Collect</h2>
        <ul className="list-disc pl-5">
          <li><strong>Account data:</strong> username / phone identifier, display name, area, bio, avatar.</li>
          <li><strong>Content:</strong> posts, chats, businesses you list, and interactions.</li>
          <li><strong>Payment data:</strong> billing details processed by our payment gateway (we do not store card numbers).</li>
          <li><strong>Technical data:</strong> IP address, device / browser type, usage logs, cookies.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">2. How We Use Information</h2>
        <ul className="list-disc pl-5">
          <li>Provide and operate the Platform and community features.</li>
          <li>Process purchases of digital products and subscriptions.</li>
          <li>Personalise content and improve performance.</li>
          <li>Communicate service updates and respond to support requests.</li>
          <li>Detect fraud, abuse, and enforce our Terms.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">3. Sharing</h2>
        <p>We share information only with:</p>
        <ul className="list-disc pl-5">
          <li>Payment gateways to process transactions.</li>
          <li>Cloud hosting and infrastructure providers.</li>
          <li>Law enforcement when required by valid legal process.</li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h2 className="mt-6 text-lg font-semibold">4. Cookies</h2>
        <p>We use essential cookies for authentication and basic analytics. You may disable cookies in your browser; some features may stop working.</p>

        <h2 className="mt-6 text-lg font-semibold">5. Data Retention</h2>
        <p>We retain personal data for as long as your account is active or as needed to comply with legal obligations. You may request deletion at any time.</p>

        <h2 className="mt-6 text-lg font-semibold">6. Your Rights</h2>
        <p>You may access, correct, export, or delete your data by emailing us. Under applicable law you may also object to processing or withdraw consent.</p>

        <h2 className="mt-6 text-lg font-semibold">7. Security</h2>
        <p>We use industry-standard security measures including encryption in transit and role-based access controls. No system is 100% secure.</p>

        <h2 className="mt-6 text-lg font-semibold">8. Children</h2>
        <p>The Platform is not directed to children under 18. We do not knowingly collect data from children.</p>

        <h2 className="mt-6 text-lg font-semibold">9. Changes</h2>
        <p>We may update this Policy from time to time. Material changes will be notified on the Platform.</p>

        <h2 className="mt-6 text-lg font-semibold">10. Contact</h2>
        <p>Email <a href="mailto:support@goasocial.in">support@goasocial.in</a> for any privacy request.</p>

        <p className="mt-8 text-sm">
          See also our <Link to="/terms" className="text-primary underline">Terms &amp; Conditions</Link> and{" "}
          <Link to="/refunds" className="text-primary underline">Refund Policy</Link>.
        </p>
      </article>
    </AppLayout>
  );
}
