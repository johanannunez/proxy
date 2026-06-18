import { NextResponse } from "next/server";

const LLMS_TXT = `# Proxy

> A premium workspace for short term rental operators managing owner relationships.

Proxy helps operators manage 1 to 50 properties per owner relationship with documents, financials, messages, requests, tasks, timelines, and property readiness in one workspace.

## Product

- **Workspace dashboard**: Portfolio context, documents, messages, financials, tasks, timelines, and property readiness in one view.
- **Owner relationship management**: Shared operating context for owners, operators, properties, and the Proxy team.
- **Document spine**: Agreements, tax forms, insurance files, receipts, requested uploads, and signing workflows.
- **Financial operations**: Revenue summaries, reimbursements, payouts, finance requests, and supporting documents.
- **Communication hub**: Messages and owner updates connected to the right relationship and property.
- **Task and timeline tracking**: Action items, due dates, activity history, and readiness checks.

## Audience

Proxy is built for short term rental operators who manage owner relationships across small to mid sized property portfolios.

## Links

- [Homepage](https://www.myproxyhost.com)
- [Workspace login](https://www.myproxyhost.com/login)
- [Request access](https://www.myproxyhost.com/signup)
- [Help Center](https://www.myproxyhost.com/help)
- [Terms of Service](https://www.myproxyhost.com/terms)
- [Privacy Policy](https://www.myproxyhost.com/privacy)

## Contact

- Email: hello@myproxyhost.com
- Website: https://www.myproxyhost.com
`;

export async function GET() {
  return new NextResponse(LLMS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
