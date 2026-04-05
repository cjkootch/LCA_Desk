import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { jurisdictions, sectorCategories } from "./schema";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("Seeding jurisdictions...");

  const [guyana] = await db
    .insert(jurisdictions)
    .values({
      code: "GY",
      name: "Guyana",
      fullName: "Co-operative Republic of Guyana",
      regulatoryBody: "Local Content Secretariat, Ministry of Natural Resources",
      regulatoryBodyShort: "LCS",
      submissionEmail: "localcontent@nre.gov.gy",
      submissionEmailSubjectFormat:
        "Local Content Half-Yearly Report – {period} – {company_name}",
      currencyCode: "USD",
      localCurrencyCode: "GYD",
      active: true,
      phase: 1,
    })
    .returning();

  await db.insert(jurisdictions).values([
    { code: "SR", name: "Suriname", active: false, phase: 2 },
    { code: "NA", name: "Namibia", active: false, phase: 3 },
  ]);

  console.log("Seeding Guyana sector categories...");

  const categories = [
    { code: "CAT_01", name: "Rental of Office Space", pct: "90", order: 1 },
    { code: "CAT_02", name: "Accommodation Services (Apartments and Houses)", pct: "90", order: 2 },
    { code: "CAT_03", name: "Equipment Rental (Crane and Other Heavy-Duty Machinery)", pct: "50", order: 3 },
    { code: "CAT_04", name: "Surveying", pct: "40", order: 4 },
    { code: "CAT_05", name: "Pipe Welding – Onshore", pct: "30", order: 5 },
    { code: "CAT_06", name: "Pipe Sand Blasting and Coating – Onshore", pct: "30", order: 6 },
    { code: "CAT_07", name: "Construction Work for Buildings Onshore", pct: "60", order: 7 },
    { code: "CAT_08", name: "Structural Fabrication", pct: "40", order: 8 },
    { code: "CAT_09", name: "Waste Management – Non-Hazardous", pct: "60", order: 9 },
    { code: "CAT_10", name: "Waste Management – Hazardous", pct: "25", order: 10 },
    { code: "CAT_11", name: "Storage Services (Warehousing)", pct: "60", order: 11 },
    { code: "CAT_12", name: "Janitorial and Laundry Services", pct: "80", order: 12 },
    { code: "CAT_13", name: "Catering Services", pct: "90", order: 13 },
    { code: "CAT_14", name: "Food Supply", pct: "80", order: 14 },
    { code: "CAT_15", name: "Administrative Support and Facilities Management", pct: "70", order: 15 },
    { code: "CAT_16", name: "Immigration Support Services", pct: "100", order: 16 },
    { code: "CAT_17", name: "Work Permit and Visa Applications", pct: "80", order: 17 },
    { code: "CAT_18", name: "Laydown Yard Facilities", pct: "70", order: 18 },
    { code: "CAT_19", name: "Customs Brokerage Services", pct: "80", order: 19 },
    { code: "CAT_20", name: "Export Packaging, Crating, Preservation and Inspection", pct: "50", order: 20 },
    { code: "CAT_21", name: "Pest Control Exterminator Services", pct: "80", order: 21 },
    { code: "CAT_22", name: "Cargo Management and Monitoring", pct: "60", order: 22 },
    { code: "CAT_23", name: "Ship and Rig Chandlery Services", pct: "60", order: 23 },
    { code: "CAT_24", name: "Borehole Testing Services", pct: "20", order: 24 },
    { code: "CAT_25", name: "Environmental Services and Studies", pct: "40", order: 25 },
    { code: "CAT_26", name: "Transportation Services – Trucking and Movement of Personnel", pct: "70", order: 26 },
    { code: "CAT_27", name: "Metrology Services", pct: "40", order: 27 },
    { code: "CAT_28", name: "Ventilation (Private, Commercial, Industrial)", pct: "40", order: 28 },
    { code: "CAT_29", name: "Industrial Cleaning Services (Onshore)", pct: "70", order: 29 },
    { code: "CAT_30", name: "Security Services", pct: "80", order: 30 },
    { code: "CAT_31", name: "ICT – Network Installation and Support Services", pct: "50", order: 31 },
    { code: "CAT_32", name: "Manpower and Crewing Services", pct: "60", order: 32 },
    { code: "CAT_33", name: "Dredging Services", pct: "10", order: 33 },
    { code: "CAT_34", name: "Local Insurance Services", pct: "80", order: 34 },
    { code: "CAT_35", name: "Local Accounting Services", pct: "70", order: 35 },
    { code: "CAT_36", name: "Local Legal Services", pct: "80", order: 36 },
    { code: "CAT_37", name: "Medical Services", pct: "80", order: 37 },
    { code: "CAT_38", name: "Aviation Support Services", pct: "20", order: 38 },
    { code: "CAT_39", name: "Engineering and Machining", pct: "5", order: 39 },
    { code: "CAT_40", name: "Local Marketing and Advertising Services", pct: "80", order: 40 },
  ];

  await db.insert(sectorCategories).values(
    categories.map((c) => ({
      jurisdictionId: guyana.id,
      code: c.code,
      name: c.name,
      minLocalContentPct: c.pct,
      reserved: true,
      sortOrder: c.order,
    }))
  );

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch(console.error);
