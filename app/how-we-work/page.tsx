import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { getSiteConfig } from "@/lib/queries";
import HowWeWorkClient from "./how-we-work-client";

export const metadata: Metadata = {
  title: "我们怎么一起工作 — ONIT",
  description:
    "ONIT 的两份标准交付文档：共同成功计划（MCSP）和实施进度表（OMT）。这是我们与你们一起追同一个目标的工作方式。",
};

export default async function HowWeWorkPage() {
  const siteConfig = await getSiteConfig();
  return (
    <>
      <Navbar siteConfig={siteConfig} />
      <HowWeWorkClient />
    </>
  );
}
