/**
 * Legal content - Terms of Service & Privacy Policy for Spanlyfy.
 *
 * Kept as typed, structured data (mirroring help-content.ts) so it renders through a small
 * block renderer with no markdown pipeline, stays trivially diffable, and exposes a single
 * `effectiveDate` per document. The text is modeled on a mature social-scheduler's legal docs
 * but written originally for Spanlyfy: only the six supported platforms (Facebook, Instagram,
 * LinkedIn, TikTok, YouTube, X), our real billing (Polar), our real 7-day free trial and
 * 7-day refund window, and how we actually handle OAuth tokens and content.
 *
 * NOT legal advice. Before going to production, have counsel review and fill the bracketed
 * placeholders (legal entity name + governing-law jurisdiction) in the Terms.
 */

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] };

export interface LegalSection {
  /** Numbered heading, e.g. "1. Acceptance of these Terms". */
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: "terms" | "privacy" | "data-deletion";
  title: string;
  /** Human-readable effective date, shown under the title. */
  effectiveDate: string;
  intro: LegalBlock[];
  sections: LegalSection[];
}

/** Shared facts so the two documents stay consistent and are edited in one place. */
export const LEGAL = {
  product: "Spanlyfy",
  domain: "spanly.app",
  supportEmail: "support@spanly.app",
  privacyEmail: "privacy@spanly.app",
  effectiveDate: "June 17, 2026",
  trialDays: 7,
  refundDays: 7,
  platforms: "Facebook, Instagram, LinkedIn, TikTok, YouTube, and X (formerly Twitter)",
  // Fill these before production launch.
  legalEntity: "Spanlyfy", // e.g. "Spanlyfy, Inc."
  jurisdiction: "[your governing jurisdiction - e.g., State of Delaware, USA]",
} as const;

// ───────────────────────────────── Terms of Service ─────────────────────────────────

export const TERMS: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  effectiveDate: LEGAL.effectiveDate,
  intro: [
    {
      type: "p",
      text: `These Terms of Service ("Terms") are a binding agreement between you ("you" or "your") and ${LEGAL.legalEntity} ("Spanlyfy", "we", "us", or "our"), governing your access to and use of the Spanlyfy website at ${LEGAL.domain}, our applications, and all related services (together, the "Service").`,
    },
    {
      type: "p",
      text: `By creating an account, clicking "I agree", or otherwise accessing or using the Service, you confirm that you have read, understood, and agree to be bound by these Terms and by our Privacy Policy, which is incorporated here by reference. If you do not agree, do not use the Service.`,
    },
  ],
  sections: [
    {
      heading: "1. Acceptance of these Terms",
      blocks: [
        {
          type: "p",
          text: "By accessing or using the Service you accept these Terms on your own behalf and, if you use the Service for an organization, on that organization's behalf. You represent that you have the authority to bind that organization. If you are entering into these Terms on behalf of a company or other legal entity, references to \"you\" include that entity.",
        },
      ],
    },
    {
      heading: "2. Eligibility",
      blocks: [
        {
          type: "p",
          text: "You must be at least 16 years old (or the age of digital consent in your country, if higher) and capable of forming a binding contract to use the Service. The Service is not directed to children, and we do not knowingly allow anyone under this age to create an account.",
        },
        {
          type: "p",
          text: "You are responsible for ensuring that your use of the Service is lawful in your jurisdiction and that you have the rights and permissions necessary for the social media accounts and content you manage through Spanlyfy.",
        },
      ],
    },
    {
      heading: "3. Description of the Service",
      blocks: [
        {
          type: "p",
          text: `Spanlyfy is a social media scheduling and publishing tool. It lets you connect your accounts on ${LEGAL.platforms}, compose a post once, and publish it immediately or schedule it across the platforms you choose. The Service also provides a content calendar, a publishing queue, drafts, media handling, analytics where available, and developer features such as API keys and an MCP server.`,
        },
        {
          type: "p",
          text: "Spanlyfy acts as a tool that you direct. When you publish or schedule content, you instruct us to transmit that content to the third-party platforms you have connected, on your behalf. We do not control those platforms and cannot guarantee that a given post will be accepted, displayed, or retained by them.",
        },
      ],
    },
    {
      heading: "4. Your Account",
      blocks: [
        {
          type: "p",
          text: "To use most features you must create an account with a valid email address and a password. You agree to provide accurate information and to keep it up to date.",
        },
        {
          type: "p",
          text: "You are responsible for safeguarding your account credentials and for all activity that occurs under your account. You must notify us promptly at " + LEGAL.supportEmail + " if you suspect unauthorized access. We are not liable for any loss arising from unauthorized use of your account that results from your failure to keep your credentials secure.",
        },
      ],
    },
    {
      heading: "5. Free Trial",
      blocks: [
        {
          type: "p",
          text: `We may offer a ${LEGAL.trialDays}-day free trial that does not require a payment method up front. During the trial you can use the features of the applicable plan. We may change or withdraw trial offers at any time, and trials are limited to one per customer unless we state otherwise.`,
        },
        {
          type: "p",
          text: "At the end of the trial, your access to paid features ends unless you subscribe to a paid plan. We will not charge you automatically when such a trial ends.",
        },
      ],
    },
    {
      heading: "6. Subscriptions, Plans & Billing",
      blocks: [
        {
          type: "p",
          text: "Paid features are offered on a subscription basis. Plans, prices, included limits (such as the number of connected accounts or scheduled posts), and any add-ons are described at the point of purchase and may be updated from time to time.",
        },
        {
          type: "p",
          text: "Payments are processed by our merchant of record, Polar. By subscribing you authorize us, through Polar, to charge your chosen payment method the recurring fee for your plan (monthly or annually, as selected), plus applicable taxes, until you cancel.",
        },
        {
          type: "ul",
          items: [
            "Auto-renewal: subscriptions renew automatically at the end of each billing period at the then-current price unless you cancel before the renewal date.",
            "Taxes: prices are exclusive of taxes unless stated; you are responsible for any applicable sales, use, VAT, or similar taxes.",
            "Price changes: we may change prices, and will give you reasonable advance notice; changes apply to the next billing period.",
            "Failed payments: if a charge fails, we may retry and may suspend or downgrade paid features until payment succeeds.",
            "Plan limits: exceeding the limits of your plan may require an upgrade to continue using the affected features.",
          ],
        },
        {
          type: "p",
          text: "We do not store your full payment details; they are handled directly by Polar under its own terms and security standards.",
        },
      ],
    },
    {
      heading: "7. Refund Policy",
      blocks: [
        {
          type: "p",
          text: `We want you to be satisfied with Spanlyfy. We offer a ${LEGAL.refundDays}-day, 100% money-back guarantee: if you request a refund within ${LEGAL.refundDays} days of a paid subscription charge, we will refund that charge in full, no questions asked.`,
        },
        {
          type: "p",
          text: `To request a refund, use the refund option in your dashboard or email us at ${LEGAL.supportEmail} from the address on your account. When a refund is issued, the related plan and any add-ons are cancelled immediately and access to paid features ends. Refunds are returned to your original payment method and typically appear within 5–12 business days, depending on your bank or card issuer.`,
        },
        {
          type: "p",
          text: `Charges older than ${LEGAL.refundDays} days are generally non-refundable except where required by applicable law. We may decline refunds in cases of evident fraud or abuse of this policy.`,
        },
      ],
    },
    {
      heading: "8. Cancellation & Downgrades",
      blocks: [
        {
          type: "p",
          text: "You can cancel your subscription at any time from your account settings or billing portal. Cancellation stops future renewals; unless you request a refund under Section 7, you retain access to paid features until the end of the current billing period, after which your account moves to a free or limited state.",
        },
        {
          type: "p",
          text: "If you downgrade, features and limits that exceed your new plan may become unavailable, and scheduled content above your new limits may not be published.",
        },
      ],
    },
    {
      heading: "9. Connected Social Accounts & Third-Party Platforms",
      blocks: [
        {
          type: "p",
          text: "To publish on your behalf, you connect your third-party social media accounts to Spanlyfy using each platform's official authorization (OAuth) flow. By connecting an account you authorize Spanlyfy to access and use that account, within the scopes you approve, to provide the Service - for example to read your basic profile, list the pages or channels you manage, and create posts.",
        },
        {
          type: "p",
          text: "Your use of each connected platform remains subject to that platform's own terms and policies, in addition to these Terms. You are responsible for complying with them. The platforms relevant to Spanlyfy include:",
        },
        {
          type: "ul",
          items: [
            "Meta (Facebook and Instagram) - Meta Terms of Service and Platform Terms.",
            "X (formerly Twitter) - the X Terms of Service and Developer Agreement.",
            "LinkedIn - the LinkedIn User Agreement and API Terms.",
            "TikTok - the TikTok Terms of Service and Developer Terms.",
            "YouTube and Google - the YouTube Terms of Service and Google Privacy Policy (see Section 10).",
          ],
        },
        {
          type: "p",
          text: "Third-party platforms may change, restrict, or remove their APIs and features at any time, which can interrupt or disable parts of the Service. We are not responsible for such changes and may modify or remove affected functionality. You can disconnect any account from Spanlyfy at any time, and you may also revoke Spanlyfy's access from within the relevant platform's settings.",
        },
      ],
    },
    {
      heading: "10. YouTube API Services",
      blocks: [
        {
          type: "p",
          text: "If you connect a YouTube or Google account, the Service uses YouTube API Services. By using those features, you also agree to be bound by the YouTube Terms of Service (https://www.youtube.com/t/terms), and you acknowledge that Google's Privacy Policy (https://policies.google.com/privacy) applies to Google's handling of your information.",
        },
        {
          type: "p",
          text: "You can revoke Spanlyfy's access to your Google/YouTube data at any time via the Google security settings page (https://security.google.com/settings/security/permissions). We use data obtained through the YouTube API Services only to provide the Service to you and in accordance with the YouTube API Services policies.",
        },
      ],
    },
    {
      heading: "11. Your Content",
      blocks: [
        {
          type: "p",
          text: "\"Your Content\" means the text, images, video, captions, schedules, and other materials you upload to or create within Spanlyfy. As between you and us, you retain all ownership rights in Your Content.",
        },
        {
          type: "p",
          text: "You grant Spanlyfy a worldwide, non-exclusive, royalty-free license to host, store, reproduce, process, transmit, adapt (for formatting and platform requirements), and display Your Content solely as needed to operate and provide the Service - including transmitting it to the third-party platforms you instruct us to publish to. This license ends when Your Content is deleted, except for residual copies in routine backups and as required to comply with law.",
        },
        {
          type: "p",
          text: "You represent and warrant that you own or have all necessary rights, licenses, and permissions for Your Content, and that publishing it through Spanlyfy does not violate any law or any third party's rights. You are solely responsible for Your Content and for what you publish.",
        },
      ],
    },
    {
      heading: "12. Acceptable Use",
      blocks: [
        { type: "p", text: "You agree not to use the Service to, and not to allow anyone else to:" },
        {
          type: "ul",
          items: [
            "Violate any law or regulation, or any third-party platform's terms or policies.",
            "Post or distribute content that is illegal, infringing, defamatory, harassing, hateful, or that you do not have the rights to share.",
            "Send spam, bulk unsolicited messages, or engage in inauthentic or deceptive behavior across platforms.",
            "Upload malware or any code intended to disrupt, damage, or gain unauthorized access to systems or data.",
            "Reverse engineer, decompile, scrape, or attempt to extract source code from the Service, except to the extent permitted by law.",
            "Circumvent plan limits, rate limits, usage caps, or any security or access controls.",
            "Resell, sublicense, or commercially exploit the Service without our prior written consent.",
            "Interfere with or place an unreasonable load on the Service or its infrastructure.",
          ],
        },
        {
          type: "p",
          text: "We may investigate suspected violations and may remove content or suspend access where we reasonably believe a violation has occurred.",
        },
      ],
    },
    {
      heading: "13. API Keys, MCP & Developer Access",
      blocks: [
        {
          type: "p",
          text: "If you generate API keys or use our MCP server or other developer features, you are responsible for keeping your keys secret and for all activity carried out with them. Treat API keys like passwords; do not embed them in public code or share them.",
        },
        {
          type: "p",
          text: "Developer access is subject to rate limits and to these Terms. We may revoke keys or limit access if we detect abuse, security risks, or excessive usage.",
        },
      ],
    },
    {
      heading: "14. Intellectual Property",
      blocks: [
        {
          type: "p",
          text: "The Service, including its software, design, text, graphics, and the Spanlyfy name and logo, is owned by us or our licensors and is protected by intellectual property laws. Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for its intended purpose.",
        },
        {
          type: "p",
          text: "We welcome feedback. If you send us suggestions, you grant us a perpetual, royalty-free license to use them without obligation to you.",
        },
      ],
    },
    {
      heading: "15. Third-Party Services",
      blocks: [
        {
          type: "p",
          text: "The Service relies on third-party services, including Polar for payments, our email provider, hosting and storage providers, and the social media platforms you connect. Your use of those services may be subject to their own terms. We are not responsible for the acts, omissions, availability, or content of third-party services.",
        },
      ],
    },
    {
      heading: "16. Service Availability & Changes",
      blocks: [
        {
          type: "p",
          text: "We work to keep the Service available and reliable, but we do not guarantee that it will be uninterrupted, timely, secure, or error-free. We may modify, add, or discontinue features, and we may offer beta or experimental features that are provided \"as is\" and may change or be removed at any time.",
        },
        {
          type: "p",
          text: "Scheduled publishing depends on third-party platforms; we cannot guarantee that every scheduled post will be delivered or accepted by the destination platform.",
        },
      ],
    },
    {
      heading: "17. Suspension & Termination",
      blocks: [
        {
          type: "p",
          text: "You may stop using the Service and delete your account at any time. We may suspend or terminate your access, with or without notice, if you breach these Terms, if required by law, to protect the Service or other users, or if your account is used in a way that creates risk or legal exposure.",
        },
        {
          type: "p",
          text: "On termination, your right to use the Service ends. We may delete Your Content and account data after a reasonable period, except where retention is required by law. Sections that by their nature should survive termination (including IP, disclaimers, limitation of liability, and indemnification) will survive.",
        },
      ],
    },
    {
      heading: "18. Disclaimers",
      blocks: [
        {
          type: "p",
          text: "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.",
        },
        {
          type: "p",
          text: "We do not warrant that the Service will meet your requirements, that publishing will always succeed, or that the Service will be uninterrupted or error-free. You use the Service at your own risk and are responsible for the content you publish.",
        },
      ],
    },
    {
      heading: "19. Limitation of Liability",
      blocks: [
        {
          type: "p",
          text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, SPANLY AND ITS OFFICERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS, ARISING OUT OF OR RELATED TO YOUR USE OF (OR INABILITY TO USE) THE SERVICE.",
        },
        {
          type: "p",
          text: "OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR (B) USD 100. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO SOME OF THE ABOVE MAY NOT APPLY TO YOU.",
        },
      ],
    },
    {
      heading: "20. Indemnification",
      blocks: [
        {
          type: "p",
          text: "You agree to indemnify and hold harmless Spanlyfy and its affiliates from and against any claims, damages, liabilities, and expenses (including reasonable legal fees) arising out of or related to Your Content, your use of the Service, your violation of these Terms, or your violation of any law or third-party right, including any third-party platform's terms.",
        },
      ],
    },
    {
      heading: "21. Changes to these Terms",
      blocks: [
        {
          type: "p",
          text: "We may update these Terms from time to time. If we make material changes, we will provide reasonable notice, such as by email or an in-app notice, and update the effective date above. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.",
        },
      ],
    },
    {
      heading: "22. Governing Law & Disputes",
      blocks: [
        {
          type: "p",
          text: `These Terms are governed by the laws of ${LEGAL.jurisdiction}, without regard to its conflict-of-laws rules. You agree that the courts located in that jurisdiction will have exclusive jurisdiction over any dispute, except where applicable law gives you the right to bring proceedings in your local courts.`,
        },
      ],
    },
    {
      heading: "23. Miscellaneous",
      blocks: [
        {
          type: "ul",
          items: [
            "Entire agreement: these Terms and the Privacy Policy are the entire agreement between you and us regarding the Service.",
            "Severability: if any provision is held unenforceable, the remaining provisions stay in effect.",
            "Waiver: our failure to enforce a provision is not a waiver of it.",
            "Assignment: you may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition, or sale of assets.",
            "Force majeure: we are not liable for delays or failures caused by events beyond our reasonable control.",
          ],
        },
      ],
    },
    {
      heading: "24. Contact Us",
      blocks: [
        {
          type: "p",
          text: `Questions about these Terms? Contact us at ${LEGAL.supportEmail}.`,
        },
      ],
    },
  ],
};

// ───────────────────────────────── Privacy Policy ─────────────────────────────────

export const PRIVACY: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  effectiveDate: LEGAL.effectiveDate,
  intro: [
    {
      type: "p",
      text: `This Privacy Policy explains how ${LEGAL.legalEntity} ("Spanlyfy", "we", "us", or "our") collects, uses, shares, and protects your personal information when you use ${LEGAL.product} at ${LEGAL.domain} and our related services (the "Service").`,
    },
    {
      type: "p",
      text: "By using the Service, you agree to the practices described in this Policy. If you do not agree, please do not use the Service.",
    },
  ],
  sections: [
    {
      heading: "1. Information We Collect",
      blocks: [
        { type: "p", text: "We collect the following categories of information:" },
        { type: "h", text: "Account information" },
        {
          type: "p",
          text: "Your name, email address, and a securely hashed password. We never store your password in plain text.",
        },
        { type: "h", text: "Billing information" },
        {
          type: "p",
          text: "When you subscribe, payments are processed by Polar. We do not receive or store your full card number. We store billing-related metadata such as your plan, subscription status, billing period, and limited identifiers (for example, a Polar subscription or customer ID) needed to manage your subscription.",
        },
        { type: "h", text: "Connected social accounts and access tokens" },
        {
          type: "p",
          text: `When you connect an account on ${LEGAL.platforms}, we receive and store the access tokens issued by that platform (stored encrypted), along with account details such as the account or page/channel ID, handle or name, and avatar. Tokens let us publish on your behalf within the scopes you approve.`,
        },
        { type: "h", text: "Content you create" },
        {
          type: "p",
          text: "The posts, captions, uploaded media, drafts, schedules, and related metadata you create or store in Spanlyfy so we can save, format, and publish them.",
        },
        { type: "h", text: "Usage and device data" },
        {
          type: "p",
          text: "Technical information such as your IP address, browser and device type, log data, timestamps, and actions taken in the Service, collected to operate, secure, and improve the Service.",
        },
        { type: "h", text: "Support communications" },
        {
          type: "p",
          text: "The contents of messages you send us and our responses, so we can provide support and keep records.",
        },
      ],
    },
    {
      heading: "2. How We Use Your Information",
      blocks: [
        { type: "p", text: "We use your information to:" },
        {
          type: "ul",
          items: [
            "Provide, operate, and maintain the Service, including saving, scheduling, and publishing your content to the platforms you connect.",
            "Authenticate you and keep your account secure.",
            "Process subscriptions, payments, and refunds, and send related confirmations and account notices.",
            "Provide customer support and respond to your requests.",
            "Monitor, troubleshoot, and improve the Service, including for reliability and performance.",
            "Detect, prevent, and address fraud, abuse, security incidents, and violations of our Terms.",
            "Comply with legal obligations and enforce our agreements.",
          ],
        },
      ],
    },
    {
      heading: "3. Legal Bases for Processing (EEA/UK)",
      blocks: [
        {
          type: "p",
          text: "If you are in the European Economic Area or the United Kingdom, we process your personal data on the following legal bases: performance of our contract with you (to provide the Service); your consent (for example, when you connect a social account); our legitimate interests (such as securing and improving the Service); and compliance with legal obligations.",
        },
      ],
    },
    {
      heading: "4. How We Share Information",
      blocks: [
        { type: "p", text: "We share personal information only as described here:" },
        {
          type: "ul",
          items: [
            "Social media platforms: when you publish or schedule content, we transmit that content and the necessary data to the platforms you have connected and instructed us to post to.",
            "Service providers (subprocessors): trusted vendors who process data on our behalf to run the Service - including Polar (payments), our email provider, our hosting and storage providers, and error-monitoring tools - under contracts that limit their use of your data.",
            "Legal and safety: when required by law or legal process, or to protect the rights, property, or safety of Spanlyfy, our users, or the public.",
            "Business transfers: in connection with a merger, acquisition, financing, or sale of assets, where your information may be transferred subject to this Policy.",
          ],
        },
        {
          type: "p",
          text: "We do not sell your personal information, and we do not share it for cross-context behavioral advertising.",
        },
      ],
    },
    {
      heading: "5. Social Media Platform Data & Tokens",
      blocks: [
        {
          type: "p",
          text: "When you connect a social account, you authorize the specific permissions (scopes) shown during the platform's authorization flow. We access only what is needed to provide the Service - typically your basic profile, the pages or channels you manage, and the ability to create posts.",
        },
        {
          type: "p",
          text: "Access tokens are stored encrypted and used only to act on your behalf. You can disconnect any account in Spanlyfy at any time, which stops our access going forward, and you can also revoke access from within each platform's own settings.",
        },
      ],
    },
    {
      heading: "6. YouTube API Services & Google Data",
      blocks: [
        {
          type: "p",
          text: "If you connect a YouTube/Google account, the Service uses YouTube API Services. We comply with the YouTube API Services Terms and Google's Limited Use requirements. The YouTube Terms of Service (https://www.youtube.com/t/terms) and Google Privacy Policy (https://policies.google.com/privacy) apply to Google's handling of your data.",
        },
        {
          type: "p",
          text: "We use data from the YouTube API Services only to provide the Service to you, do not use it for advertising, and do not transfer it except as needed to provide the Service, to comply with law, or as part of a merger or acquisition. You can revoke Spanlyfy's access at any time via the Google security settings page (https://security.google.com/settings/security/permissions).",
        },
      ],
    },
    {
      heading: "7. Cookies & Tracking",
      blocks: [
        {
          type: "p",
          text: "We use a small number of strictly necessary cookies - primarily a session cookie to keep you logged in, a cookie to remember your privacy choices, and a preference setting to remember options such as your theme. These are necessary for the Service to function and are always active.",
        },
        {
          type: "p",
          text: "Any non-essential cookies, such as analytics to understand and improve how the Service is used, are off by default and load only after you opt in. When you first visit, a consent banner lets you accept all, reject non-essential cookies, or choose per category, and you can change your choices at any time using the \"Manage cookies\" control in our footer.",
        },
        {
          type: "p",
          text: `We do not use third-party advertising cookies to track you across the web, and we do not sell your personal information. For the full list of cookies we set, their purpose, and their lifetimes, see our Cookie Policy at ${LEGAL.domain}/cookies.`,
        },
      ],
    },
    {
      heading: "8. Data Retention",
      blocks: [
        {
          type: "p",
          text: "We retain your information for as long as your account is active or as needed to provide the Service. Connected-account tokens are retained until you disconnect the account or close your account. When you delete your account, we delete or anonymize your personal data within a reasonable period, except where we must retain certain information to comply with legal, tax, or accounting obligations or to resolve disputes. Residual copies may persist briefly in routine backups.",
        },
      ],
    },
    {
      heading: "9. Data Security",
      blocks: [
        {
          type: "p",
          text: "We use technical and organizational measures to protect your information, including encryption in transit (HTTPS), encryption of stored social-account tokens, hashing of passwords, and access controls limiting who can access data. No method of transmission or storage is completely secure, so we cannot guarantee absolute security, but we work to protect your data and to respond promptly to incidents.",
        },
      ],
    },
    {
      heading: "10. Your Rights & Choices",
      blocks: [
        {
          type: "p",
          text: "Depending on where you live, you may have rights over your personal information, including the right to access, correct, delete, or receive a copy (portability) of it; to restrict or object to certain processing; and to withdraw consent. If you are in California, you have the right to know what we collect, to request deletion, and to not be discriminated against for exercising your rights; we do not sell your personal information.",
        },
        {
          type: "p",
          text: `You can update much of your information directly in your account settings, or disconnect social accounts at any time. To exercise other rights, contact us at ${LEGAL.privacyEmail}. We will respond within the timeframe required by applicable law and may need to verify your identity first.`,
        },
      ],
    },
    {
      heading: "11. International Data Transfers",
      blocks: [
        {
          type: "p",
          text: "We and our service providers may process and store your information in countries other than your own, including the United States. Where required, we use appropriate safeguards (such as standard contractual clauses) to protect your information when it is transferred internationally.",
        },
      ],
    },
    {
      heading: "12. Children's Privacy",
      blocks: [
        {
          type: "p",
          text: "The Service is not intended for children under 16, and we do not knowingly collect personal information from them. If you believe a child has provided us personal information, contact us and we will delete it.",
        },
      ],
    },
    {
      heading: "13. Third-Party Links",
      blocks: [
        {
          type: "p",
          text: "The Service may contain links to third-party websites and platforms that we do not control. This Policy does not apply to those sites, and we encourage you to review their privacy policies.",
        },
      ],
    },
    {
      heading: "14. Changes to this Policy",
      blocks: [
        {
          type: "p",
          text: "We may update this Privacy Policy from time to time. If we make material changes, we will provide notice (such as by email or an in-app notice) and update the effective date above. Your continued use of the Service after changes take effect constitutes acceptance of the updated Policy.",
        },
      ],
    },
    {
      heading: "15. Contact Us",
      blocks: [
        {
          type: "p",
          text: `If you have questions or requests regarding this Policy or your personal information, contact us at ${LEGAL.privacyEmail} (or ${LEGAL.supportEmail}).`,
        },
      ],
    },
  ],
};

export const DATA_DELETION: LegalDocument = {
  slug: "data-deletion",
  title: "Data Deletion Policy",
  effectiveDate: "June 25, 2026",
  intro: [
    {
      type: "p",
      text: "Welcome to Spanlyfy. This Data Deletion Policy explains how users can request deletion of their personal data and how Spanlyfy processes such requests.",
    },
    {
      type: "p",
      text: "This policy applies to all users of Spanlyfy and covers data collected through our website, applications, APIs, and third-party integrations.",
    },
  ],
  sections: [
    {
      heading: "1. About Spanlyfy",
      blocks: [
        {
          type: "p",
          text: "Spanlyfy is a social media management and scheduling platform that allows users to connect and manage multiple social media accounts from a single dashboard.",
        },
        {
          type: "p",
          text: "This policy applies to all users of Spanlyfy and covers data collected through our website, applications, APIs, and third-party integrations.",
        },
      ],
    },
    {
      heading: "2. Your Right to Delete Data",
      blocks: [
        {
          type: "p",
          text: "You have the right to request deletion of your personal data stored by Spanlyfy.",
        },
        {
          type: "p",
          text: "You may request deletion at any time by:",
        },
        {
          type: "ul",
          items: [
            "Using the account deletion feature within your Spanlyfy account settings.",
            "Disconnecting connected social media accounts.",
            "Contacting our privacy team via email.",
            "Submitting a deletion request through our website.",
          ],
        },
      ],
    },
    {
      heading: "3. Data We Delete",
      blocks: [
        {
          type: "p",
          text: "Upon receiving and verifying a valid deletion request, Spanlyfy will delete or anonymize the following information associated with your account:",
        },
        {
          type: "h",
          text: "Account Information",
        },
        {
          type: "ul",
          items: [
            "Full name",
            "Email address",
            "Profile information",
            "Account preferences",
            "User-generated settings",
          ],
        },
        {
          type: "h",
          text: "Connected Social Media Data",
        },
        {
          type: "ul",
          items: [
            "Facebook access tokens",
            "Instagram access tokens",
            "LinkedIn access tokens",
            "X (Twitter) access tokens",
            "TikTok access tokens",
            "YouTube access tokens",
            "Other connected platform credentials",
          ],
        },
        {
          type: "h",
          text: "Content Data",
        },
        {
          type: "ul",
          items: [
            "Scheduled posts",
            "Draft posts",
            "Published post history stored by Spanlyfy",
            "Uploaded images",
            "Uploaded videos",
            "Content templates",
            "AI-generated content history",
          ],
        },
        {
          type: "h",
          text: "Team and Workspace Data",
        },
        {
          type: "ul",
          items: [
            "Team member invitations",
            "Workspace information",
            "Collaboration records",
          ],
        },
        {
          type: "h",
          text: "Analytics Data",
        },
        {
          type: "ul",
          items: [
            "Social media analytics collected by Spanlyfy",
            "Engagement reports",
            "Performance metrics associated with your account",
          ],
        },
      ],
    },
    {
      heading: "4. Data We May Retain",
      blocks: [
        {
          type: "p",
          text: "Certain information may be retained where required by law or for legitimate business purposes, including:",
        },
        {
          type: "ul",
          items: [
            "Billing records",
            "Invoices",
            "Payment transaction history",
            "Tax-related documentation",
            "Fraud prevention records",
            "Security logs",
            "Legal compliance records",
            "Dispute and chargeback records",
          ],
        },
        {
          type: "p",
          text: "Such information will only be retained for the period required by applicable laws and regulations.",
        },
      ],
    },
    {
      heading: "5. Social Media Platform Data",
      blocks: [
        {
          type: "p",
          text: "Spanlyfy integrates with third-party platforms including: Meta Platforms (Facebook and Instagram), LinkedIn, X Corp., Google, TikTok.",
        },
        {
          type: "p",
          text: "When you disconnect an account or delete your Spanlyfy account:",
        },
        {
          type: "ul",
          items: [
            "Access tokens stored by Spanlyfy are removed.",
            "Future access to your connected accounts is revoked.",
            "Data retained directly by the social media platforms remains subject to their own privacy policies and deletion procedures.",
          ],
        },
        {
          type: "p",
          text: "Users may need to separately manage or delete data stored by those platforms.",
        },
      ],
    },
    {
      heading: "6. Account Deletion Process",
      blocks: [
        {
          type: "p",
          text: "Users can delete their account by:",
        },
        {
          type: "ul",
          items: [
            "Logging into Spanlyfy.",
            "Navigating to Settings → Account Settings.",
            "Selecting Delete Account.",
            "Confirming the deletion request.",
          ],
        },
        {
          type: "p",
          text: "Once confirmed:",
        },
        {
          type: "ul",
          items: [
            "Connected social accounts are disconnected.",
            "Scheduled content is removed.",
            "Uploaded media is deleted.",
            "User data enters the deletion process.",
          ],
        },
      ],
    },
    {
      heading: "7. Deletion Timeline",
      blocks: [
        {
          type: "ul",
          items: [
            "Access tokens are removed immediately.",
            "User account access is disabled immediately.",
            "Most personal data is deleted within 30 days.",
            "Backup copies may remain for up to 30 additional days before automatic removal.",
          ],
        },
      ],
    },
    {
      heading: "8. Backup and Recovery Systems",
      blocks: [
        {
          type: "p",
          text: "For security and disaster recovery purposes:",
        },
        {
          type: "ul",
          items: [
            "Encrypted backups may temporarily contain deleted information.",
            "Backup data is automatically purged according to our retention schedule.",
            "Backup data is not used for operational purposes after deletion requests are processed.",
          ],
        },
      ],
    },
    {
      heading: "9. Verification of Requests",
      blocks: [
        {
          type: "p",
          text: "To protect user privacy and prevent unauthorized deletions, Spanlyfy may verify the identity of the individual submitting a deletion request before processing it.",
        },
      ],
    },
    {
      heading: "10. Third-Party Service Providers",
      blocks: [
        {
          type: "p",
          text: "Spanlyfy may use third-party providers for cloud hosting, payment processing, email delivery, analytics, error monitoring, and security services.",
        },
        {
          type: "p",
          text: "Where applicable, deletion requests will be propagated to our service providers in accordance with contractual and legal obligations.",
        },
      ],
    },
    {
      heading: "11. GDPR and International Privacy Rights",
      blocks: [
        {
          type: "p",
          text: "Users located in jurisdictions with applicable privacy laws may have rights including the right to access, correction, deletion, portability, objection, and withdrawal of consent.",
        },
      ],
    },
    {
      heading: "12. How to Submit a Data Deletion Request",
      blocks: [
        {
          type: "p",
          text: "If you cannot access your account, submit a request by emailing:",
        },
        {
          type: "p",
          text: "Email: privacy@spanlyfy.com",
        },
        {
          type: "p",
          text: "Subject: Data Deletion Request",
        },
        {
          type: "p",
          text: "Please include: your registered email address, full name, and reason for the request (optional).",
        },
      ],
    },
    {
      heading: "13. Contact Information",
      blocks: [
        {
          type: "p",
          text: "If you have questions regarding this Data Deletion Policy, contact: Spanlyfy Privacy Team, Email: privacy@spanlyfy.com, Website: https://spanlyfy.com",
        },
      ],
    },
    {
      heading: "14. Changes to This Policy",
      blocks: [
        {
          type: "p",
          text: "Spanlyfy may update this Data Deletion Policy periodically. Updated versions will be posted on this page with a revised last updated date.",
        },
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<"terms" | "privacy" | "data-deletion", LegalDocument> = {
  terms: TERMS,
  privacy: PRIVACY,
  "data-deletion": DATA_DELETION,
};
