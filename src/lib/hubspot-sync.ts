import { Client } from "@hubspot/api-client";

const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
});

interface HubSpotContactData {
  email: string;
  companyName: string;
  country: string;
  registrationStatus: string;
  expiryDate?: string;
  phone?: string;
  address?: string;
  website?: string;
  lcsCertId?: string;
  serviceCategories?: string[];
  tradingName?: string;
  // Lifecycle tracking
  lcaDeskRole?: string;       // filer | supplier | seeker
  lcaDeskPlan?: string;       // essentials | professional | enterprise | supplier_pro
  trialStartDate?: string;    // ISO date
  trialEndDate?: string;      // ISO date
  signupDate?: string;        // ISO date
  upgradeDate?: string;       // ISO date
  churnDate?: string;         // ISO date
  stripeCustomerId?: string;
  lcaDeskUserId?: string;
  firstName?: string;
  lastName?: string;
}

export async function upsertHubspotContact(data: HubSpotContactData) {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return;

  const search = await hubspotClient.crm.contacts.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "email",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            operator: "EQ" as any,
            value: data.email,
          },
        ],
      },
    ],
    properties: ["email"],
    limit: 1,
  });

  const properties: Record<string, string> = {
    email: data.email,
    company: data.companyName,
    country: data.country,
    registration_status: data.registrationStatus,
  };

  // Names — use explicit first/last if provided, otherwise split company name
  if (data.firstName) {
    properties.firstname = data.firstName;
  } else if (!search.results.length) {
    // Only set from company name on CREATE, not update (don't overwrite real names)
    const parts = data.companyName.split(" ");
    properties.firstname = parts[0] || "";
    if (parts.length > 1) properties.lastname = parts.slice(1).join(" ");
  }
  if (data.lastName) properties.lastname = data.lastName;

  // LCS register fields
  if (data.expiryDate) properties.registration_expiration_date = data.expiryDate;
  if (data.phone) {
    let phone = data.phone.replace(/\s+/g, "").replace(/[()]/g, "");
    // Add Guyana country code if missing
    if (!phone.startsWith("+")) {
      phone = phone.replace(/^0+/, ""); // strip leading zeros
      phone = `+592${phone.replace(/-/g, "")}`;
    }
    properties.phone = phone;
  }
  if (data.address) properties.address = data.address;
  if (data.website) properties.website = data.website;
  if (data.lcsCertId) properties.lcs_cert_id = data.lcsCertId;
  if (data.serviceCategories?.length) properties.industry = data.serviceCategories[0];
  if (data.tradingName) properties.jobtitle = `t/a ${data.tradingName}`;

  // Lifecycle tracking — only set if provided (don't clear existing values)
  if (data.lcaDeskRole) properties.lca_desk_role = data.lcaDeskRole;
  if (data.lcaDeskPlan) properties.lca_desk_plan = data.lcaDeskPlan;
  if (data.trialStartDate) properties.trial_start_date = data.trialStartDate;
  if (data.trialEndDate) properties.trial_end_date = data.trialEndDate;
  if (data.signupDate) properties.signup_date = data.signupDate;
  if (data.upgradeDate) properties.upgrade_date = data.upgradeDate;
  if (data.churnDate) properties.churn_date = data.churnDate;
  if (data.stripeCustomerId) properties.stripe_customer_id = data.stripeCustomerId;
  if (data.lcaDeskUserId) properties.lca_desk_user_id = data.lcaDeskUserId;

  if (search.results.length > 0) {
    return hubspotClient.crm.contacts.basicApi.update(
      search.results[0].id,
      { properties }
    );
  }

  // On create, set first_scraped_date if this is coming from the scraper
  if (data.registrationStatus === "Active" || data.registrationStatus === "Approved") {
    properties.first_scraped_date = new Date().toISOString().slice(0, 10);
  }

  return hubspotClient.crm.contacts.basicApi.create({
    properties,
  });
}

// Convenience wrappers for specific lifecycle events

export async function syncSignup(email: string, name: string, companyName: string, role: string, trialEndsAt?: Date) {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return;
  const nameParts = name.split(" ");
  await upsertHubspotContact({
    email,
    companyName,
    country: "GY",
    registrationStatus: role === "filer" ? "filer_trial" : `${role}_registered`,
    lcaDeskRole: role,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" ") || undefined,
    signupDate: new Date().toISOString().slice(0, 10),
    trialStartDate: trialEndsAt ? new Date().toISOString().slice(0, 10) : undefined,
    trialEndDate: trialEndsAt ? trialEndsAt.toISOString().slice(0, 10) : undefined,
  });
}

export async function syncPayment(email: string, plan: string, stripeCustomerId?: string) {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return;
  const planNames: Record<string, string> = { lite: "essentials", pro: "professional", enterprise: "enterprise" };
  await upsertHubspotContact({
    email,
    companyName: "", // won't overwrite — only updates specific fields
    country: "GY",
    registrationStatus: `paying_${planNames[plan] || plan}`,
    lcaDeskPlan: planNames[plan] || plan,
    upgradeDate: new Date().toISOString().slice(0, 10),
    stripeCustomerId,
  });
}

export async function syncPaymentFailed(email: string) {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return;
  await upsertHubspotContact({
    email,
    companyName: "",
    country: "GY",
    registrationStatus: "payment_failed",
  });
}

export async function syncChurn(email: string) {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return;
  await upsertHubspotContact({
    email,
    companyName: "",
    country: "GY",
    registrationStatus: "churned",
    churnDate: new Date().toISOString().slice(0, 10),
  });
}

// Sync a key behavioral event to HubSpot contact properties.
// Finds or creates the contact by email and sets event-specific date fields,
// which can trigger lifecycle workflows in HubSpot.
export async function syncBehavioralEvent(
  email: string,
  eventName: "entity_created" | "first_expenditure_added" | "report_submitted" | "trial_started",
  eventProperties?: Record<string, string>
) {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return;

  const today = new Date().toISOString().slice(0, 10);
  const eventPropertyMap: Record<string, Record<string, string>> = {
    entity_created: { lca_desk_entity_created: today },
    first_expenditure_added: { lca_desk_first_expenditure_date: today },
    report_submitted: { lca_desk_first_report_submitted: today },
    trial_started: {
      trial_start_date: today,
      ...(eventProperties?.trialEndsAt ? { trial_end_date: eventProperties.trialEndsAt.slice(0, 10) } : {}),
    },
  };

  const properties: Record<string, string> = {
    email,
    lca_desk_last_event: eventName,
    lca_desk_last_event_date: today,
    ...eventPropertyMap[eventName],
  };

  // Find existing contact and update, or create a new one
  const search = await hubspotClient.crm.contacts.searchApi.doSearch({
    filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ" as never, value: email }] }],
    properties: ["email"],
    limit: 1,
  });

  if (search.results.length > 0) {
    await hubspotClient.crm.contacts.basicApi.update(search.results[0].id, { properties });
  } else {
    await hubspotClient.crm.contacts.basicApi.create({ properties });
  }
}
