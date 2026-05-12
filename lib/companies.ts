export type Portfolio = {
  slug: string;
  name: string;
  active: boolean;
  dashboardPath?: string;
  uploadPath?: string;
};

export type Company = {
  slug: string;
  name: string;
  active: boolean;
  portfolios: Portfolio[];
};

export const COMPANIES: Company[] = [
  {
    slug: "supra",
    name: "Supra Pacific",
    active: true,
    portfolios: [
      {
        slug: "gold-loan",
        name: "Gold Loan",
        active: true,
        dashboardPath: "/dashboard/supra/gold-loan",
        uploadPath: "/upload/supra/gold-loan",
      },
      {
        slug: "mf-loan",
        name: "MF Loan",
        active: true,
        dashboardPath: "/dashboard/supra/mf-loan",
        uploadPath: "/upload/supra/mf-loan",
      },
      { slug: "vehicle-loan",   name: "Vehicle Loan",   active: false },
      { slug: "personal-loan",  name: "Personal Loan",  active: false },
      { slug: "pledge-loan",    name: "Pledge Loan",    active: false },
    ],
  },
  { slug: "ideal",         name: "Ideal Supermarket",  active: false, portfolios: [] },
  { slug: "cfcici",        name: "CFCICI",              active: false, portfolios: [] },
  { slug: "centralbazar",  name: "Central Bazar",       active: false, portfolios: [] },
  { slug: "centora",       name: "Centora",             active: false, portfolios: [] },
  { slug: "centralbiofuel",name: "Central Bio Fuel",    active: false, portfolios: [] },
];
