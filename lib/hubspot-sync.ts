import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts";

const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
});

export async function upsertHubspotContact(data: {
  email: string;
  companyName: string;
  country: string;
  registrationStatus: string;
  expiryDate?: string;
}) {
  const search = await hubspotClient.crm.contacts.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "email",
            operator: FilterOperatorEnum.Eq,
            value: data.email,
          },
        ],
      },
    ],
    properties: ["email"],
    limit: 1,
  });

  const properties = {
    email: data.email,
    company_name: data.companyName,
    country: data.country,
    registration_status: data.registrationStatus,
    registration_expiration_date: data.expiryDate || "",
  };

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
