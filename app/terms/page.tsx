import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";
import { LegalDocumentLayout } from "@/app/_components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: `Terms of Service — ${APP_NAME}`,
  description: `Terms for using ${APP_NAME}.`,
};

const LAST_UPDATED = "September 23, 2026";

export default function TermsOfServicePage() {
  return (
    <LegalDocumentLayout title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) apply to your use of {APP_NAME},
        an open-source application that helps you browse and organize files in
        Google Drive. By using {APP_NAME}, you agree to these Terms.
      </p>

      <h2>The service</h2>
      <p>
        {APP_NAME} provides a user interface and tools that connect to your Google
        Drive account via Google&apos;s APIs. We do not host your files. File
        storage, sharing settings, and account security for your Google account
        remain Google&apos;s responsibility.
      </p>

      <h2>Your Google account</h2>
      <p>
        You must have a valid Google account and comply with{" "}
        <a href="https://policies.google.com/terms" rel="noopener noreferrer">
          Google&apos;s Terms of Service
        </a>{" "}
        and applicable Google API policies. You are responsible for the activity
        that occurs under your Google account when using {APP_NAME}.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use {APP_NAME} in violation of any law or third-party rights.</li>
        <li>
          Attempt to break, overload, or reverse-engineer Google&apos;s services
          or {APP_NAME} in ways that harm others.
        </li>
        <li>
          Use the app to distribute malware, spam, or illegal content through
          Drive.
        </li>
      </ul>

      <h2>Open-source software</h2>
      <p>
        {APP_NAME} is provided as open-source software for now. It is offered on
        an &quot;as is&quot; and &quot;as available&quot; basis, without
        warranties of any kind, whether express or implied, including fitness for
        a particular purpose or non-infringement, to the fullest extent permitted
        by law.
      </p>
      <p>
        You may fork, modify, or self-host the software subject to the license
        included in the repository. Operators of self-hosted instances are
        responsible for their own deployments, security, and compliance.
      </p>

      <h2>No professional advice</h2>
      <p>
        {APP_NAME} is a productivity tool, not legal, financial, or compliance
        advice. Features such as cleanup suggestions or organization helpers are
        aids only. Review important actions (especially delete, share, or
        revoke access) before you confirm them in Google Drive.
      </p>

      <h2>Data and privacy</h2>
      <p>
        Our{" "}
        <a href="/privacy">Privacy Policy</a> explains how data is handled. In
        short: we do not maintain a central database of your Drive files; most
        app-specific data stays in your browser. Google processes sign-in and
        Drive access.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, the contributors and operators of
        {APP_NAME} will not be liable for any indirect, incidental, special,
        consequential, or punitive damages, or for loss of data, profits, or
        goodwill, arising from your use of the app or inability to use it,
        including issues caused by Google outages, token expiry, browser data
        loss, or user error.
      </p>

      <h2>Changes to the service and Terms</h2>
      <p>
        We may change features or these Terms as the project develops. Material
        changes will be reflected by updating the date on this page. If you
        disagree with updated Terms, stop using {APP_NAME}.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using {APP_NAME} at any time by signing out and clearing
        site data. We may discontinue or modify the hosted version without
        notice, especially during early access or open-source preview periods.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws applicable in your place of
        residence or the jurisdiction chosen by the primary maintainers of the
        project, without regard to conflict-of-law rules. If any provision is
        unenforceable, the remaining provisions remain in effect.
      </p>

      <h2>Contact</h2>
      <p>
        For questions about these Terms, use the contact information on the{" "}
        {APP_NAME} homepage or in the project repository.
      </p>
    </LegalDocumentLayout>
  );
}
