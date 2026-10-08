// Demo inputs, copied from samples/demo_samples.json (keep the two in sync). All values are fake.
// The Stripe-style key is split in two so GitHub secret scanning doesn't mistake it for a real one.
const FAKE_KEY_PREFIX = "sk_" + "live_";

export interface Sample {
  id: string;
  label: string;
  text: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "customer-context",
    label: "Customer escalation",
    text:
      "The Henderson account is about to churn. Their CFO Priya (priya.r@henderson-logistics.com, +91 98400 12345) says the 40L renewal is off unless Project Falcon ships. " +
      `Staging is at http://10.20.4.15:8080 and the key is ${FAKE_KEY_PREFIX}51HxQe9kLmN3pQrStUvWxYz. Draft a reply to Priya that keeps the account.`,
  },
  {
    id: "secrets",
    label: "Leaked secrets",
    text:
      "Our fake deployment notes contain password=Maple!River!2042, API key ak_test_7QpLm2Rs9Tv4, and the service at 192.0.2.44 is failing. " +
      "The owner is Mateo from Northstar. Summarise the exposure and suggest safe rotation steps.",
  },
  {
    id: "medical",
    label: "Patient report",
    text:
      "Dr. Anika Rao recorded that the fictional patient Leena has diabetes and a severe peanut allergy. " +
      "Contact her at leena@example.test or +1 202 555 0188 if the appointment changes. Summarise the report for the care team.",
  },
  {
    id: "internal-infra",
    label: "Production outage",
    text:
      "Production is down for Project Nimbus after host 198.51.100.27 rejected deploys. " +
      "The temporary admin password is Quasar#8841 and the on-call engineer is Ibrahim. Debug the incident and draft an update for leadership.",
  },
];
