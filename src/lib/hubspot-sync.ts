import { Client } from "@hubspot/api-client";

const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
});

export async function upsertHubspotContact(data: {
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
}) {
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

  // Split company name into first/last as best guess for contact name
  const nameParts = data.companyName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const properties: Record<string, string> = {
    email: data.email,
    company: data.companyName,
    country: data.country,
    registration_status: data.registrationStatus,
    registration_expiration_date: data.expiryDate || "",
  };

  // Only set name if we have it (don't overwrite with company name split)
  if (firstName) properties.firstname = firstName;
  if (lastName) properties.lastname = lastName;
  if (data.phone) properties.phone = data.phone;
  if (data.address) properties.address = data.address;
  if (data.website) properties.website = data.website;
  if (data.lcsCertId) properties.lcs_cert_id = data.lcsCertId;
  if (data.serviceCategories?.length) properties.industry = data.serviceCategories[0];
  if (data.tradingName) properties.jobtitle = `t/a ${data.tradingName}`;

  if (search.results.length > 0) {
    return hubspotClient.crm.contacts.basicApi.update(
      search.results[0].id,
      { properties }
    );
  }

  return hubspotClient.crm.contacts.basicApi.create({
    properties,
  });
}
