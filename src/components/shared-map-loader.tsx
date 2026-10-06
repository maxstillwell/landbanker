"use client";
import dynamic from "next/dynamic";
const SharedMap = dynamic(() => import("./shared-map"), { ssr: false });
export default SharedMap;
