export type SiteSettings = {
  entry: {
    title: string;
    tagline: string;
    desktopImage: string;
    mobileImage: string;
    philosophyLabel: string;
    philosophyText: string;
    locationLabel: string;
    locationText: string;
  };
  photography: {
    heroSubtext: string;
    heroCta: string;
    showPortfolio: boolean;
    showAbout: boolean;
    showDigitalProducts: boolean;
    showBooking: boolean;
    showReviews: boolean;
    showNewsletter: boolean;
  };
  art: {
    heroImage: string;
    aboutImage: string;
    previewImageOne: string;
    previewImageTwo: string;
  };
  portfolio: {
    eyebrow: string;
    title: string;
    description: string;
  };
  digitalProducts: {
    eyebrow: string;
    title: string;
    description: string;
  };
  booking: {
    eyebrow: string;
    title: string;
    description: string;
  };
  newsletter: {
    eyebrow: string;
    photographyTitle: string;
    photographyDescription: string;
    photographyButton: string;
  };
  footer: {
    tagline: string;
    privacyLabel: string;
    termsLabel: string;
  };
};

export const defaultSiteSettings: SiteSettings = {
  entry: {
    title: 'Ijabiken Moyo',
    tagline: 'Visual storytelling across photography and fine art.',
    desktopImage: '/homepage-desktop.jpg',
    mobileImage: '/homepage-mobile.jpg',
    philosophyLabel: 'Philosophy',
    philosophyText: 'Light, emotion, permanence.',
    locationLabel: 'Location',
    locationText: 'Lagos / Worldwide',
  },
  photography: {
    heroSubtext: 'Portraits, editorial, and commissioned work crafted with precision.',
    heroCta: 'Book a Session',
    showPortfolio: true,
    showAbout: true,
    showDigitalProducts: true,
    showBooking: true,
    showReviews: true,
    showNewsletter: true,
  },
  art: {
    heroImage: '/homepage-desktop.jpg',
    aboutImage: '/profile-portrait.jpg',
    previewImageOne: '/image-placeholder.svg',
    previewImageTwo: '/image-placeholder.svg',
  },
  portfolio: {
    eyebrow: 'Selected Portfolio',
    title: 'Visual Proximity',
    description: 'A selection of works focusing on the interplay of texture, light, and solitude.',
  },
  digitalProducts: {
    eyebrow: 'Creative Toolkit',
    title: 'Digital Shop',
    description: 'Tools, presets, and visual resources for photographers and collectors.',
  },
  booking: {
    eyebrow: 'Collaboration',
    title: 'Let us create something with intention.',
    description: 'Share the mood, timing, and purpose of the work. The studio will respond with availability and next steps.',
  },
  newsletter: {
    eyebrow: 'Newsletter',
    photographyTitle: 'Stay close to the work.',
    photographyDescription: 'Join the mailing list for updates on new projects, studio openings, and booking availability.',
    photographyButton: 'Subscribe',
  },
  footer: {
    tagline: 'Visual storytelling across photography and fine art.',
    privacyLabel: 'Privacy',
    termsLabel: 'Terms',
  },
};

function mergeObject<T extends Record<string, unknown>>(defaults: T, value: unknown): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const incoming = value as Record<string, unknown>;
  const merged = { ...defaults } as Record<string, unknown>;

  Object.entries(defaults).forEach(([key, defaultValue]) => {
    const nextValue = incoming[key];
    if (
      defaultValue &&
      typeof defaultValue === 'object' &&
      !Array.isArray(defaultValue)
    ) {
      merged[key] = mergeObject(defaultValue as Record<string, unknown>, nextValue);
    } else if (typeof nextValue === typeof defaultValue) {
      merged[key] = nextValue;
    }
  });

  return merged as T;
}

export function mergeSiteSettings(value: unknown): SiteSettings {
  return mergeObject(defaultSiteSettings, value);
}
