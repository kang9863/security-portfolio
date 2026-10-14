"use strict";
const aliases={"juice-shop":"reports/juice-shop-team-project.md","web-analysis":"reports/sql-injection-report-sample.md","active-directory":"reports/htb-forest-writeup.md","cod-caper":"reports/thm-cod-caper-writeup.md","ai-workbench":"reports/multi-llm-mcp-workbench.md"};
const target=aliases[new URLSearchParams(location.search).get('id')];
if(target)location.replace('viewer.html?file='+encodeURIComponent(target));
