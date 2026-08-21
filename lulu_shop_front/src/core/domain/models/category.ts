export type ProductCategory = {
  _id: string;
  name: string;
  slug: string;
  order: number;
  defaultTypes: string[];
  isActive: boolean;
};
