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

  console.log("Seeding 69 Guyana sector categories (LCS Template v4.0)...");

  // All 69 categories from the Related Sector tab of the official template
  const categories = [
    // First Schedule (40 reserved categories)
    { code: "CAT_01", name: "Rental of Office Space", pct: "90", reserved: true },
    { code: "CAT_02", name: "Accommodation Services (Apartments & Houses)", pct: "90", reserved: true },
    { code: "CAT_03", name: "Equipment Rental", pct: "50", reserved: true },
    { code: "CAT_04", name: "Surveying", pct: "40", reserved: true },
    { code: "CAT_05", name: "Pipe Welding (Onshore)", pct: "30", reserved: true },
    { code: "CAT_06", name: "Pipe Sand Blasting and Coating (Onshore)", pct: "30", reserved: true },
    { code: "CAT_07", name: "Construction Work for Buildings (Onshore)", pct: "60", reserved: true },
    { code: "CAT_08", name: "Structural Fabrication", pct: "40", reserved: true },
    { code: "CAT_09", name: "Waste Management (Non-Hazardous)", pct: "60", reserved: true },
    { code: "CAT_10", name: "Waste Management (Hazardous)", pct: "25", reserved: true },
    { code: "CAT_11", name: "Storage Services", pct: "60", reserved: true },
    { code: "CAT_12", name: "Janitorial and Laundry Services", pct: "80", reserved: true },
    { code: "CAT_13", name: "Catering Services", pct: "90", reserved: true },
    { code: "CAT_14", name: "Food Supply", pct: "80", reserved: true },
    { code: "CAT_15", name: "Admin Support & Facilities Management Services", pct: "70", reserved: true },
    { code: "CAT_16", name: "Immigration Support Services", pct: "100", reserved: true },
    { code: "CAT_17", name: "Work Permit, Visas Applications, Visas on arrival and In-water Activity Permit", pct: "80", reserved: true },
    { code: "CAT_18", name: "Laydown Yard Facilities", pct: "70", reserved: true },
    { code: "CAT_19", name: "Customs Brokerage Services", pct: "80", reserved: true },
    { code: "CAT_20", name: "Export Packaging", pct: "50", reserved: true },
    { code: "CAT_21", name: "Pest Control Extermination Services", pct: "80", reserved: true },
    { code: "CAT_22", name: "Cargo Management/ Monitoring", pct: "60", reserved: true },
    { code: "CAT_23", name: "Ship & Rig Chandlery Services", pct: "60", reserved: true },
    { code: "CAT_24", name: "Borehole Testing Services", pct: "20", reserved: true },
    { code: "CAT_25", name: "Environment Services & Studies", pct: "40", reserved: true },
    { code: "CAT_26", name: "Transportation Services: Trucking", pct: "70", reserved: true },
    { code: "CAT_27", name: "Transportation Services: Ground Transportation", pct: "70", reserved: true },
    { code: "CAT_28", name: "Metrology Services", pct: "40", reserved: true },
    { code: "CAT_29", name: "Ventilation (private, commercial, industrial)", pct: "40", reserved: true },
    { code: "CAT_30", name: "Industrial Cleaning Services (Onshore)", pct: "70", reserved: true },
    { code: "CAT_31", name: "Security Services", pct: "80", reserved: true },
    { code: "CAT_32", name: "ICT-Network Installation, Support Services", pct: "50", reserved: true },
    { code: "CAT_33", name: "Manpower and Crewing Services", pct: "60", reserved: true },
    { code: "CAT_34", name: "Dredging Services", pct: "10", reserved: true },
    { code: "CAT_35", name: "Local Insurance Services", pct: "80", reserved: true },
    { code: "CAT_36", name: "Accounting Services", pct: "70", reserved: true },
    { code: "CAT_37", name: "Local Legal Services", pct: "80", reserved: true },
    { code: "CAT_38", name: "Medical Services", pct: "80", reserved: true },
    { code: "CAT_39", name: "Aviation Support Services", pct: "20", reserved: true },
    { code: "CAT_40", name: "Engineering and Machining", pct: "5", reserved: true },
    { code: "CAT_41", name: "Local Marketing & Advertising Services (PR)", pct: "80", reserved: true },
    // Additional sectors from template (not in First Schedule)
    { code: "CAT_42", name: "Other", pct: null, reserved: false },
    { code: "CAT_43", name: "NDE and NDT", pct: null, reserved: false },
    { code: "CAT_44", name: "Scaffolding and/or Rope Access Services", pct: null, reserved: false },
    { code: "CAT_45", name: "Geographical Information and Data Services", pct: null, reserved: false },
    { code: "CAT_46", name: "Offshore Paint", pct: null, reserved: false },
    { code: "CAT_47", name: "Training", pct: null, reserved: false },
    { code: "CAT_48", name: "CCU", pct: null, reserved: false },
    { code: "CAT_49", name: "HSSE Supplies", pct: null, reserved: false },
    { code: "CAT_50", name: "Offshore Pipe Coating and Insulation", pct: null, reserved: false },
    { code: "CAT_51", name: "ROV Services", pct: null, reserved: false },
    { code: "CAT_52", name: "Subsea Services", pct: null, reserved: false },
    { code: "CAT_53", name: "MPSV services", pct: null, reserved: false },
    { code: "CAT_54", name: "Freight Forwarding", pct: null, reserved: false },
    { code: "CAT_55", name: "Inspection/Certification Services", pct: null, reserved: false },
    { code: "CAT_56", name: "Marine Lubricants", pct: null, reserved: false },
    { code: "CAT_57", name: "Commodity Chemicals", pct: null, reserved: false },
    { code: "CAT_58", name: "Fuel Supply", pct: null, reserved: false },
    { code: "CAT_59", name: "Industrial Supplies", pct: null, reserved: false },
    { code: "CAT_60", name: "Lab Supplies", pct: null, reserved: false },
    { code: "CAT_61", name: "Lab Testing Services", pct: null, reserved: false },
    { code: "CAT_62", name: "Tank and/or Cleaning Services", pct: null, reserved: false },
    { code: "CAT_63", name: "Valve Supplies", pct: null, reserved: false },
    { code: "CAT_64", name: "Architectural and Engineering", pct: null, reserved: false },
    { code: "CAT_65", name: "Project Management and Supervision", pct: null, reserved: false },
    { code: "CAT_66", name: "ISO Consultancy and Certification Services.", pct: null, reserved: false },
    { code: "CAT_67", name: "Supply Vessels", pct: null, reserved: false },
    { code: "CAT_68", name: "Rigging", pct: null, reserved: false },
    { code: "CAT_69", name: "Business and Management Consultancy", pct: null, reserved: false },
  ];

  await db.insert(sectorCategories).values(
    categories.map((c, i) => ({
      jurisdictionId: guyana.id,
      code: c.code,
      name: c.name,
      minLocalContentPct: c.pct,
      reserved: c.reserved,
      sortOrder: i + 1,
    }))
  );

  console.log(`Seeded ${categories.length} sector categories.`);
  console.log("Seed complete.");
  process.exit(0);
}

seed().catch(console.error);
