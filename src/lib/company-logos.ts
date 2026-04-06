// Map contractor names to their website domains for logo fetching
// Uses Clearbit Logo API: https://logo.clearbit.com/{domain}

const COMPANY_DOMAINS: Record<string, string> = {
  "ExxonMobil Guyana Limited": "exxonmobil.com",
  "Hess Guyana Exploration Ltd": "hess.com",
  "CNOOC Petroleum Guyana Limited": "cnooc.com.cn",
  "Halliburton Guyana Inc.": "halliburton.com",
  "SLB Guyana (Schlumberger)": "slb.com",
  "Baker Hughes Guyana": "bakerhughes.com",
  "TechnipFMC Guyana": "technipfmc.com",
  "Saipem Guyana Inc.": "saipem.com",
  "Guyana Shore Base Inc. (GYSBI)": "gaborone.com", // no direct domain, fallback
  "Guyana Deepwater Operations Inc.": "sbmoffshore.com",
  "MODEC Guyana Inc.": "modec.com",
  "Stena Drilling Ltd": "stenadrilling.com",
  "G-Boats Inc.": "gboatsinc.com",
  "Weatherford Guyana": "weatherford.com",
  "Tenaris Guyana": "tenaris.com",
  "Seacor Marine LLC": "seacormarine.com",
  "International SOS Incorporated": "internationalsos.com",
  "Leader Engineering Guyana Incorporated": "leadereng.com",
  "Cataleya Energy Limited": "cataleyaenergy.com",
  "Sustainable Environmental Solutions": "ses-gy.com",
  "TotalEnergies Guyana": "totalenergies.com",
  "New Fortress Energy Guyana": "newfortressenergy.com",
  // Common variations
  "Halliburton Guyana Inc": "halliburton.com",
  "Halliburton": "halliburton.com",
  "ExxonMobil": "exxonmobil.com",
  "Hess": "hess.com",
  "CNOOC": "cnooc.com.cn",
  "Schlumberger": "slb.com",
  "SLB": "slb.com",
  "Baker Hughes": "bakerhughes.com",
  "TechnipFMC": "technipfmc.com",
  "Saipem": "saipem.com",
  "GYSBI": "gaborone.com",
  "MODEC": "modec.com",
  "Stena Drilling": "stenadrilling.com",
  "Weatherford": "weatherford.com",
  "Tenaris": "tenaris.com",
  "TotalEnergies": "totalenergies.com",
  "Bourbon Guyana Inc.": "bourbonoffshore.com",
  "Bourbon Guyana Inc": "bourbonoffshore.com",
  "Noble Corporation": "noblecorp.com",
  "Diamond Offshore": "diamondoffshore.com",
  "Transocean": "deepwater.com",
  "Nabors Industries": "nabors.com",
  "Core Laboratories": "corelab.com",
  "Newpark Resources": "newpark.com",
  "CGX Energy": "cgxenergy.com",
  "Repsol": "repsol.com",
};

export function getCompanyLogoUrl(companyName: string, size: number = 64): string | null {
  // Direct match
  if (COMPANY_DOMAINS[companyName]) {
    return `https://logo.clearbit.com/${COMPANY_DOMAINS[companyName]}?size=${size}`;
  }

  // Fuzzy match — check if any key is contained in the company name
  for (const [key, domain] of Object.entries(COMPANY_DOMAINS)) {
    if (companyName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(companyName.toLowerCase())) {
      return `https://logo.clearbit.com/${domain}?size=${size}`;
    }
  }

  return null;
}

export function getCompanyDomain(companyName: string): string | null {
  if (COMPANY_DOMAINS[companyName]) return COMPANY_DOMAINS[companyName];

  for (const [key, domain] of Object.entries(COMPANY_DOMAINS)) {
    if (companyName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(companyName.toLowerCase())) {
      return domain;
    }
  }

  return null;
}
