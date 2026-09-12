/**
 * AdEvolve API — catch-all Next.js App Router handler
 * Mounts all 5 endpoints:
 *   POST /api/adevolve/validate
 *   POST /api/adevolve/optimize
 *   POST /api/adevolve/campaign
 *   GET  /api/adevolve/campaign/:id
 *   GET  /api/adevolve/metrics
 */
export { GET, POST, OPTIONS } from "@adevolve/api/routes";
