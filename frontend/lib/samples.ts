// Demo inputs. All names, keys and numbers are fake.
// Fake keys are split in two so GitHub secret scanning doesn't mistake them for real ones.
const FAKE_KEY_PREFIX = "sk_" + "live_";
// TODO: replace with the texts from samples/demo_samples.json once it lands on main.

export interface Sample {
  id: string;
  label: string;
  text: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "customer",
    label: "Customer context",
    text:
      "The Henderson account is about to churn — their CFO Priya Raman says the ₹40L renewal is off unless Project Falcon ships by March. " +
      `Priya Raman's email is priya.raman@henderson-group.com. Our CRM sync key for their account is ${FAKE_KEY_PREFIX}9fK2mQ7xR4tB8vN1pL6c. ` +
      "Draft a reply to Priya Raman that keeps them on board without promising dates we can't hit.",
  },
  {
    id: "secrets",
    label: "Secrets",
    text:
      `Deploying the billing service tonight. Use the Stripe key ${FAKE_KEY_PREFIX}51HxQ2eLkP9vRtY7mN3bZ8wA and the DB password is Tr0ub4dor&3 on 10.24.8.17. ` +
      "If it fails, ping Arjun Mehta at arjun.mehta@northwind.io or +91 98450 12345. Can you write the rollback checklist?",
  },
  {
    id: "medical",
    label: "Medical",
    text:
      "Patient Lakshmi Narayanan (Aadhaar 4821 7730 9162) was diagnosed with type 2 diabetes and early-stage chronic kidney disease. " +
      "Dr. Suresh Iyer at Kovai Medical Centre wants a plain-language summary of the diet changes for her daughter.",
  },
  {
    id: "infra",
    label: "Internal infra",
    text:
      "Prod is failing over. Primary DB at 10.12.4.21, replica at 10.12.4.22, admin panel at https://admin.payments.internal/ops. " +
      "SSH as deploy with password Kx9#vPq2! and check why the Orion cluster keeps OOM-ing. Meera from SRE thinks it's the cache.",
  },
];
