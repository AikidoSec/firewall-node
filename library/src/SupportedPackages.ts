type SupportedPackage = {
  name: string;
  range: string;
};

export const supportedPackages: SupportedPackage[] = [
  {
    name: "express",
    range: "^4.0.0",
  },
  {
    name: "mongodb",
    range: "^4.0.0 || ^5.0.0 || ^6.0.0",
  },
];
