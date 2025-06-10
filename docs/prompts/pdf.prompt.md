Create a TypeScript function in `pdf.ts` that generates a PDF contract document using PDFKit, following the template structure defined in `contract-template.md`. The function should:

1. Accept a `ContractInput` parameter containing campaign, brand, influencer, deliverables, compensation, and signature details
2. Initialize a new PDFKit document with A4 size and standard margins
3. Dynamically populate the contract template with the provided input data
4. Format dates in a readable format (DD/MM/YYYY)
5. Generate proper paragraph spacing and formatting for readability
6. Include formatted sections for deliverables as bullet points
7. Add signature blocks at the bottom
8. Save the generated PDF to a specified output path

Required:

- Use PDFKit's latest version (refer to https://pdfkit.org/docs/getting_started.html)
- Handle all required ContractInput fields
- Implement proper error handling for invalid inputs
- Format currency values with appropriate locale
- Ensure consistent font styling and spacing throughout the document
- Return a Promise that resolves with the PDF file path or rejects with an error

Input type definition and example JSON provided in the implementation should be used for testing.

Example usage:

```typescript
generateContract(contractInput: ContractInput): Promise<string>
```

Follow PDFKit's documentation for text formatting, list creation, and document structure best practices.

---

Here is the sample inputs the function can take:

```typescript
export type ContractInput = {
  campaignTitle: string
  campaignDescription: string
  startDate: string // ISO format: "YYYY-MM-DD"
  endDate: string // ISO format: "YYYY-MM-DD"
  brand: {
    name: string
    contactPerson: string
    email: string
  }
  influencer: {
    name: string
    instagramHandle: string
    email: string
    phone?: string
  }
  deliverables: string[] // Each deliverable as a bullet point
  compensation: {
    currency: string
    amount: number
    paymentMethod: string // e.g. "Stripe", "Razorpay"
  }
  jurisdiction: string // e.g. "Mumbai, India"
  signature: {
    brandSignatoryName: string
    influencerSignatoryName: string
  }
}
```

Here is a sample JSON:

```json
{
  "campaignTitle": "Eduform Awareness Campaign",
  "campaignDescription": "An Instagram campaign to raise awareness about Eduform's new learning features targeting college students.",
  "startDate": "2025-06-15",
  "endDate": "2025-06-30",
  "brand": {
    "name": "Eduform",
    "contactPerson": "Priya Shah",
    "email": "priya@eduform.com"
  },
  "influencer": {
    "name": "Amit Verma",
    "instagramHandle": "@amitlearns",
    "email": "amit@influencer.com",
    "phone": "+91-9876543210"
  },
  "deliverables": [
    "One 60s Reel highlighting the cool features of Eduform",
    "Three Stories of 10-15s each showcasing Eduform's interactive learning tools"
  ],
  "compensation": {
    "currency": "INR",
    "amount": 20000,
    "paymentMethod": "Razorpay"
  },
  "jurisdiction": "Mumbai, India",
  "signature": {
    "brandSignatoryName": "Priya Shah",
    "influencerSignatoryName": "Amit Verma"
  }
}
```
