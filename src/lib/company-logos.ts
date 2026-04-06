// Map contractor names to their website domains for logo fetching

const COMPANY_DOMAINS: Record<string, string> = {
  "ExxonMobil Guyana Limited": "exxonmobil.com",
  "Hess Guyana Exploration Ltd": "hess.com",
  "CNOOC Petroleum Guyana Limited": "cnooc.com.cn",
  "Halliburton Guyana Inc.": "halliburton.com",
  "SLB Guyana (Schlumberger)": "slb.com",
  "Baker Hughes Guyana": "bakerhughes.com",
  "TechnipFMC Guyana": "technipfmc.com",
  "Saipem Guyana Inc.": "saipem.com",
  "Guyana Shore Base Inc. (GYSBI)": "guyshorebase.com",
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
  "GYSBI": "guyshorebase.com",
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
  "Expro": "expro.com",
  "Worley": "worley.com",
  "McDermott": "mcdermott.com",
  "Subsea 7": "subsea7.com",
  "Borr Drilling": "borrdrilling.com",
  "Valaris": "valaris.com",
  "Tidewater": "tdw.com",
  "Bristow Group": "bristowgroup.com",
  "PHX Energy": "phxenergy.com",
  "Fugro": "fugro.com",
  "Wood": "woodplc.com",
  "Dril-Quip": "dril-quip.com",
  "National Oilwell Varco": "nov.com",
  "NOV": "nov.com",
  "Oceaneering": "oceaneering.com",
};

export function getCompanyLogoUrl(companyName: string, size: number = 64): string | null {
  const domain = getCompanyDomain(companyName);
  if (!domain) return null;
  // Use favicon.im — returns high-res favicons/touch-icons reliably
  return `https://favicon.im/${domain}?larger=true`;
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
