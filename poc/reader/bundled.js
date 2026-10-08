// SPDX-License-Identifier: Apache-2.0
export const articleHTML = "\n    <h2>School Districts Turn to Local AI Tools as Security Worries Grow</h2>\n    <p class=\"byline\">By Riley Marsh, Education Desk \u00b7 The Example Journal</p>\n\n    \n    <p>School districts across the Exampleton region are quietly rebuilding their classroom technology around a simple idea: student data should not leave the building. After a pair of breaches at cloud vendors last spring, administrators began looking for tools that could run entirely on machines the district already owns.</p>\n\n    <p>The clearest expression of that shift is the district's pilot of local-first software for lesson planning and record keeping, in which documents live on classroom devices and synchronize only within the school's own network. Teachers keep working when the internet fails, and the district's technology office keeps custody of every record.</p>\n\n    <p>The pilot has pushed school cybersecurity from a budget footnote to the center of board meetings. The district hired its first dedicated security coordinator this year, and staff now rehearse incident response the way they once rehearsed fire drills.</p>\n\n    <p>An internal review presented to the board found that 73 percent of teacher laptops were missing critical security updates at the start of the year, and that the average machine was running software last patched more than fourteen months ago.</p>\n\n    <p>Outside assessments paint a more measured picture. A state audit published last year (<a href=\"#sample-citations\">summary here</a>) reviewed 40 districts and found that 12 had adopted formal patching schedules, according to the <a href=\"#sample-citations\">full report</a>.</p>\n\n    <blockquote>&ldquo;We are not against the cloud. We are against not knowing where our students&rsquo; work actually is. If a tool cannot answer that question, it does not belong in a classroom.&rdquo; &mdash; Dana Okafor, district technology director</blockquote>\n\n    <p>Parents at last week's meeting framed the change as a question of data privacy rather than technology procurement. Several asked whether vendors could still analyze student work once the new systems were in place, and what the district would do if a future vendor made local operation impossible.</p>\n\n    <p>The district says it will publish its evaluation criteria this fall, and neighboring districts have asked to observe the pilot before drafting their own plans.</p>\n  <p id=\"sample-citations\" class=\"byline\">Sample citation links are illustrative only. This is fictional reporting, not a live fetched article.</p>";
export const baseManifest = {
  "lenspub": "0.1",
  "type": "LensManifest",
  "id": "https://avery.example/lenses/avery-daily",
  "metadata": {
    "name": "Avery's Daily Lens",
    "description": "Avery's everyday reading lens: emphasizes local-first software and school cybersecurity coverage, trusts The Example Journal, distrusts contentmill.example, and asks for missing citations to be surfaced.",
    "lensVersion": "1.4.2",
    "created": "2026-03-02T09:15:00Z",
    "modified": "2026-07-01T18:40:00Z",
    "language": "en"
  },
  "domains": [
    {
      "id": "technical-research",
      "label": "Technical research",
      "description": "Software architecture, protocols, and tooling."
    },
    {
      "id": "local-news",
      "label": "Local news",
      "description": "Coverage of Avery's town, school district, and region."
    }
  ],
  "interpretation": {
    "priorities": [
      {
        "topic": "local-first software",
        "weight": 0.9,
        "domains": ["technical-research"],
        "rationale": "I build local-first tools and want coverage of them surfaced first."
      },
      {
        "topic": "school cybersecurity",
        "weight": 0.8,
        "domains": ["local-news"],
        "rationale": "My kids' district has had two incidents; I follow this closely."
      },
      {
        "topic": "data privacy",
        "weight": 0.6
      },
      {
        "topic": "celebrity gossip",
        "weight": -0.5,
        "rationale": "De-emphasize; I do not want this material made more prominent."
      }
    ],
    "sources": {
      "trusted": [
        {
          "origin": "example-journal.example",
          "weight": 0.9,
          "note": "Consistent corrections policy and named reporters."
        }
      ],
      "distrusted": [
        {
          "origin": "contentmill.example",
          "weight": 0.8,
          "note": "Repackages wire stories without attribution."
        }
      ],
      "requireProvenance": ["citations"]
    },
    "presentation": {
      "annotations": true,
      "summaries": "brief",
      "evidenceIndicators": true,
      "counterpoints": "on-request",
      "primarySourceExpansion": true,
      "explanationDisplay": "on-request"
    }
  },
  "adaptation": {
    "defaultPolicy": "balanced",
    "domainPolicies": [
      {
        "domain": "technical-research",
        "policy": "adaptive"
      },
      {
        "domain": "local-news",
        "policy": "conservative"
      }
    ]
  },
  "privacy": {
    "remoteInference": {
      "allowed": false
    }
  }
};
