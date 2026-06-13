import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, ShieldAlert, BadgeInfo } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";

/**
 * Renders the primary dashboard workspace including core score trackers
 * and structured interactive data panels across 6 distinct sub-sheets.
 *
 * @param {Object} props - Component properties.
 * @param {Object} props.masterJson - Validated and tagged Master JSON dataset.
 * @returns {React.ReactElement} Styled dark-mode dashboard module.
 */
export default function ResultsDashboard({ masterJson }) {
  const [activeTab, setActiveTab] = useState("Overview");

  if (!masterJson) return null;

  const summary = masterJson.meta.confidenceSummary || {};
  const sections = masterJson.sections;

  const TABS = ["Overview", "Pages & URLs", "Catalog", "Link Registry", "Brands", "Finance", "Claims", "Crawl Audit"];

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 space-y-6">
      {/* Top 4 Metrics Scorecard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Completeness */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 shadow-md text-center">
          <div className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Completeness</div>
          <div className="text-3xl font-bold font-mono text-indigo-400 mt-1">{masterJson.meta.completenessScore || 0}%</div>
          <div className="w-full bg-zinc-950 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div style={{ width: `${masterJson.meta.completenessScore || 0}%` }} className="bg-indigo-500 h-full rounded-full" />
          </div>
        </div>

        {/* Card 2: Verified */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 shadow-md text-center">
          <div className="text-zinc-500 text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified</span>
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400 mt-1">{summary.verifiedCount || 0}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Direct schema mappings</div>
        </div>

        {/* Card 3: Missing */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 shadow-md text-center">
          <div className="text-zinc-500 text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Missing</span>
          </div>
          <div className="text-3xl font-bold font-mono text-rose-400 mt-1">{summary.missingCount || 0}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Profile assets absent</div>
        </div>

        {/* Card 4: Inferred */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 shadow-md text-center">
          <div className="text-zinc-500 text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1">
            <BadgeInfo className="w-3.5 h-3.5 text-amber-400" />
            <span>Inferred</span>
          </div>
          <div className="text-3xl font-bold font-mono text-amber-400 mt-1">{summary.inferredCount || 0}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Pattern-matched from site</div>
        </div>
      </div>

      {/* Navigation Tabs bar */}
      <div className="flex border-b border-zinc-800 overflow-x-auto no-scrollbar scroll-smooth">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3.5 text-sm font-semibold tracking-wide whitespace-nowrap border-b-2 transition-all duration-150 ${
              activeTab === tab
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/80 rounded-xl p-5 shadow-xl min-h-[300px] overflow-x-auto">
        
        {/* tab-overview: RAG summaries */}
        {activeTab === "Overview" && (
          <div className="space-y-4">
            <h4 className="text-zinc-300 font-bold text-sm sm:text-base mb-3">Audit Section RAG Statuses</h4>
            <div className="divide-y divide-zinc-800">
              {[
                { name: "NAP & Business Identity", fill: summary.verifiedCount > 5 ? "emerald" : "amber", desc: "Coordinates, address matching and primary logo elements." },
                { name: "Operational URLs Mapping", fill: sections.s19_deploymentUrls?.home?.confidence === "VERIFIED" ? "emerald" : "rose", desc: "Core navigation endpoints and system routing statuses." },
                { name: "Franchise Portfolio Catalog", fill: sections.s5_brands?.length > 0 ? "emerald" : "amber", desc: "Manufacturer alignments and inferred product ranges." },
                { name: "FinTech Compliance Audits", fill: sections.s8_finance?.forbiddenLanguageFound?.value ? "rose" : "emerald", desc: "Scans for credit structures, lenders, and guaranteed-approval violations." }
              ].map((sec, idx) => (
                <div key={idx} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 gap-4">
                  <div>
                    <div className="text-zinc-200 font-bold text-sm">{sec.name}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">{sec.desc}</div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-extrabold rounded uppercase tracking-wider ${
                    sec.fill === "emerald" ? "bg-emerald-500/10 text-emerald-400" : sec.fill === "rose" ? "bg-rose-500/10 text-rose-400 animate-pulse" : "bg-amber-500/10 text-amber-400"
                  }`}>
                    {sec.fill === "emerald" ? "Passed" : sec.fill === "rose" ? "Violation" : "Warning"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* tab-urls */}
        {activeTab === "Pages & URLs" && (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px] font-bold">
                <th className="pb-3 pr-4">Page Target</th>
                <th className="pb-3 pr-4">Resolved Web Address</th>
                <th className="pb-3">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-zinc-300">
              {Object.entries(sections.s19_deploymentUrls || {}).map(([key, node]) => (
                <tr key={key} className="hover:bg-zinc-850/20">
                  <td className="py-3.5 pr-4 font-bold text-zinc-400">{key.replace(/([A-Z])/g, " $1").toUpperCase()}</td>
                  <td className={`py-3.5 pr-4 font-mono truncate max-w-[220px] sm:max-w-md ${node.duplicateOf ? "text-amber-400 italic" : ""}`}>
                    {key === "brandInventoryUrls" && Array.isArray(node.value)
                      ? node.value.map((e) => `${e.brand}: ${e.url}`).join(" | ")
                      : (node.value || (node.reason ? `— (${node.reason})` : "MISSING"))}
                    {node.duplicateOf && " (Duplicate)"}
                  </td>
                  <td className="py-3.5"><ConfidenceBadge confidence={node.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === "Catalog" && (
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="text-zinc-300 font-bold mb-2">Products ({sections.s5b_catalog?.productCount?.value || 0})</h4>
              <div className="divide-y divide-zinc-800 max-h-48 overflow-y-auto">
                {(sections.s5b_catalog?.products?.value || []).slice(0, 15).map((p, i) => (
                  <div key={i} className="py-2 flex justify-between gap-4">
                    <span className="text-zinc-200 truncate">{p.name}</span>
                    <span className="text-zinc-500 font-mono text-xs shrink-0">{p.price || p.brand || "—"}</span>
                  </div>
                ))}
                {!(sections.s5b_catalog?.products?.value?.length) && (
                  <p className="text-zinc-500 py-2">{sections.s5b_catalog?.products?.reason || "No products found"}</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-zinc-300 font-bold mb-2">Collections ({sections.s5b_catalog?.collectionCount?.value || 0})</h4>
              <div className="divide-y divide-zinc-800 max-h-36 overflow-y-auto">
                {(sections.s5b_catalog?.collections?.value || []).slice(0, 10).map((c, i) => (
                  <div key={i} className="py-2 text-zinc-300 truncate">{c.name}</div>
                ))}
                {!(sections.s5b_catalog?.collections?.value?.length) && (
                  <p className="text-zinc-500 py-2">{sections.s5b_catalog?.collections?.reason || "No collections found"}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Link Registry" && (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px] font-bold">
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">URL</th>
                <th className="pb-3 pr-4">Source</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-zinc-300">
              {(sections.s19_linkRegistry || []).slice(0, 50).map((link, idx) => (
                <tr key={idx} className="hover:bg-zinc-850/20">
                  <td className="py-3 pr-4 font-bold text-zinc-400">{link.category}</td>
                  <td className="py-3 pr-4 font-mono truncate max-w-[200px]">{link.url}</td>
                  <td className="py-3 pr-4 text-zinc-500">{link.source}</td>
                  <td className="py-3">{link.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* tab-brands */}
        {activeTab === "Brands" && (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px] font-bold">
                <th className="pb-3 pr-4">Franchise Brand</th>
                <th className="pb-3 pr-4">Parent Corporation</th>
                <th className="pb-3 pr-4">Product Category</th>
                <th className="pb-3">Authority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-zinc-300">
              {(sections.s5_brands || []).map((b, idx) => (
                <tr key={idx} className="hover:bg-zinc-850/20">
                  <td className="py-3.5 pr-4 font-bold text-zinc-200">{b.brandName?.value}</td>
                  <td className="py-3.5 pr-4 text-zinc-400">{b.parentCompany?.value || b.parentCompany?.reason || "—"}</td>
                  <td className="py-3.5 pr-4 text-zinc-500 font-mono text-xs">{b.productLines?.value?.join(", ")}</td>
                  <td className="py-3.5"><ConfidenceBadge confidence={b.brandName?.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* tab-finance */}
        {activeTab === "Finance" && (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px] font-bold">
                <th className="pb-3 pr-4">Risk Metric Attribute</th>
                <th className="pb-3 pr-4">Discovered Phrasing</th>
                <th className="pb-3">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-zinc-300">
              {Object.entries(sections.s8_finance || {}).map(([key, node]) => (
                <tr key={key} className="hover:bg-zinc-850/20">
                  <td className="py-3.5 pr-4 font-bold text-zinc-400">{key.replace(/([A-Z])/g, " $1").toUpperCase()}</td>
                  <td className={`py-3.5 pr-4 max-w-[200px] sm:max-w-md truncate ${key === "forbiddenLanguageFound" && node.value ? "text-rose-400 font-bold" : ""}`}>
                    {node.value === true ? "Yes" : node.value === false ? "No" : Array.isArray(node.value) ? node.value.join(", ") : node.value || "Not Found"}
                  </td>
                  <td className="py-3.5"><ConfidenceBadge confidence={node.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* tab-claims */}
        {activeTab === "Claims" && (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px] font-bold">
                <th className="pb-3 pr-4">Classification</th>
                <th className="pb-3 pr-4">Slogan/Claim statement text</th>
                <th className="pb-3">Source Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-zinc-300">
              {(sections.s16_claims?.approvedClaims?.value || []).slice(0, 4).map((c, idx) => (
                <tr key={`app-${idx}`} className="hover:bg-zinc-850/20">
                  <td className="py-3.5 pr-4 text-emerald-400 font-bold">Approved Fact</td>
                  <td className="py-3.5 pr-4 truncate max-w-[200px] sm:max-w-md">"{c.claim}"</td>
                  <td className="py-3.5 text-zinc-500 font-mono text-xs">{c.sourceElement}</td>
                </tr>
              ))}
              {(sections.s16_claims?.claimsNeedingProof?.value || []).slice(0, 4).map((c, idx) => (
                <tr key={`pruf-${idx}`} className="hover:bg-zinc-850/20">
                  <td className="py-3.5 pr-4 text-amber-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Needs Proof</span>
                  </td>
                  <td className="py-3.5 pr-4 truncate max-w-[200px] sm:max-w-md font-medium">"{c.claim}"</td>
                  <td className="py-3.5 text-zinc-500 font-mono text-xs">{c.sourceElement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* tab-audit */}
        {activeTab === "Crawl Audit" && (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px] font-bold">
                <th className="pb-3 pr-4">Severity</th>
                <th className="pb-3 pr-4">Field Location</th>
                <th className="pb-3">Reason Not Found</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-zinc-300">
              {(sections.s20_crawlAudit?.critical || sections.s20_missingItems?.critical || []).map((m, idx) => (
                <tr key={`crit-${idx}`} className="hover:bg-zinc-850/20">
                  <td className="py-3.5 pr-4 text-rose-400 font-extrabold uppercase text-xs tracking-wider">Critical</td>
                  <td className="py-3.5 pr-4 font-mono font-bold text-zinc-300">{m.field}</td>
                  <td className="py-3.5 text-zinc-500 text-xs">{m.reason || m.notes}</td>
                </tr>
              ))}
              {(sections.s20_crawlAudit?.gaps || []).slice(0, 20).map((m, idx) => (
                <tr key={`gap-${idx}`} className="hover:bg-zinc-850/20">
                  <td className="py-3.5 pr-4 text-amber-400 font-bold uppercase text-xs tracking-wider">Missing</td>
                  <td className="py-3.5 pr-4 font-mono text-zinc-400">{m.field}</td>
                  <td className="py-3.5 text-zinc-500 text-xs">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>
    </div>
  );
}