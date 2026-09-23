import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";
import { LegalDocumentLayout } from "@/app/_components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
  description: `How ${APP_NAME} handles your data.`,
};

const LAST_UPDATED = "September 23, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        {APP_NAME} is an open-source client for browsing and organizing your Google
        Drive. This policy describes what information is involved when you use the
        app and how it is handled.
      </p>

      <h2>Summary</h2>
      <ul>
        <li>
          We do not operate a central database that stores your Google account
          password, your Drive files, or a copy of your file library.
        </li>
        <li>
          Your files stay in Google Drive. {APP_NAME} accesses them only through
          Google&apos;s APIs after you sign in with Google.
        </li>
        <li>
          Most app data (tags, preferences, activity history, caches) is stored
          locally in your browser, on your device.
        </li>
        <li>
          {APP_NAME} is open source. You can review the code and run your own
          instance.
        </li>
      </ul>

      <h2>Information we process</h2>
      <p>
        <strong>Google sign-in.</strong> When you choose &quot;Continue with
        Google,&quot; Google&apos;s OAuth service authenticates you. Google may show
        you which permissions {APP_NAME} requests (for example, access to Google
        Drive). We do not receive or store your Google password.
      </p>
      <p>
        <strong>Access tokens.</strong> After sign-in, a short-lived Google access
        token is kept in your browser session storage so the app can call the Drive
        API on your behalf. It is cleared when you sign out or close the session,
        according to your browser behavior.
      </p>
      <p>
        <strong>Drive metadata and content.</strong> When you browse, search, or
        preview files, {APP_NAME} requests file metadata and sometimes file
        content from Google&apos;s servers directly. That traffic goes between your
        browser and Google, not into a {APP_NAME} user database.
      </p>
      <p>
        <strong>Local data on your device.</strong> To improve your experience,
        the app may store data in your browser using technologies such as{" "}
        <code className="text-[13px]">localStorage</code>,{" "}
        <code className="text-[13px]">sessionStorage</code>, and{" "}
        <code className="text-[13px]">IndexedDB</code>. Examples include UI
        preferences, recent searches, tags and labels you create, pinned items,
        activity log entries, and cached thumbnails. This data stays on your device
        unless you clear site data or uninstall the app.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your personal information.</li>
        <li>
          We do not maintain a proprietary cloud backup of your Drive files for
          this open-source deployment model.
        </li>
        <li>
          We do not require a separate {APP_NAME} account beyond your Google
          account.
        </li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        <strong>Google.</strong> Your use of Google Drive and Google sign-in is
        governed by{" "}
        <a href="https://policies.google.com/privacy" rel="noopener noreferrer">
          Google&apos;s Privacy Policy
        </a>
        . {APP_NAME} is not affiliated with Google.
      </p>
      <p>
        <strong>Optional features.</strong> If you enable integrations that call
        other providers (for example, optional AI or analytics features in a
        self-hosted build), those providers may process data according to their
        own policies. Only enable features you trust.
      </p>
      <p>
        <strong>Hosting.</strong> If you access {APP_NAME} on a website someone
        else hosts, that host may collect standard web server logs (such as IP
        address and request time). That is separate from {APP_NAME}&apos;s
        application logic and depends on how the site is deployed.
      </p>

      <h2>Open source</h2>
      <p>
        {APP_NAME} is published as open-source software for now. The source code
        is available in the project repository so you can inspect how data is
        handled. If you self-host, you are responsible for configuring your
        environment and any server-side storage your deployment uses.
      </p>

      <h2>Children</h2>
      <p>
        {APP_NAME} is not directed at children under 13. You must meet
        Google&apos;s age requirements to use a Google account with the app.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy as the project evolves. The &quot;Last
        updated&quot; date at the top will change when we do. Continued use after
        changes means you accept the revised policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy can be sent through the contact method listed on
        the {APP_NAME} homepage or in the open-source repository.
      </p>
    </LegalDocumentLayout>
  );
}
