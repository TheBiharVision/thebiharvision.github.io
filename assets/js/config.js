/* ============================================================
   THE BIHAR VISION — GLOBAL SITE CONFIGURATION
   Edit this file only. All components read from window.SITE_CONFIG.
   ============================================================ */
window.SITE_CONFIG = {
  siteName: "The Bihar Vision",
  siteShortName: "Bihar Vision",
  siteUrl: "https://thebiharvision.github.io",
  tagline: "The Bihar Vision is one of the fastest-growing entertainment podcast channels dedicated to Bhojpuri cinema, music, and culture. It features exclusive, deep-dive interviews and conversations with leading regional celebrities, creators, and public figures.",
  description: "The Bihar Vision is a Hindi/Bhojpuri YouTube podcast featuring interviews and conversations on culture, education, and entertainment, hosted by Alok Prasad and founded by Ritesh Sharma.",
  logo: "https://yt3.googleusercontent.com/AP6H5C_wCpt12OHrWK462FPNC7hil_35pnCHDnADD7OSGvSu-sKJUEl-eS_lNP2LIBMRlcso=s160-c-k-c0x00ffffff-no-rj",

  youtube: {
    channelName: "The Bihar Vision",
    channelUrl: "https://www.youtube.com/channel/UCq-dySuxc46S5BpDQuRGt_A",
    handle: "@TheBiharVision",
    handleUrl: "https://www.youtube.com/@TheBiharVision",
    channelId: "UCq-dySuxc46S5BpDQuRGt_A",
    subscribeUrl: "https://www.youtube.com/channel/UCq-dySuxc46S5BpDQuRGt_A?sub_confirmation=1"
  },

  founder: { name: "Ritesh Sharma", role: "Founder" },
  host: { name: "Alok Prasad", role: "Host" },

  email: "thebiharvision@gmail.com",

  location: {
    city: "New Delhi",
    region: "Delhi",
    country: "India",
    note: "The Bihar Vision operates as an online media channel based in New Delhi, India. No public office or studio address is currently published."
  },

  languages: { primary: "Hindi / Bhojpuri", secondary: ["English"] },
  niche: ["Interview", "Culture", "Education", "Entertainment"],

  social: {
    instagram: "https://www.instagram.com/thebiharvision",
    facebook: "https://www.facebook.com/thebiharvision"
  },

  repo: "https://github.com/TheBiharVision/thebiharvision.github.io",

  designCredit: {
    name: "Sharmaji Technology Media",
    url: "https://gitesh-sharma.github.io/en/org/index.html" 
  },

  // Set to true + provide a form endpoint (e.g. Formspree/Getform ID) to enable live submission.
  // NEVER put secret keys here — only public form endpoint IDs are safe client-side.
  contactForm: {
    provider: "mailto", // "formspree" | "mailto"
    endpoint: "" // e.g. "https://formspree.io/f/XXXXXXX" — PLACEHOLDER, not yet configured
  },

  analytics: {
    enabled: false, // Set true only after a real analytics provider + cookie consent is configured
    provider: "none"
  },

  nav: [
    { label: "Home", href: "/" },
    { label: "Episodes", href: "/episodes/" },
    { label: "About", href: "/about.html" },
    { label: "Team", href: "/team/ritesh-sharma.html" },
    { label: "Guests", href: "/guests/" },
    { label: "FAQ", href: "/faq.html" },
    { label: "Contact", href: "/contact.html" }
  ],

  footerLinks: {
    explore: [
      { label: "Home", href: "/" },
      { label: "Episodes", href: "/episodes/" },
      { label: "Guests", href: "/guests/" },
      { label: "Contact Us", href: "/contact.html" }
    ],
    about: [
      { label: "About Bihar Vision", href: "/about.html" },
      { label: "About Team", href: "/team/" },
      { label: "Ritesh Sharma", href: "/team/ritesh-sharma.html" },
      { label: "Alok Prasad", href: "/team/alok-prasad.html" }
    ],
    legal: [
      { label: "Privacy Policy", href: "/legal/privacy-policy.html" },
      { label: "Terms & Conditions", href: "/legal/terms-and-conditions.html" },
      { label: "Disclaimer", href: "/legal/disclaimer.html" },
      { label: "Cookie Policy", href: "/legal/cookie-policy.html" },
      { label: "Copyright / DMCA", href: "/legal/copyright-policy.html" },
      { label: "Editorial Policy", href: "/legal/editorial-policy.html" },
      { label: "Accessibility", href: "/legal/accessibility.html" }
    ],
    sitemap: { html: "/sitemap.html", xml: "/sitemap.xml" }
  };
