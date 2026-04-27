import { readFileSync } from "fs";
import { join } from "path";
import PumpsAnalysis from "@/components/PumpsAnalysis";
import type { Product } from "@/types/product";

export default function Home() {
  const filePath = join(process.cwd(), "public/data/pumps-products.json");
  const products: Product[] = JSON.parse(readFileSync(filePath, "utf-8"));

  return <PumpsAnalysis products={products} />;
}
