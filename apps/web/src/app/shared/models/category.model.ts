export interface CategorySummary {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
}
