export type LegalSection = [heading: string, paragraphs: string[]];
export const stillboundsLegalVersion = "2026-11-12-v5";
export const termsSections: LegalSection[] = [
  [
    "Who we are and what these terms cover",
    [
      "Stillbounds is provided by Moyo Ayaworan, based in Nigeria. Contact: ijabikenm@gmail.com. These terms cover the Stillbounds product website, beta-access requests and any beta software supplied under these terms. Separate photography, artwork, bookings and shop services have their own terms.",
      "You must be at least 18, or otherwise have legal capacity to enter this agreement. If you act for a studio or another organisation, you must be authorised to do so. Agreement to these terms is requested when you join the beta list; a software invitation may include additional release-specific terms for you to review before installation.",
    ],
  ],
  [
    "Requesting beta access",
    [
      "Requesting access adds your email to the beta waiting list. It does not guarantee an invitation, an invitation date, a particular feature or continued availability. We may invite participants in stages based on the testing programme.",
      "We may email you to administer your request, provide installation instructions and communicate important beta changes. General product news and promotional updates require the separate optional marketing choice. You can withdraw your request by emailing us.",
    ],
  ],
  [
    "Beta software and availability",
    [
      "The beta is unfinished software. Features, file compatibility and system requirements can change, and errors or interruptions can occur. Separate beta builds target Intel and Apple Silicon Macs. Check the requirements supplied with your invitation before installing.",
      "Keep independent backups of photographs and projects. Test exports before relying on them for client delivery. We will communicate material changes or an end to the beta where reasonably practicable; urgent security or legal issues may require immediate action.",
    ],
  ],
  [
    "Your permission to use the software",
    [
      "If we supply beta access, we grant you a non-exclusive, non-transferable permission to use that release for your own personal or studio work, including making albums for clients, subject to these terms and any installation limits stated in the invitation.",
      "Do not sell, sublicense or distribute the application or access credentials without permission. Do not bypass access controls, introduce malware or use the service unlawfully. Restrictions do not override rights that applicable law gives you, including any permitted interoperability or other statutory exceptions. Third-party and open-source components retain their own licence terms.",
    ],
  ],
  [
    "Your photographs and designs",
    [
      "You retain the rights you hold in your photographs, text, projects and album designs. Importing content does not transfer ownership to Stillbounds. You must have the rights and permissions necessary to use it, including relevant permissions concerning identifiable people.",
      "The website demonstrations use sample photographs and do not upload or save your files. If you choose to send material for support, you give us only the permission reasonably needed to handle that support request. We will seek separate permission before using your work in public marketing.",
    ],
  ],
  [
    "Automation, exports and printing",
    [
      "Automated layouts and photo suggestions are tools for your review. You remain responsible for checking selections, crops, captions, page order, image resolution and exported files. We do not guarantee perfect photo selection, storytelling or certification for a particular print lab.",
      "The current beta offer does not include a printing or delivery service. Review your chosen lab’s size, bleed, colour and file requirements before ordering. Any future printing or online service will need its own disclosed terms.",
    ],
  ],
  [
    "Feedback and confidential client material",
    [
      "You may send ideas and product feedback. You give us a non-exclusive, royalty-free permission to use that feedback to improve Stillbounds without an obligation to pay for the suggestion. This permission does not include your photographs, confidential client files or personal data.",
      "Do not send passwords, payment credentials or client material you lack permission to share. We do not impose a confidentiality agreement simply because you participate in the beta; any separate confidentiality arrangement must be expressly agreed.",
    ],
  ],
  [
    "Pricing, payments and refunds",
    [
      "The planned launch offer is a 30-day free trial followed by a one-time ₦30,000 NGN software purchase, with up to two activated laptops per account. Launch checkout is not open yet. Joining the waiting list or creating a website account does not start the trial, create a payment obligation or authorise an automatic charge. The trial will start on first app activation after verified sign-in.",
      "Before offering a paid product, we will disclose the price, applicable taxes, billing period, cancellation process and refund terms and ask you to accept the relevant purchase conditions. These terms do not exclude any refund or other remedy required by consumer law.",
    ],
  ],
  [
    "Our intellectual property",
    [
      "The application, branding, website text and interface belong to Stillbounds or their respective licensors. Your permission to use the product does not transfer those rights. Credited sample imagery and third-party materials remain subject to their own licences.",
      "You may describe your use of the product accurately. Do not imply endorsement or use our branding in a way that misrepresents your relationship with us.",
    ],
  ],
  [
    "Ending participation",
    [
      "You can stop using the beta or withdraw your waiting-list request at any time. Uninstalling the application does not itself withdraw an email request or delete data held by the website; contact us for that.",
      "We may suspend or end beta access for material misuse, security concerns, legal obligations or the end of testing. Where practical, we will explain the reason and give a reasonable opportunity to save work or resolve an issue. Keep your own project copies. Mandatory legal rights remain unaffected.",
    ],
  ],
  [
    "Responsibility and statutory rights",
    [
      "We will exercise reasonable care in providing the service. Beta status explains the limitations of an unfinished release; it is not a waiver of your legal rights. Neither party is responsible for losses that were not reasonably foreseeable when entering the agreement, to the extent applicable law permits that limitation.",
      "Nothing in these terms excludes or limits liability for fraud, deliberate wrongdoing, death or personal injury caused by negligence, or any liability or consumer remedy that cannot lawfully be excluded. We do not require you to indemnify us for our own wrongdoing.",
    ],
  ],
  [
    "Complaints, law and changes",
    [
      "For complaints, email ijabikenm@gmail.com with the issue and the outcome you seek. We will first try to resolve it directly. These terms are governed by Nigerian law, subject to any mandatory protections applicable to you. They do not prevent complaints to a regulator or access to a court with jurisdiction; there is no mandatory arbitration or class-action waiver.",
      "We will date revisions and notify active participants of material changes where reasonably practicable. We will seek fresh agreement where required, and we will not use a policy change to treat previous marketing opt-outs as consent. If one term is unenforceable, the remaining terms continue to apply to the extent lawful.",
    ],
  ],
];
export const privacySections: LegalSection[] = [
  ["Accounts, payments and laptop activation", [
    "Registering uses your name and email address. The account service stores a salted password hash, verification/reset records and sign-in sessions; we do not store your password in readable form. Emails for account verification and password recovery are transactional, not marketing consent.",
    "Activation stores your account ID, a hashed device identifier, a public device key, the laptop name, activation status and timestamps. The raw hardware identifier is processed on your Mac to derive the hash and is not sent by the activation flow. These records enforce the free trial and two-laptop allowance. A device identifier is pseudonymous account data, not anonymous data.",
    "Payments use Paystack’s hosted checkout. We retain the order reference, account/email, amount, currency, provider transaction ID and verified payment/refund/dispute status. Card numbers and card security codes are not collected by the Stillbounds application or website checkout form. Paystack processes payment details under its own policies.",
    "Registration and activation do not upload your photographs, face-analysis results or book files. Those remain local unless you explicitly choose a separate sharing or support action. A desktop session token, device private key and signed activation are stored using macOS-protected encryption. No API secret or database credential is included in the app’s licence interface.",
    "Paid activations refresh periodically and can work offline for up to 90 days, with a seven-day outage grace period. Deactivating a laptop is enforced when it next checks access or its offline certificate expires. Sign-out clears the local session and activation; it does not delete your photographs or projects.",
    "Account, payment and activation records are accessible only to the operator and authorised service administrators and the providers required to run them: Vercel hosting, the PostgreSQL database provider, account email delivery and Paystack. Contact ijabikenm@gmail.com for access, correction, export or deletion requests. Payment/dispute records and the minimal trial-abuse-prevention record may need to be retained where necessary for a legitimate purpose or legal obligation; local project files remain under your control.",
  ]],
  [
    "Shared website and desktop accounts",
    [
      "Creating a Stillbounds account stores your name, email address, a password hash, email-verification status and account timestamps in this website’s database. Authentication also stores session tokens, expiry times, device-approval codes, and technical session information such as IP address and browser or app details. Verification and password-reset messages are sent through the website’s configured email provider. Account registration does not subscribe you to marketing emails or grant a paid subscription.",
      "The website uses an essential HttpOnly session cookie. The Mac app stores its session using macOS Keychain-backed encryption. Device-approval codes expire after ten minutes; account sessions expire after thirty days unless renewed or revoked. Sign out on a Mac to remove its local account, or use Sign out other devices on the website to revoke other sessions. Account sign-in does not upload or synchronise your photographs or editable books. Account records remain until deletion is requested and handled by the operator; contact ijabikenm@gmail.com for deletion or correction. Security records and backups follow the retention limitations described below.",
    ],
  ],
  [
    "Private Moyo Studio book reviews",
    [
      "Moyo Studio is a private connection for Moyo Ayaworan’s own Stillbounds desktop app. It is not an account or website connection for general beta users. Only devices approved through Moyo’s admin area can publish previews. Device access expires after 30 days and can be revoked sooner.",
      "When Moyo deliberately publishes a review, this website stores flattened JPEG previews, the book title, version and spread identifiers, expiry settings, and any watermark choice. It does not receive editable projects, source-photo files or print exports through this connector. If you review a book, we store the comments and approval or change request you submit for that fixed version, with timestamps. We use this information to provide the requested client-review service and protect it from unauthorised access; review activity is not added to the beta or marketing lists.",
      "Anyone given the private access link can view that version and submit feedback. Share links only with the intended review group. The link’s access code is carried in a browser fragment, exchanged for a review-specific HttpOnly cookie, and removed from the address bar. The cookie lasts up to eight hours; the review’s expiry or revocation can end access sooner. Studio and review pages do not run this website’s session-notification tracker.",
      "Published reviews expire after the period Moyo chooses, between 1 and 30 days. Expired previews, comments and review-access sessions are removed by the next daily cleanup or studio cleanup request. Unfinished uploads expire after 24 hours. Revoking a review removes its uploaded previews and access sessions immediately; its status and comments remain until its original expiry. Minimal book identifiers and version counters remain so later versions are numbered consistently. Hosting logs and provider backups follow their separate retention cycles. Contact ijabikenm@gmail.com about access, correction or deletion.",
      "Review records and previews use this website’s PostgreSQL database and Vercel hosting, with the provider and international-processing limitations described below. Review previews may contain identifiable people, so Moyo must have appropriate permission to share them. Watermarks and access controls cannot prevent screenshots or copying by an authorised viewer.",
    ],
  ],
  [
    "Scope and contact",
    [
      "This notice covers the Stillbounds website at /stillbounds, its legal pages, its beta-access list and the private Moyo Studio book-review service. Moyo Ayaworan, based in Nigeria, is responsible for this processing. Contact ijabikenm@gmail.com for privacy questions, withdrawal or requests concerning your data.",
      "The photography, art, bookings, galleries and shop sections of this wider website have separate practices described in the general website Privacy Policy. This notice is not a claim that every desktop or future online feature has been audited: release-specific privacy information will be supplied before beta installation or activation of an online service.",
    ],
  ],
  [
    "Information you provide",
    [
      "When you request beta access, we store your email, the request date, the version and timestamp of your terms agreement, the version of this privacy notice, and your optional product-update preference. When you opt in, we also record the marketing-consent date and version. Existing requests are not automatically treated as consent to the new optional marketing choice.",
      "If you email us, we receive your address, message and any attachments you choose to send. Please avoid unnecessary client information, private photographs, passwords or payment credentials. A hidden anti-spam field is checked when you submit; a submission identified as automated is not added to the waiting list.",
    ],
  ],
  [
    "Technical information and browser storage",
    [
      "Hosting infrastructure receives ordinary request information such as IP address, browser information, requested URL and time. Signup abuse prevention uses a hashed key derived from the IP address, the request category and a request count. This is pseudonymous security information, not a promise of anonymity.",
      "These product pages do not use the site’s automatic visit-email notification or its chatbot. The website may remember appearance and language preferences in browser storage. We do not add advertising cookies or behavioural analytics to these product pages. Following links to other website sections or external services brings their own notices and practices into scope.",
    ],
  ],
  [
    "Why we use the information",
    [
      "We use your email and agreement record to handle the access request you initiate, communicate invitations and important beta-administration information, and document the applicable terms. Our basis for the access request is taking steps at your request before an agreement; agreement evidence, support administration and abuse prevention also serve our legitimate interests in running a safe and accountable service, subject to your rights.",
      "General product news and promotional emails rely on your separate, optional consent. Leaving that box unchecked does not stop you requesting beta access. We may also retain or disclose information when needed to comply with a legal obligation. We do not make legally significant eligibility decisions about you using automated profiling.",
    ],
  ],
  [
    "Photographs, local work and AI",
    [
      "Submitting a beta-access request does not upload your photographs or project files. The animated website examples use locally hosted sample imagery; they do not read files from your device, run the desktop editor or save an album.",
      "The advertised desktop workflow edits projects locally and leaves source photographs unchanged. Any client-link, sync, support-upload or external AI feature needs specific information about what it sends and who receives it before you choose to use it. We do not use beta-signup data or website-demo interactions to train an AI model.",
    ],
  ],
  [
    "Who can receive information",
    [
      "The list is accessible to the product operator and authorised administrators. Service providers supporting this workflow include Vercel for website hosting, the PostgreSQL database service for signup storage, and Google/Gmail when you contact the published email address or we correspond with you. They process information needed to deliver their respective services; their own legal obligations and policies may also apply.",
      "We do not sell the beta-access list or share it with advertisers. We may disclose information when legally required or reasonably necessary to address abuse or protect legal rights. We will provide information about any new provider or materially different use before it is introduced where the law requires that.",
    ],
  ],
  [
    "Processing outside Nigeria",
    [
      "Hosting, database and email services may process information outside Nigeria. Where applicable, international transfers must use a lawful transfer basis and appropriate safeguards under the Nigeria Data Protection Act. Ask us for information about the providers, processing locations and safeguards relevant to your request.",
      "This notice does not promise that information is stored only in Nigeria. We will not describe an unverified server location as a residency guarantee.",
    ],
  ],
  [
    "How long we keep information",
    [
      "We keep the waiting-list record while your request is active and needed for the beta programme. We review its continued need when an invitation is handled, a request is withdrawn or the programme closes, and remove records no longer needed. Optional marketing preferences are kept while that subscription remains active; withdrawing consent stops marketing, with only any minimal suppression or evidence record needed to honour the withdrawal or a legal obligation retained.",
      "Support correspondence and technical records are kept only as long as needed to handle the issue, protect the service or meet a legal obligation. Retention depends on whether an issue is open, a dispute exists or a legal requirement applies. Deletion is handled by the operator; there is no automatic account-deletion or unsubscribe portal at present. Provider logs and backups follow their separate retention cycles.",
    ],
  ],
  [
    "Your choices and rights",
    [
      "You can withdraw marketing consent without withdrawing your beta request. You can also withdraw the request itself. Email ijabikenm@gmail.com with “Stillbounds privacy” and tell us which action you want. Withdrawal does not affect the lawfulness of processing before it was withdrawn.",
      "Subject to applicable law and its exceptions, you may request access, correction, erasure, restriction, portability or object to processing based on legitimate interests. We may ask for proportionate evidence to verify your identity and protect other people’s data. We will respond within applicable legal time limits and explain any lawful reason we cannot fulfil a request.",
    ],
  ],
  [
    "Security, children and complaints",
    [
      "We use safeguards including restricted admin access, encrypted connections where configured, input validation and request limits. No website or storage system can guarantee absolute security. If a breach requires notification, we will follow the applicable notification requirements.",
      "The beta programme is intended for adults. If you believe a child has submitted personal data, contact us so we can investigate and remove it where appropriate. You can raise a concern with us or complain to the Nigeria Data Protection Commission through its official website, ndpc.gov.ng. You do not need to exhaust our complaints process before using your statutory rights.",
    ],
  ],
  [
    "Updates to this notice",
    [
      "The date above identifies this notice. We will update it when the product’s data handling changes and communicate material changes to active participants where required. A new purpose requiring consent will use a new choice; posting a revised notice does not by itself create consent.",
    ],
  ],
];

privacySections.push([
  "Review books published through your account",
  [
    "When you deliberately publish a review from Stillbounds, compressed JPEG previews, the book title, version and spread identifiers are uploaded to your account's private review workspace. Original photo files, editable projects and local face-analysis records are not uploaded by this feature.",
    "People with your private review link and its access code can view that fixed version and submit comments or an approval decision. Share the link only with your intended client. Reviews are limited to 10 active books and 50 MiB of previews per account during the beta, subject to overall hosting capacity.",
    "You can inspect feedback, copy a client link and permanently delete a review in My review books. Deletion removes its previews and feedback and disables further client access. Expiry denies access immediately; expired data is removed during subsequent cleanup requests or the scheduled daily cleanup. Account deletion or other privacy requests can also be sent to the contact address above.",
    "Review devices paired through older app versions can publish to the account that approved their connection until the device connection expires or is disconnected in the profile. These review connections are separate from normal browser sign-in. Screenshots or copies made by a client cannot be revoked.",
  ],
]);
