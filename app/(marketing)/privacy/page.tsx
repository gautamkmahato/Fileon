import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config/brand";
import { LegalDocumentLayout } from "../_components/LegalDocumentLayout";

export const metadata: Metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
  description: `How ${APP_NAME} handles your data.`,
};

const LAST_UPDATED = "October 3, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        {APP_NAME} is an open-source client for browsing and organizing your Google
        Drive. This policy describes what Google user data the app accesses, how
        that data is used, stored, shared, and protected, and how you can delete it.
      </p>
      <p>
        {APP_NAME} accesses the Google user data you authorize at sign-in: your
        name, email address, profile photo, and Google account ID, plus — for
        the Google Drive files and folders you choose in Google&apos;s file
        picker — their names, types, sizes, dates, parents, sharing state,
        starred and trashed state, owner names and email addresses, and the
        contents of files you preview, open, or download. {APP_NAME} uses the
        limited <code className="text-[13px]">drive.file</code> permission, so
        it cannot see files you did not pick. The app can also create, upload,
        rename, move, star, trash, restore, permanently delete, and change
        sharing on those files when you take that action.
      </p>
      <p>
        {APP_NAME} uses that data only to provide the file manager you requested.
        It does not sell Google user data, use it for advertising, or use Google
        Drive or other Workspace API data to develop, improve, or train
        generalized or non-personalized AI or machine-learning models.
      </p>
      <p>
        Security procedures are in place to protect the confidentiality of your
        Google user data. We use encryption (HTTPS) to protect it in transit. The
        access token stays in your browser and is deleted when you sign out.
        Drive file contents are not stored on a {APP_NAME} server.
      </p>
      <p>
        We do not transfer or disclose your Google user data to third parties for
        purposes other than providing this file manager. The requests go from
        your browser to Google. We do not share it with advertisers, data brokers,
        or information resellers.
      </p>
      <p>
        We keep the access token only until you sign out or it expires. Other
        app data stays in your browser until you sign out or clear site data for
        this website. You may request deletion of data stored by {APP_NAME} on
        your device by signing out and clearing this site&apos;s data in your
        browser. Files that remain in Google Drive are deleted only when you
        delete them there.
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

      <h2>Google user data we access</h2>
      <p>
        When you click &quot;Continue with Google,&quot; {APP_NAME} requests access
        to the following Google user data. We do not receive or store your Google
        password.
      </p>
      <ul>
        <li>
          <strong>Google account profile</strong> (OpenID, email, and profile):
          your name, email address, profile photo, and Google account ID. This
          identifies the signed-in user inside the app.
        </li>
        <li>
          <strong>Google Drive files and folders you pick</strong> (
          <code className="text-[13px]">drive.file</code> scope): for those items,
          file and folder names, types, sizes, created and modified dates, parent
          folders, starred and trashed state, sharing state, and owner names and
          email addresses when Google includes them. {APP_NAME} also reads file content when you preview, open, or
          download a file, and it can create, upload, rename, move, star, trash,
          restore, delete, and change sharing on files in your Drive when you do
          those actions yourself.
        </li>
      </ul>
      <p>
        {APP_NAME} does not access Gmail, Calendar, Contacts, or any other Google
        product.
      </p>

      <h2>How we use Google user data</h2>
      <p>
        We use this data only to provide the file manager you signed in to use:
        show your Drive, search it, preview and download files you open, and
        apply the organize, share, and cleanup actions you confirm. We use your
        name, email, and profile photo only to show who is signed in.
      </p>
      <p>
        We do not sell Google user data. We do not use it for advertising, credit,
        lending, or to build marketing profiles. We do not use Google user data,
        including data from Google Drive or other Workspace APIs, to develop,
        improve, or train generalized or non-personalized AI or machine-learning
        models.
      </p>

      <h2>How we protect Google user data</h2>
      <p>
        Google user data is treated as sensitive. These protections apply to the
        hosted {APP_NAME} app:
      </p>
      <ul>
        <li>
          Traffic between your browser and Google uses HTTPS, so the access token
          and Drive data are encrypted in transit.
        </li>
        <li>
          The Google access token is kept only in your browser&apos;s session
          storage. It is short-lived and is deleted when you sign out.
        </li>
        <li>
          {APP_NAME} does not send your Drive files, file contents, or Google
          profile to a {APP_NAME} server or database. Listing, preview, and
          download requests go from your browser directly to Google.
        </li>
        <li>
          We do not store your Google password. Google handles sign-in.
        </li>
        <li>
          A metadata snapshot used to reopen a folder quickly (file id, name,
          type, size, and dates — not file contents and not owner email
          addresses) stays in session storage for that tab only and is deleted
          on sign-out.
        </li>
      </ul>

      <h2>Sharing Google user data</h2>
      <p>
        We do not sell, rent, or transfer Google user data to third parties.
        We do not disclose it to advertisers, data brokers, or information
        resellers. The only parties that process it while you use the hosted app
        are:
      </p>
      <ul>
        <li>
          <strong>Google</strong>, because the app calls the Google Drive API and
          Google sign-in from your browser.
        </li>
        <li>
          <strong>You</strong>, on your device. Tags, saved views, pins, activity
          history, and thumbnail caches are stored in your browser (
          <code className="text-[13px]">localStorage</code>,{" "}
          <code className="text-[13px]">sessionStorage</code>, and{" "}
          <code className="text-[13px]">IndexedDB</code>
          ), not on our servers.
        </li>
      </ul>
      <p>
        The site host may keep ordinary web server logs (IP address, time, and
        requested URL). Those logs do not include Drive file contents or your
        Google access token.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          The access token and the file-list snapshot are removed when you sign
          out, and the token also expires on its own.
        </li>
        <li>
          Tags, preferences, and other browser data stay on your device until you
          sign out where the feature clears them, or until you clear site data
          for {APP_NAME} in your browser.
        </li>
        <li>
          Your files remain in Google Drive under your Google account. Deleting
          them in {APP_NAME} deletes them in Drive. We do not keep a separate
          copy.
        </li>
      </ul>
      <p>
        To delete data {APP_NAME} stored on your device, sign out and clear site
        data for this website in your browser. That removes the token, tags,
        caches, and local history. It does not delete files that are still in
        your Google Drive.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your personal information or Google user data.</li>
        <li>
          We do not maintain a proprietary cloud backup of your Drive files.
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
        <strong>Hosting.</strong> If you access {APP_NAME} on a website someone
        else hosts, that host may collect standard web server logs (such as IP
        address and request time). That is separate from {APP_NAME}&apos;s
        application logic and depends on how the site is deployed. A self-hosted
        copy must follow this same policy for Google user data: use it only to
        provide the file manager, and do not sell it or use it to train
        generalized AI or machine-learning models.
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
