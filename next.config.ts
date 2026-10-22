import type { NextConfig } from "next";

const config: NextConfig = {
  // ExcelJS uses Node streams and a CommonJS XML/ZIP parser. Keep that module
  // graph intact in hosted functions instead of rewriting it into app chunks.
  serverExternalPackages: ["exceljs"],
};

export default config;
